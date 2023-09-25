/**
 * AutoSubscribe.spec.ts
 * Author: Mark Davis
 * Copyright: Microsoft 2016
 *
 * Tests auto-subscription behavior and provides an example for how to use auto-subscriptions in a store/component.
 */

import * as React from 'react';
// eslint-disable-next-line
import { ReactElement } from 'react';
import {
    includes,
    cloneDeep,
    clone,
    each,
    uniq,
} from 'lodash';
import { act } from 'react-dom/test-utils';
import { mount, ReactWrapper, shallow } from 'enzyme';

import { withResubAutoSubscriptions } from '../src/AutoSubscriptions';
import ComponentBase from '../src/ComponentBase';
import { StoreBase } from '../src/StoreBase';
import { formCompoundKey } from '../src/utils';

import { SimpleStore, TriggerKeys, StoreData } from './SimpleStore';

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
    'e': uniqStoreDataValue++,
};

const initialExpectedState = 1;

// ----------------------------------------------------------------------------
// Component that make use of auto-subscriptions via SimpleStore.

// Props for component. Should extend CommonProps to get 'key', 'refs', etc.
interface SimpleProps extends React.Props<any> {
    // Will use SimpleStore to get 'StoreData' for each id, and put the result in state.
    ids: string[];
    // Test implementation detail: makes sure to use a method that auto-subscribes to Key_All, and use it before
    // anything else.
    test_useAll?: boolean;
    // Test implementation detail: set to test key'd subscriptins
    test_keyedSub?: boolean;
    // Test implementation detail: set to test enum key'd subscriptins
    test_enumKeyedSub?: boolean;
    // Test implementation detail: set to test compound key subscriptions
    test_compoundSingleKeySub?: boolean;
    test_compoundMultiKeySub?: boolean;
    // Don't bother subbing to each individual id
    test_skipIndividualIds?: boolean;
}

// State for component. Could use 'Stateless' if component has no state.
interface SimpleState {
    storeDatas: StoreData[];
    stateChanges: number;
    keyedDataSum: number;
}

class SimpleComponent extends ComponentBase<SimpleProps, SimpleState> {
    // Note: _buildState is called from ComponentBase's constructor, when props change, and when a store triggers
    // for which this component is subscribed (e.g. SimpleStore).
    buildStateCallCount = 0;

    // Auto-subscriptions are enabled in _buildState due to ComponentBase.
    protected _buildState(props: SimpleProps, initialBuild: boolean): Partial<SimpleState> {
        this.buildStateCallCount++;
        const newState: Partial<SimpleState> = {
            keyedDataSum: 0,
        };

        if (props.test_useAll) {
            // Auto-subscribes to Key_All, even though we do not use the returned data.
            // Note: this line of code is an anit-pattern but useful for tests
            SimpleStoreInstance.dangerousGetAllStoreDataMutable();
        }

        if (props.test_keyedSub) {
            newState.keyedDataSum = SimpleStoreInstance.getDataSingleKeyed() + SimpleStoreInstance.getDataMultiKeyed();
        } else if (props.test_enumKeyedSub) {
            newState.keyedDataSum = SimpleStoreInstance.getDataSingleEnumKeyed() + SimpleStoreInstance.getDataMultiEnumKeyed();
        } else if (props.test_compoundSingleKeySub) {
            newState.keyedDataSum = SimpleStoreInstance.getSingleKeySingleAutoSubKey(props.ids[0]) +
                SimpleStoreInstance.getSingleKeyMultiAutoSubKey(props.ids[0]);
        } else if (props.test_compoundMultiKeySub) {
            newState.keyedDataSum = SimpleStoreInstance.getMultiKeyNoAutoSubKey(props.ids[0], props.ids[1]) +
                SimpleStoreInstance.getMultiKeySingleAutoSubKey(props.ids[0], props.ids[1]) +
                SimpleStoreInstance.getMultiKeyMultiAutoSubKey(props.ids[0], props.ids[1]);
        }

        if (!props.test_skipIndividualIds) {
            newState.storeDatas = props.ids.map(id => SimpleStoreInstance.getStoreData(id));
        }
        newState.stateChanges = initialBuild ? 1 : this.state.stateChanges + 1;
        return newState;
    }

    render(): ReactElement<any> {
        return (
            <div>Not testing render...</div>
        );
    }
}

class OverriddenComponent extends SimpleComponent {

    protected _buildState(props: SimpleProps, initialBuild: boolean): Partial<SimpleState> {
        return super._buildState(props, initialBuild);
    }

