/**
 * AutoSubscribeTests.ts
 * Author: Mark Davis
 * Copyright: Microsoft 2016
 *
 * Tests auto-subscription behavior and provides an example for how to use auto-subscriptions in a store/component.
 */

import assert = require('assert');
import _ = require('lodash');
import React = require('react');
import TestUtils = require('react-addons-test-utils');

import ComponentBase from '../src/ComponentBase';
import { AutoSubscribeStore, autoSubscribe, disableWarnings, key, warnIfAutoSubscribeEnabled } from '../src/AutoSubscriptions';
import { StoreBase } from '../src/StoreBase';

// ----------------------------------------------------------------------------
// Store definition that uses auto-subscriptions.

// Data held by the store.
type StoreData = number;

// Needs class decorator to support auto-subscriptions.
@AutoSubscribeStore
class SimpleStore extends StoreBase {
    private _storeDataById: { [id: string]: StoreData } = {};

    // Auto-subscribes to Key_All (by default) since any change will affect the returned data.
    // Note: using the dangerous*Mutable convention since the returned data is not a copy.
    @autoSubscribe
    dangerousGetAllStoreDataMutable() {
        return this._storeDataById;
    }

    // Auto-subscribes to the key given by 'id' (note: @key decorator on 'id') since only changes on that 'id' affects
    // the returned data.
    @autoSubscribe
    getStoreData(@key id: string) {
        return this._get(id);
    }

    // Setters should not be called when auto-subscribe is enabled.
    // Note: @warnIfAutoSubscribeEnabled is automatically added (in debug mode) to any method missing @autoSubscribe
    // or @disableWarnings. That will catch the case where setters are called in a _buildState.
    clearStoreData() {
        this._storeDataById = {};
    }

    // Note: explicitly adding decorator so the tests always works, even outside of debug mode. This is not necessary
    // in real stores, as explained above clearStoreData.
    @warnIfAutoSubscribeEnabled
    setStoreData(id: string, storeData: StoreData) {
        const old = this._storeDataById[id];
        this._storeDataById[id] = storeData;

        if (!_.isEqual(old, storeData)) {
            this.trigger(id);
        }
    }

    // Internal methods to StoreBase are safe to call regardless of auto-subscribe, so disable any warnings.
    @disableWarnings
    protected _getSubscriptionKeys() {
        const keys = super._getSubscriptionKeys();
        assert.deepEqual(keys, _.uniq(keys), 'Internal failure: StoreBase should not report duplicate keys');
        return keys;
    }

    // No need to decorate private methods with @autoSubscribe or @disableWarnings. If auto-subscriptions are enabled
    // (e.g. from the _buildState of some component) then we can only reach here by being called from other public
    // methods (e.g. getStoreData), or protected methods on StoreBase. Thus only public/protected methods need the
    // appropriate decorator.
    // Note: @warnIfAutoSubscribeEnabled is automatically added (in debug mode) to this method, but that decorator does
    // nothing if another decorated method is calling this one (e.g. getStoreData).
    private _get(id: string) {
        return this._storeDataById[id];
    }

    // Note: using test_* convention since it is only used for testing and breaks good practice otherwise.
    test_getSubscriptionKeys() {
        return this._getSubscriptionKeys();
    }
}

// Instance of the SimpleStore used throughout the test. Re-created for each test.
let SimpleStoreInstance: SimpleStore;

// Keys used in tests with special meanings that should not be used as string literals. In the typical case, use single
// letter strings for other keys, mainly the ones in initialStoreDatas.
const keys = {
    // The store does not start with data for this id, but might get some in the future.
    missing: 'missing',
    // The store has this key from the start, but components never ask for it (i.e. auto-subscribe to it) directly.
    // Thus, changes to this key will cause _buildState to be called iff a component is subscribed to Key_All.
    not_in_ids: '!ids',
    // Updated in _buildState to cause a warning.
    warn_in_build_state: 'build'
};

// Holds the next new unique StoreData value.
let uniqStoreDataValue = 1;

