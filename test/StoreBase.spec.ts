/**
 * StoreBase.spec.ts
 * Author: David de Regt
 * Copyright: Microsoft 2016
 *
 * Tests all the various expected behavior of StoreBase.
 */
import { StoreBase } from '../src/StoreBase';
import Options from '../src/Options';

type TKeys = string[] | undefined;

class BraindeadStore extends StoreBase {
    Key_Something = 'abc';
    Key_Something2 = 'def';

    foundAll = false;
    allKeys: TKeys;
    allSub!: number;
    foundKey = false;
    keyKeys: TKeys;
    keySub!: number;

    setupSubs(): void {
        this.allSub = this.subscribe((keys: TKeys) => {
            this.foundAll = true;
            this.allKeys = keys;
        });

        this.keySub = this.subscribe((keys: TKeys) => {
            this.foundKey = true;
            this.keyKeys = keys;
        }, this.Key_Something);
    }

    emitAll(): void {
        this.trigger();
    }

    emitSomething(): void {
        this.trigger(this.Key_Something);
    }

    emitSomethings(): void {
        this.trigger([this.Key_Something, this.Key_Something2]);
    }
}

class TriggerableStore extends StoreBase {
    emit(keys: string[]): void {
        this.trigger(keys);
    }
}

// ------------------------------------------------------------------------------------
// Tests for auto-subscriptions.
// Note: if an 'internal check' fails then the problem might be in the unit test itself,
//       or in some other file.

