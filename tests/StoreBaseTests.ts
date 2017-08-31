/**
 * StoreBaseTests.ts
 * Author: David de Regt
 * Copyright: Microsoft 2016
 *
 * Tests all the various expected behavior of StoreBase.
 */

import assert = require('assert');
import _ = require('lodash');

import { StoreBase } from '../src/StoreBase';

class BraindeadStore extends StoreBase {
    Key_Something = 'abc';
    Key_Something2 = 'def';

    foundAll = false;
    allKeys: string[]|undefined = undefined;
    allSub: number;
    foundKey = false;
    keyKeys: string[]|undefined = undefined;
    keySub: number;

    setupSubs() {
        this.allSub = this.subscribe(keys => {
            this.foundAll = true;
            this.allKeys = keys;
        });

        this.keySub = this.subscribe(keys => {
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

// ----------------------------------------------------------------------------
// Tests for auto-subscriptions.
// Note: if an 'internal check' fails then the problem might be in the unit test itself, or in some other file.

describe('StoreBaseTests', function () {
    it('Non-timed/Non-bypass Store', () => {
        let store = new BraindeadStore(0, false);
        store.setupSubs();

        // Try all emit
        store.emitAll();
        assert.ok(store.foundAll && store.foundKey);
        assert.equal(store.allKeys, undefined);
        assert.equal(store.keyKeys, undefined);
        store.foundAll = store.foundKey = false;
        store.allKeys = store.keyKeys = undefined;

        // Try keyed emit
        store.emitSomething();
        assert.ok(_.isEqual(store.allKeys, [store.Key_Something]));
        assert.ok(_.isEqual(store.keyKeys, [store.Key_Something]));
        assert.ok(store.foundAll && store.foundKey);
        store.foundAll = store.foundKey = false;
        store.allKeys = store.keyKeys = undefined;

        // Try keyed emits
        store.emitSomethings();
        assert.ok(_.isEqual(store.allKeys, [store.Key_Something, store.Key_Something2]));
        assert.ok(_.isEqual(store.keyKeys, [store.Key_Something]));
        assert.ok(store.foundAll && store.foundKey);
        store.foundAll = store.foundKey = false;
        store.allKeys = store.keyKeys = undefined;

        // block triggers
        StoreBase.pushTriggerBlock();
        store.emitAll();
        store.emitSomething();
        store.emitSomethings();
        assert.ok(!store.foundAll && !store.foundKey);

        // unblock and make sure the dedupe logic works (should just emit undefined, since we did an all emit,
        // which overrides the keyed ones)
        StoreBase.popTriggerBlock();
        assert.ok(_.isEqual(store.allKeys, undefined));
        assert.ok(_.isEqual(store.keyKeys, undefined));
        assert.ok(store.foundAll && store.foundKey);
        store.foundAll = store.foundKey = false;
        store.allKeys = store.keyKeys = undefined;

        // Make sure unsubscribe works
        store.unsubscribe(store.allSub);
        store.emitAll();
        assert.ok(!store.foundAll && store.foundKey);
        store.foundAll = store.foundKey = false;
        store.allKeys = store.keyKeys = undefined;
        store.unsubscribe(store.keySub);
        store.emitSomething();
        assert.ok(!store.foundAll && !store.foundKey);
    });

    it('Non-timed/Bypass Store', () => {
        let store = new BraindeadStore(0, true);
        store.setupSubs();

        // Try all emit
        store.emitAll();
        assert.ok(store.foundAll);
        assert.equal(store.allKeys, undefined);
        store.foundAll = false;
        store.allKeys = undefined;

        // block triggers, should do nothing (triggers should still flow)
        StoreBase.pushTriggerBlock();
        store.emitAll();
        assert.ok(store.foundAll);
        assert.equal(store.allKeys, undefined);
        store.foundAll = false;
        store.allKeys = undefined;

        // unblock and make sure nothing pops out
        StoreBase.popTriggerBlock();
        assert.ok(!store.foundAll);
    });

    it('Timed/non-Bypass Store', (done: Function) => {
        let store = new BraindeadStore(100, false);
        store.setupSubs();

        // Try all emit -- should do nothing at the moment
        store.emitAll();
        assert.ok(!store.foundAll);

        _.delay(() => {
            if (store.foundAll) {
                done(false);
            }
        }, 10);
        _.delay(() => {
            assert.ok(store.foundAll);

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

        // Try all emit - Each subscription should the called once and the store should trigger multiple times
        store.emitAll();

        _.delay(() => {
            assert.equal(callCount1, 1);
            assert.equal(callCount2, 1);

            done();
        }, 100);
    });
});
