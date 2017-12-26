/**
 * StoreBase.spec.ts
 * Author: David de Regt
 * Copyright: Microsoft 2016
 *
 * Tests all the various expected behavior of StoreBase.
 */
import { delay } from 'lodash';
import { StoreBase } from '../src/StoreBase';

type TKeys = Array<string>|undefined;

class BraindeadStore extends StoreBase {
    Key_Something = 'abc';
    Key_Something2 = 'def';

    foundAll = false;
    allKeys: TKeys;
    allSub: number;
    foundKey = false;
    keyKeys: TKeys;
    keySub: number;

    setupSubs() {
        this.allSub = this.subscribe((keys: TKeys) => {
            this.foundAll = true;
            this.allKeys = keys;
        });

        this.keySub = this.subscribe((keys: TKeys) => {
            this.foundKey = true;
            this.keyKeys = keys;
        }, this.Key_Something);
    }

    emitAll() {
        this.trigger();
    }

    emitSomething() {
        this.trigger(this.Key_Something);
    }

    emitSomethings() {
        this.trigger([this.Key_Something, this.Key_Something2]);
    }
}

// ------------------------------------------------------------------------------------
// Tests for auto-subscriptions.
// Note: if an 'internal check' fails then the problem might be in the unit test itself,
//       or in some other file.

describe('StoreBase', function () {
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
        store.allKeys = store.keyKeys = [];

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
        store.allKeys = store.keyKeys = [];

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
        store.allKeys = [];

        // block triggers, should do nothing (triggers should still flow)
        StoreBase.pushTriggerBlock();
        store.emitAll();
        expect(store.foundAll).toBeTruthy();
        expect<TKeys>(store.allKeys).toBeUndefined();

        store.foundAll = false;
        store.allKeys = [];

        // unblock and make sure nothing pops out
        StoreBase.popTriggerBlock();
        expect(store.foundAll).toBeFalsy();
    });

    it('Timed/non-Bypass Store', (done: Function) => {
        let store = new BraindeadStore(100, false);
        store.setupSubs();

        // Try all emit -- should do nothing at the moment
        store.emitAll();
        expect(store.foundAll).toBeFalsy();

        delay(() => {
            if (store.foundAll) {
                done(false);
            }
        }, 10);

        delay(() => {
            expect(store.foundAll).toBeTruthy();
            done();
        }, 200);
    });

    it('Double Trigger w/ Unsubscribe', (done: Function) => {
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

        delay(() => {
            expect(callCount1).toEqual(1);
            expect(callCount2).toEqual(1);

            done();
        }, 100);
    });
});