    static makeComponent(props: SimpleProps): ReactWrapper<SimpleProps, SimpleState, OverriddenComponent> {
        return mount(<OverriddenComponent { ...props } />);
    }

    static getDerivedStateFromProps: React.GetDerivedStateFromProps<unknown, unknown> = (props, state) =>
        ComponentBase.getDerivedStateFromProps(props, state);
}

/**
 * Tests for auto-subscriptions.
 * Note: if an 'internal check' fails then the problem might be in the unit test itself, or in some other file.
 */

// Makes a new SimpleComponent and performs some internal checks.
function makeComponent(props: SimpleProps): ReactWrapper<SimpleProps, SimpleState, SimpleComponent> {
    // Make the component, calling _buildState in the constructor.
    const Component: ReactWrapper<SimpleProps, SimpleState, SimpleComponent> = mount(<SimpleComponent { ...props } />);
    const {
        stateChanges,
        storeDatas,
    } = Component.state();

    // Internal check: state should have two changes (including instanceId).
    expect(stateChanges).toEqual(1);
    expect(Component.instance().buildStateCallCount).toEqual(1);

    // Internal check: state should have one StoreData per id in props.ids.
    if (!props.test_skipIndividualIds) {
        expect(storeDatas.length).toEqual(props.ids.length);

        // Internal check: state should have up-to-date StoreDatas held in the store.
        // Note: this might not be true in general, but only using auto-subscriptions should have that behavior.
        expect(storeDatas.sort()).toEqual(
            props.ids.map(id => SimpleStoreInstance.getStoreData(id)),
        );
    }

    return Component;
}

// The main tests for a component/store using auto-subscriptions.
function testSubscriptions(Component: ReactWrapper<SimpleProps, SimpleState, SimpleComponent>): void {
    // Store should now have subscriptions. There were none at the start of the test, so they all came from this
    // component. If subscribed to Key_All, there should be one subscription. Otherwise, one per id in props.ids.
    const subscriptionKeys = SimpleStoreInstance.test_getSubscriptionKeys();

    if (Component.prop('test_useAll')) {
        // The one and only subscription is to Key_All.
        expect(subscriptionKeys.length).toEqual(1);
        expect(subscriptionKeys[0]).toEqual(StoreBase.Key_All);
    } else {
        /**
         * Should be subscribed to each id in props.id, even if id is not in store._storeDataById currently
         * (e.g. keys.missing).
         */
        expect(subscriptionKeys.sort()).toEqual(uniq<string>(Component.prop('ids')).sort());

        /**
         * Should not be subscribed to Key_All if subscribed to other keys.
         * Note: this might not be true in general, especially if there are explicit subscriptions.
         */
        expect(includes(subscriptionKeys, StoreBase.Key_All)).toBeFalsy();
    }

    /**
     *
     * Auto-subscriptions should check for an existing subscription before adding a new one,
     * thus there should never be more than one auto-subscription for a key (per component).
     */
    each(SimpleStoreInstance.test_getAutoSubscriptions(), (subs, key) => (
        expect(subs.length).toEqual(1)
    ));

    expect(
        Object.keys(SimpleStoreInstance.test_getSubscriptions().length === 0),
    ).toBeTruthy();
}

// Tests if a change in the store causes the component to re-build its state, or not re-build if
// doesNotAffectComponent is true.
function testSubscriptionChange(Component: ReactWrapper<SimpleProps, SimpleState, SimpleComponent>, idToChange: string, newValue: StoreData,
        doesNotAffectComponent = false): void {

    // Hold onto the current state before the store changes.
    const oldState = cloneDeep(Component.state());

    // Trigger a change in the store.
    act(() => {
        SimpleStoreInstance.setStoreData(idToChange, idToChange, newValue);
    });

    if (doesNotAffectComponent) {
        /**
         * There should be no change in the component.
         * Note: this will fail if _buildState was called because state.stateChanges always updates.
         */
        expect(Component.state()).toEqual(oldState);
    } else {
        // Component state should change.
        expect(Component.state('stateChanges')).toEqual(oldState.stateChanges + 1);
        expect(Component.instance().buildStateCallCount).toEqual(oldState.stateChanges + 1);
    }

    /**
     * Component state should have the up-to-date StoreDatas held in the store.
     * Note: even if doesNotAffectComponent is true, this assert.on is still valid.
     */
    expect(Component.state('storeDatas').sort()).toEqual(
        Component.prop('ids')
            .map((id: string) => SimpleStoreInstance.getStoreData(id)).sort(),
    );

    // Re-run the subscription tests.
    testSubscriptions(Component);
}