// Id and StoreData initially in the store (populated before each test).
const initialStoreDatas: { [id: string]: StoreData } = {
    [keys.not_in_ids]: uniqStoreDataValue++,
    // Do not include [key_missing] here.
    'a': uniqStoreDataValue++,
    'b': uniqStoreDataValue++,
    'c': uniqStoreDataValue++,
    'd': uniqStoreDataValue++,
    'e': uniqStoreDataValue++
};

// ----------------------------------------------------------------------------
// Component that make use of auto-subscriptions via SimpleStore.

// Props for component. Should extend CommonProps to get 'key', 'refs', etc.
interface SimpleProps extends React.Props<any> {
    // Will use SimpleStore to get 'StoreData' for each id, and put the result in state.
    ids: string[];
    // Test implementation detail: makes sure to use a method that auto-subscribes to Key_All, and use it before
    // anything else.
    test_useAll?: boolean;
    // Test implementation detail: makes sure to use a method that will cause a warning (e.g. a setter).
    test_causeWarning?: boolean;
}

// State for component. Could use 'Stateless' if component has no state.
interface SimpleState {
    storeDatas?: StoreData[];
    stateChanges?: number;
}

class SimpleComponent extends ComponentBase<SimpleProps, SimpleState> {

    // Note: _buildState is called from ComponentBase's constructor, when props change, and when a store triggers
    // for which this component is subscribed (e.g. SimpleStore).

    // Auto-subscriptions are enabled in _buildState due to ComponentBase.
    protected _buildState(props: SimpleProps, initialBuild: boolean): SimpleState {
        if (props.test_useAll) {
            // Auto-subscribes to Key_All, even though we do not use the returned data.
            // Note: this line of code is an anit-pattern. Use explicit subscriptions (_initStoreSubscriptions()) instead.
            SimpleStoreInstance.dangerousGetAllStoreDataMutable();
        }
        if (props.test_causeWarning) {
            // Should cause a warning since setters are not allowed when auto-subscriptions are enabled.
            SimpleStoreInstance.setStoreData(keys.warn_in_build_state, uniqStoreDataValue++);
        }

        const newState: SimpleState = {
            storeDatas: _.map(props.ids, id => SimpleStoreInstance.getStoreData(id)),
            stateChanges: initialBuild ? 1 : this.state.stateChanges + 1
        };
        return newState;
    }

    render() {
        return <div>Not testing render...</div>;
    }
}

// ----------------------------------------------------------------------------
// Tests for auto-subscriptions.
// Note: if an 'internal check' fails then the problem might be in the unit test itself, or in some other file.