describe('StoreBase', function () {
    beforeEach(() => {
        jasmine.clock().install();
        jasmine.clock().mockDate(new Date());

        // Setup setTimeout/clearTimeout to respect clock mocking
        Options.setTimeout = setTimeout.bind(null);
        Options.clearTimeout = clearTimeout.bind(null);
    });

    afterEach(() => {
        jasmine.clock().uninstall();
        Options.setTimeout = setTimeout.bind(null);
        Options.clearTimeout = clearTimeout.bind(null);
    });

    it('Non-timed/Non-bypass Store', () => {
        let store = new BraindeadStore(0, false);
        store.setupSubs();

        // Try all emit
        store.emitAll();
        expect(store.foundAll && store.foundKey).toBeTruthy();
        expect<TKeys>(store.allKeys).toBeUndefined();
        expect<TKeys>(store.keyKeys).toBeUndefined();

        store.foundAll = store.foundKey = false;
        store.allKeys = store.keyKeys = undefined;

        // Try keyed emit
        store.emitSomething();
        expect<TKeys>(store.allKeys).toEqual([store.Key_Something]);
        expect<TKeys>(store.keyKeys).toEqual([store.Key_Something]);
        expect(store.foundAll && store.foundKey).toBeTruthy();

        store.foundAll = store.foundKey = false;
        store.allKeys = store.keyKeys = undefined;

        // Try keyed emits
        store.emitSomethings();
        expect<TKeys>(store.allKeys).toEqual([store.Key_Something, store.Key_Something2]);
        expect<TKeys>(store.keyKeys).toEqual([store.Key_Something]);
        expect(store.foundAll && store.foundKey).toBeTruthy();
        expect(store.foundAll && store.foundKey).toBeTruthy();

        store.foundAll = store.foundKey = false;
        store.allKeys = store.keyKeys = undefined;

        // block triggers
        StoreBase.pushTriggerBlock();
        store.emitAll();
        store.emitSomething();
        store.emitSomethings();
        expect(!store.foundAll && !store.foundKey).toBeTruthy();

        // unblock and make sure the dedupe logic works (should just emit undefined, since we did an all emit,
        // which overrides the keyed ones)
        StoreBase.popTriggerBlock();
        expect<TKeys>(store.allKeys).toBeUndefined();
        expect<TKeys>(store.keyKeys).toBeUndefined();
        expect(store.foundAll && store.foundKey).toBeTruthy();

        store.foundAll = store.foundKey = false;
        store.allKeys = store.keyKeys = undefined;

        // Make sure unsubscribe works
        store.unsubscribe(store.allSub);
        store.emitAll();
        expect(!store.foundAll && store.foundKey).toBeTruthy();

        store.foundAll = store.foundKey = false;
        store.allKeys = store.keyKeys = undefined;
        store.unsubscribe(store.keySub);
        store.emitSomething();
        expect(!store.foundAll && !store.foundKey).toBeTruthy();
    });

    it('Non-timed/Bypass Store', () => {
        let store = new BraindeadStore(0, true);
        store.setupSubs();

        // Try all emit
        store.emitAll();
        expect(store.foundAll).toBeTruthy();
        expect<TKeys>(store.allKeys).toBeUndefined();

        store.foundAll = false;
        store.allKeys = undefined;

        // block triggers, should do nothing (triggers should still flow)
        StoreBase.pushTriggerBlock();
        store.emitAll();
        expect(store.foundAll).toBeTruthy();
        expect<TKeys>(store.allKeys).toBeUndefined();

        store.foundAll = false;
        store.allKeys = undefined;

        // unblock and make sure nothing pops out
        StoreBase.popTriggerBlock();
        expect(store.foundAll).toBeFalsy();
    });

    it('Timed/non-Bypass Store', () => {
        let store = new BraindeadStore(100, false);
        store.setupSubs();

        // Try all emit -- should do nothing at the moment
        store.emitAll();
        expect(store.foundAll).toBeFalsy();

        jasmine.clock().tick(10);
        expect(store.foundAll).toBe(false);

        jasmine.clock().tick(90);
        expect(store.foundAll).toBeTruthy();
    });

    it('Double Trigger w/ Unsubscribe', () => {
        let store = new BraindeadStore();

        let callCount1 = 0;
        const token1 = store.subscribe(() => {
            callCount1++;
            store.unsubscribe(token1);
            store.emitAll();
        });

        let callCount2 = 0;
        const token2 = store.subscribe(() => {
            callCount2++;
            store.unsubscribe(token2);
            store.emitAll();
        });

        /**
         * Try all emit
         *  Each subscription should the called once and the store should trigger multiple times
         */
        store.emitAll();
        expect(callCount1).toEqual(1);
        expect(callCount2).toEqual(1);
    });

    it('Subscription callbacks de-dupe', () => {
        let store = new BraindeadStore(100, false);
        let callbackCount = 0;
        const subCallback = (): void => {
            callbackCount++;
        };

        store.subscribe(subCallback, store.Key_Something);
        store.subscribe(subCallback, store.Key_Something2);
        store.subscribe(subCallback);
        store.emitSomething();
        store.emitSomethings();
        store.emitAll();

        expect(callbackCount).toBe(0);
        jasmine.clock().tick(100);
        expect(callbackCount).toBe(1);
    });

    it('Callback throttling validation', () => {
        let store = new BraindeadStore(100, false);
        let store2 = new BraindeadStore(0, false);
        let callbackCount = 0;
        const subCallback = (keys?: string[]): void => {
            expect(keys).toEqual(['abc', 'def']);
            callbackCount++;
        };

        store.subscribe(subCallback, store.Key_Something);
        store.subscribe(subCallback, store.Key_Something2);
        store.subscribe(subCallback);
        store2.subscribe(subCallback);
        expect(callbackCount).toBe(0);

        // This second emit should callback subCallback right away since its not throttled
        store.emitSomethings();
        store2.emitSomething();
        expect(callbackCount).toBe(1);

        // At this point the throttled store has no need to trigger since the callback has already been called
        jasmine.clock().tick(200);
        expect(callbackCount).toBe(1);
    });

    it('Trigger stack overflow test', () => {
        // Test an insane amount of trigger keys so we don't end up with a stack overflow
        let store = new TriggerableStore();
        let callbackCalled = false;
        const subCallback = (keys?: string[]): void => {
            expect(keys!!!.length).toEqual(150001);
            callbackCalled = true;
        };

        store.subscribe(subCallback);

        StoreBase.pushTriggerBlock();
        store.emit(['foo']);
        let keysToTrigger: string[] = [];
        for (let i = 0; i < 150000; i++) {
            keysToTrigger.push(i.toString());
        }
        store.emit(keysToTrigger);
        StoreBase.popTriggerBlock();

        expect(callbackCalled).toBeTruthy();
    });
});