function runTests(makeComponent: (props: SimpleProps) => ReactWrapper<SimpleProps, SimpleState, SimpleComponent>): any {
    it('Auto-subscribe on id', () => {
        const Component = makeComponent({ ids: ['a'] });
        testSubscriptions(Component);
    });

    it('Auto-subscribe on multiple ids', () => {
        const Component = makeComponent({ ids: ['a', 'b', 'c', 'd', 'e'] });
        testSubscriptions(Component);
    });

    it('Auto-subscribe subscribes once per unique id', () => {
        const Component = makeComponent({ ids: ['a', 'a', 'b', 'b'], test_useAll: true });
        testSubscriptions(Component);
    });

    it('Auto-subscribe on id not already in store', () => {
        const Component = makeComponent({ ids: [keys.missing] });
        testSubscriptions(Component);
    });

    it('Auto-subscribe on Key_All', () => {
        const Component = makeComponent({ ids: ['a', 'b'], test_useAll: true });
        testSubscriptions(Component);
    });

    it('Auto-subscribe triggers _buildState on change', () => {
        const id = 'a';
        const Component = makeComponent({ ids: [id] });

        testSubscriptions(Component);
        testSubscriptionChange(Component, id, uniqStoreDataValue++);
    });

    it('Auto-subscribe triggers _buildState on change multiple times', () => {
        const id1 = 'a';
        const id2 = 'b';
        const Component = makeComponent({ ids: [id1, id2] });

        testSubscriptions(Component);
        testSubscriptionChange(Component, id1, uniqStoreDataValue++);

        // Make another change on the same id.
        testSubscriptionChange(Component, id1, uniqStoreDataValue++);

        // Make another change on a different id.
        testSubscriptionChange(Component, id2, uniqStoreDataValue++);
    });

    it('Auto-subscribe does NOT trigger _buildState on change to other id', () => {
        const Component = makeComponent({ ids: ['a'] });
        testSubscriptions(Component);
        testSubscriptionChange(Component, keys.not_in_ids, uniqStoreDataValue++, /* doesNotAffectComponent */ true);
    });

    it('Auto-subscribe triggers _buildState on change to any id when subscribed to Key_All', () => {
        const Component = makeComponent({ ids: ['a'], test_useAll: true });
        testSubscriptions(Component);
        testSubscriptionChange(Component, keys.not_in_ids, uniqStoreDataValue++);
    });

    it('Auto-subscribe triggers _buildState on change to id not initially in store', () => {
        /**
         * Tests a common case where some component is waiting for data the store does not already have, then the store
         * leter gets it and the component should update.
         */
        const id = keys.missing;
        const Component = makeComponent({ ids: [id] });
        testSubscriptions(Component);

        // Component should only be subscribed to 'id' (i.e. not Key_All), so it should ignore keys.not_in_ids.
        testSubscriptionChange(Component, keys.not_in_ids, uniqStoreDataValue++, /* doesNotAffectComponent */ true);

        // Add the missing data.
        testSubscriptionChange(Component, id, uniqStoreDataValue++);
    });

    it('Auto-subscribe reuses subscription object', () => {
        /**
         * Tests a common case where some component is waiting for data the store does not already have, then the store
         * leter gets it and the component should update.
         */
        const id1 = 'a';
        const id2 = 'b';
        const id3 = 'c';
        const Component = makeComponent({ ids: [id1, id2, id2, id3, id3, id3] });
        testSubscriptions(Component);

        const initialSubscriptions = clone(SimpleStoreInstance.test_getAutoSubscriptions());
        testSubscriptionChange(Component, id1, uniqStoreDataValue++);
        testSubscriptionChange(Component, id2, uniqStoreDataValue++);
        testSubscriptionChange(Component, id2, uniqStoreDataValue++);
        testSubscriptionChange(Component, id1, uniqStoreDataValue++);
        testSubscriptionChange(Component, id3, uniqStoreDataValue++);
        testSubscriptionChange(Component, id3, uniqStoreDataValue++);

        const updatedSubscriptions = SimpleStoreInstance.test_getAutoSubscriptions();
        each(updatedSubscriptions, (subs, key) => (
            expect(initialSubscriptions[key]).toEqual(subs)
        ));
    });

    it('autoSubscribeWithKey triggers _buildState on change', () => {
        let expectedState = initialExpectedState;
        const Component = makeComponent({ test_keyedSub: true, ids: [] });

        /**
         * State change should have changed
         * Expected Sum should be different
         */
        act(() => {
            SimpleStoreInstance.setStoreDataForKeyedSubscription('A', 1);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(2);

        act(() => {
            SimpleStoreInstance.setStoreDataForKeyedSubscription('B', 7);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(9);

        act(() => {
            SimpleStoreInstance.setStoreDataForKeyedSubscription('A', 3);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(13);

        // Showing that you can't use a compound key as a multi-trigger
        act(() => {
            SimpleStoreInstance.triggerArbitraryKey(formCompoundKey('A', 'B'));
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
    });

    it('autoSubscribeWithKey does not trigger _buildState on other subscription change', () => {
        const expectedState = initialExpectedState;
        SimpleStoreInstance.setStoreDataForKeyedSubscription('A', 1);
        SimpleStoreInstance.setStoreDataForKeyedSubscription('B', 7);
        const Component = makeComponent({ test_keyedSub: true, ids: [] });

        act(() => {
            SimpleStoreInstance.setStoreData('foo', 'foo', 77);
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(9);

        // Showing that you can't use a compound key as a multi-trigger either
        act(() => {
            SimpleStoreInstance.triggerArbitraryKey(formCompoundKey('A', 'B'));
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
    });

    it('autoSubscribeWithKey - test Enum Keyed Subscriptions', () => {
        let expectedState = initialExpectedState;
        const Component = makeComponent({ test_enumKeyedSub: true, ids: [] });

        act(() => {
            SimpleStoreInstance.setStoreDataForEnumKeyedSubscription(TriggerKeys.First, 1);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(2);

        act(() => {
            SimpleStoreInstance.setStoreDataForEnumKeyedSubscription(TriggerKeys.Second, 7);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(9);

        act(() => {
            SimpleStoreInstance.setStoreDataForEnumKeyedSubscription(TriggerKeys.First, 3);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(13);
    });

    it('autoSubscribeWithKey and key - test single-@key compound key Subscriptions', () => {
        let expectedState = initialExpectedState;
        const Component = makeComponent({ test_compoundSingleKeySub: true, test_skipIndividualIds: true, ids: ['a'] });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(4);

        act(() => {
            SimpleStoreInstance.setStoreDataForCompoundEnumKeyedSubscription(['a'], TriggerKeys.First, 1);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(6);

        act(() => {
            SimpleStoreInstance.setStoreDataForCompoundEnumKeyedSubscription(['a'], TriggerKeys.Second, 1);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(7);

        act(() => {
            SimpleStoreInstance.setStoreData('a', formCompoundKey('a', TriggerKeys.First), 1);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(5);

        // This will still trigger a single state update, but will change nothing
        act(() => {
            SimpleStoreInstance.triggerArbitraryKey(undefined);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(5);

        // None of these keys should trigger any subscription changes
        act(() => {
            SimpleStoreInstance.setStoreData('a', 'a', 1);
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        act(() => {
            SimpleStoreInstance.setStoreData('a', 'b', 1);
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        act(() => {
            SimpleStoreInstance.setStoreData('a', TriggerKeys.First.toString(), 1);
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);

        // Triggering keys out of order also shouldn't work
        act(() => {
            SimpleStoreInstance.setStoreData('a', formCompoundKey(TriggerKeys.First, 'a'), 1);
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
    });

    it('autoSubscribeWithKey and key - test multi-@key compound key Subscriptions', () => {
        let expectedState = initialExpectedState;
        const Component = makeComponent({ test_compoundMultiKeySub: true, test_skipIndividualIds: true, ids: ['a', 'b'] });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(15);

        act(() => {
            SimpleStoreInstance.setStoreDataForCompoundEnumKeyedSubscription(['a', 'b'], TriggerKeys.First, 1);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(17);

        act(() => {
            SimpleStoreInstance.setStoreDataForCompoundEnumKeyedSubscription(['a', 'b'], TriggerKeys.Second, 1);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(18);

        act(() => {
            SimpleStoreInstance.setStoreData('a', formCompoundKey('a', 'b', TriggerKeys.First), 1);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(15);

        // Catch the other subscription (not very useful, but it exists)
        act(() => {
            SimpleStoreInstance.setStoreData('a', formCompoundKey('a', 'b'), 2);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(18);

        // This will still trigger a single state update, but will change nothing
        act(() => {
            SimpleStoreInstance.triggerArbitraryKey(undefined);
        });
        expect(Component.state('stateChanges')).toEqual(++expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        expect(Component.state('keyedDataSum')).toEqual(18);

        // None of these keys should trigger any subscription changes
        act(() => {
            SimpleStoreInstance.setStoreData('a', 'a', 1);
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        act(() => {
            SimpleStoreInstance.setStoreData('a', 'b', 1);
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        act(() => {
            SimpleStoreInstance.setStoreData('a', TriggerKeys.First.toString(), 1);
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);

        // Triggering keys out of order also shouldn't work
        act(() => {
            SimpleStoreInstance.setStoreData('a', formCompoundKey('b', 'a'), 1);
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        act(() => {
            SimpleStoreInstance.setStoreData('a', formCompoundKey('b', 'a', TriggerKeys.First), 1);
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
        act(() => {
            SimpleStoreInstance.setStoreData('a', formCompoundKey(TriggerKeys.First, 'a', 'b'), 1);
        });
        expect(Component.state('stateChanges')).toEqual(expectedState);
        expect(Component.instance().buildStateCallCount).toEqual(expectedState);
    });

    it('Manual Subscription triggers', () => {
        const subToken1 = SimpleStoreInstance.subscribe(keys => {
            expect(keys).toEqual([TriggerKeys.First.toString()]);
            SimpleStoreInstance.unsubscribe(subToken1);
        });
        SimpleStoreInstance.setStoreDataForEnumKeyedSubscription(TriggerKeys.First, 1);

        const subToken2 = SimpleStoreInstance.subscribe(keys => {
            expect(keys).toEqual([TriggerKeys.Second.toString()]);
            SimpleStoreInstance.unsubscribe(subToken2);
        });
        SimpleStoreInstance.setStoreDataForEnumKeyedSubscription(TriggerKeys.Second, 1);

        const subToken3 = SimpleStoreInstance.subscribe(keys => {
            expect(keys).toEqual([formCompoundKey('a', 'b')]);
            SimpleStoreInstance.unsubscribe(subToken3);
        });
        SimpleStoreInstance.triggerArbitraryKey(formCompoundKey('a', 'b'));
    });
}

describe('derivedStateFromProps', function() {
    beforeEach(() => {
        // Create a new store with zero subscriptions.
        SimpleStoreInstance = new SimpleStore();

        // Populate the store with some data.
        each(initialStoreDatas, (value, id) => SimpleStoreInstance.setStoreData(id, id, value));

        // Internal check: the store should have no subscriptions.
        expect(SimpleStoreInstance.test_getSubscriptionKeys().length).toEqual(0);
    });

    runTests(OverriddenComponent.makeComponent);
});

describe('AutoSubscribe', function() {
    beforeEach(() => {
        // Create a new store with zero subscriptions.
        SimpleStoreInstance = new SimpleStore();

        // Populate the store with some data.
        each(initialStoreDatas, (value, id) => SimpleStoreInstance.setStoreData(id, id, value));

        // Internal check: the store should have no subscriptions.
        expect(SimpleStoreInstance.test_getSubscriptionKeys().length).toEqual(0);
    });

    runTests(makeComponent);

    it('Test hook system', function() {
        SimpleStoreInstance = new SimpleStore();

        let numCalls = 0;
        function FuncComp(): JSX.Element {
            numCalls++;
            const val = SimpleStoreInstance.getDataSingleKeyed();
            return <>{ val.toString() }</>;
        }
        const WrappedFuncComp = withResubAutoSubscriptions(FuncComp);

        expect(numCalls).toEqual(0);
        const container = mount(<WrappedFuncComp />);
        expect(numCalls).toEqual(1);
        expect(container.text()).toEqual('0');
        expect(SimpleStoreInstance.test_getSubscriptions().get('A').length).toEqual(1);
        act(() => {
            SimpleStoreInstance.setStoreDataForKeyedSubscription('A', 3);
        });
        expect(numCalls).toEqual(2);
        container.update();
        expect(numCalls).toEqual(2);
        expect(container.text()).toEqual('3');
        container.unmount();
        expect(SimpleStoreInstance.test_getSubscriptions().has('A')).toEqual(false);
    });

    it('Throw when called from render function without wrapping', function() {
        SimpleStoreInstance = new SimpleStore();

        function FuncComp(): JSX.Element {
            const val = SimpleStoreInstance.getDataSingleKeyed();
            return <>{ val.toString() }</>;
        }

        // This awkward method of testing suggested by https://github.com/enzymejs/enzyme/issues/1255 and appears to work.
        expect(() => shallow(<FuncComp />)).toThrow();
    });

    it('Does not throw when called from render function with wrapping', function() {
        SimpleStoreInstance = new SimpleStore();

        function FuncComp(): JSX.Element {
            const val = SimpleStoreInstance.getDataSingleKeyed();
            return <>{ val.toString() }</>;
        }
        const WrappedFuncComp = withResubAutoSubscriptions(FuncComp);

        expect(() => shallow(<WrappedFuncComp />)).not.toThrow();
    });
});