describe('AutoSubscribeTests', function () {
    // Makes a new SimpleComponent and performs some internal checks.
    function makeComponent(props: SimpleProps): SimpleComponent {
        // Make the component, calling _buildState in the constructor.
        const component = TestUtils.renderIntoDocument<SimpleProps>(<SimpleComponent { ...props } />) as SimpleComponent;

        // Internal check: state should have one change.
        assert.deepEqual(component.state.stateChanges, 1, 'Internal failure: state should have one change');

        // Internal check: state should have one StoreData per id in props.ids.
        assert.deepEqual(component.state.storeDatas.length, props.ids.length,
            'Internal failure: state should have one StoreData per id in props.ids');

        // Internal check: state should have up-to-date StoreDatas held in the store.
        // Note: this might not be true in general, but only using auto-subscriptions should have that behavior.
        const storeDatasFromStore = _.map(props.ids, id => SimpleStoreInstance.getStoreData(id));
        assert.deepEqual(component.state.storeDatas.sort(), storeDatasFromStore.sort(),
            'Internal failure: state should have up-to-date StoreDatas');

        return component;
    }

    // The main tests for a component/store using auto-subscriptions.
    function testSubscriptions(component: SimpleComponent): void {
        // Store should now have subscriptions. There were none at the start of the test, so they all came from this
        // component. If subscribed to Key_All, there should be one subscription. Otherwise, one per id in props.ids.

        const subscriptionKeys = SimpleStoreInstance.test_getSubscriptionKeys();

        if (component.props.test_useAll) {
            // The one and only subscription is to Key_All.
            assert.deepEqual(subscriptionKeys.length, 1, 'Should only have one subscription');
            assert.deepEqual(subscriptionKeys[0], StoreBase.Key_All, 'Should be subscribed to Key_All');
        } else {
            // Should be subscribed to each id in props.id, even if id is not in store._storeDataById currently
            // (e.g. keys.missing).
            assert.deepEqual(subscriptionKeys.sort(), _.uniq(component.props.ids).sort(), 'Should be subscribed to each id in props.id');
            // Should not be subscribed to Key_All if subscribed to other keys.
            // Note: this might not be true in general, especially if there are explicit subscriptions.
            assert.ok(!_.includes(subscriptionKeys, StoreBase.Key_All), 'Should not be subscribed to Key_All (in this case)');
        }

        // Auto-subscriptions should check for an existing subscription before adding a new one, thus there should
        // never be more than one auto-subscription for a key (per component).
        _.each(SimpleStoreInstance.test_getAutoSubscriptions(), (subs, key) => {
            assert.deepEqual(subs.length, 1, 'Should only have one auto-subscription callback');
        });
        assert.ok(_.isEmpty(SimpleStoreInstance.test_getSubscriptions()), 'Should have no explicit subscriptions');
    }

    // Tests if a change in the store causes the component to re-build its state, or not re-build if
    // doesNotAffectComponent is true.
    function testSubscriptionChange(component: SimpleComponent, idToChange: string, newValue: StoreData,
            doesNotAffectComponent = false): void {

        // Hold onto the current state before the store changes.
        const oldState = _.cloneDeep(component.state);

        // Trigger a change in the store.
        SimpleStoreInstance.setStoreData(idToChange, newValue);

        if (doesNotAffectComponent) {
            // There should be no change in the component.
            // Note: this will fail if _buildState was called because state.stateChanges always updates.
            assert.deepEqual(component.state, oldState, 'There should be no change in the component');
        } else {
            // Component state should change.
            assert.deepEqual(component.state.stateChanges, oldState.stateChanges + 1, 'Component state should have changed');
        }

        // Component state should have the up-to-date StoreDatas held in the store.
        // Note: even if doesNotAffectComponent is true, this assert.on is still valid.
        const storeDatasFromStore = _.map(component.props.ids, id => SimpleStoreInstance.getStoreData(id));
        assert.deepEqual(component.state.storeDatas.sort(), storeDatasFromStore.sort(),
            'Component state should have the up-to-date StoreDatas');

        // Re-run the subscription tests.
        testSubscriptions(component);
    }

    beforeEach(() => {
        // Create a new store with zero subscriptions.
        SimpleStoreInstance = new SimpleStore();
        // Populate the store with some data.
        _.each(initialStoreDatas, (value, id) => {
            SimpleStoreInstance.setStoreData(id, value);
        });

        // Internal check: the store should have no subscriptions.
        assert.deepEqual(SimpleStoreInstance.test_getSubscriptionKeys().length, 0,
            'Internal failure: the store should have no subscriptions');
    });

    // ------------------------------------------------------------------------
    // Unit tests. Most of the logic is above.

    it('Auto-subscribe on id', () => {
        const component = makeComponent({ ids: ['a'] });
        testSubscriptions(component);
    });

    it('Auto-subscribe on multiple ids', () => {
        const component = makeComponent({ ids: ['a', 'b', 'c', 'd', 'e'] });
        testSubscriptions(component);
    });

    it('Auto-subscribe subscribes once per unique id', () => {
        const component = makeComponent({ ids: ['a', 'a', 'b', 'b'], test_useAll: true });
        testSubscriptions(component);
    });

    it('Auto-subscribe on id not already in store', () => {
        const component = makeComponent({ ids: [keys.missing] });
        testSubscriptions(component);
    });

    it('Auto-subscribe on Key_All', () => {
        const component = makeComponent({ ids: ['a', 'b'], test_useAll: true });
        testSubscriptions(component);
    });

    it('Auto-subscribe warns if setter is called in _buildState', () => {
        try {
            makeComponent({ ids: ['a'], test_causeWarning: true });
            assert.ok(false, 'Auto-subscription should have warned');
        } catch (e) {
            assert.ok(e.message, 'No exception message');
            assert.notDeepEqual(e.message.indexOf('@'), -1, 'Exception should be for auto-subscription, not something else');
            // Success: it warned.
        }
    });

    it('Auto-subscribe triggers _buildState on change', () => {
        const id = 'a';
        const component = makeComponent({ ids: [id] });
        testSubscriptions(component);
        testSubscriptionChange(component, id, uniqStoreDataValue++);
    });

    it('Auto-subscribe triggers _buildState on change multiple times', () => {
        const id1 = 'a';
        const id2 = 'b';
        const component = makeComponent({ ids: [id1, id2] });
        testSubscriptions(component);
        testSubscriptionChange(component, id1, uniqStoreDataValue++);
        // Make another change on the same id.
        testSubscriptionChange(component, id1, uniqStoreDataValue++);
        // Make another change on a different id.
        testSubscriptionChange(component, id2, uniqStoreDataValue++);
    });

    it('Auto-subscribe does NOT trigger _buildState on change to other id', () => {
        const component = makeComponent({ ids: ['a'] });
        testSubscriptions(component);
        testSubscriptionChange(component, keys.not_in_ids, uniqStoreDataValue++, /* doesNotAffectComponent */ true);
    });

    it('Auto-subscribe triggers _buildState on change to any id when subscribed to Key_All', () => {
        const component = makeComponent({ ids: ['a'], test_useAll: true });
        testSubscriptions(component);
        testSubscriptionChange(component, keys.not_in_ids, uniqStoreDataValue++);
    });

    it('Auto-subscribe triggers _buildState on change to id not initially in store', () => {
        // Tests a common case where some component is waiting for data the store does not already have, then the store
        // leter gets it and the component should update.

        const id = keys.missing;
        const component = makeComponent({ ids: [id] });
        testSubscriptions(component);
        // Component should only be subscribed to 'id' (i.e. not Key_All), so it should ignore keys.not_in_ids.
        testSubscriptionChange(component, keys.not_in_ids, uniqStoreDataValue++, /* doesNotAffectComponent */ true);
        // Add the missing data.
        testSubscriptionChange(component, id, uniqStoreDataValue++);
    });

    it('Auto-subscribe reuses subscription object', () => {
        // Tests a common case where some component is waiting for data the store does not already have, then the store
        // leter gets it and the component should update.
        const id1 = 'a';
        const id2 = 'b';
        const id3 = 'c';
        const component = makeComponent({ ids: [id1, id2, id2, id3, id3, id3] });
        testSubscriptions(component);
        const initialSubscriptions = _.clone(SimpleStoreInstance.test_getAutoSubscriptions());
        testSubscriptionChange(component, id1, uniqStoreDataValue++);
        testSubscriptionChange(component, id2, uniqStoreDataValue++);
        testSubscriptionChange(component, id2, uniqStoreDataValue++);
        testSubscriptionChange(component, id1, uniqStoreDataValue++);
        testSubscriptionChange(component, id3, uniqStoreDataValue++);
        testSubscriptionChange(component, id3, uniqStoreDataValue++);
        const updatedSubscriptions = SimpleStoreInstance.test_getAutoSubscriptions();
        assert.deepEqual(_.sortBy(_.keys(updatedSubscriptions), key => key), _.sortBy(_.keys(updatedSubscriptions),
            key => key), 'The set of auto-subscriptions changed');
        _.each(updatedSubscriptions, (subs, key) => {
            assert.equal(initialSubscriptions[key], subs, 'Auto-subscription was not re-used');
        });
    });
});
