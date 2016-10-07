/**
* ComponentBase.ts
* Author: David de Regt
* Copyright: Microsoft 2016
*
* Base class for React components, adding in support for automatic store registration and unregistration.
*/

'use strict';

import assert = require('assert');
import _ = require('lodash');
import React = require('react');

import Options from './Options';
import { AutoSubscription, StoreBase } from './StoreBase';
import { enableAutoSubscribe, enableAutoSubscribeWrapper, forbidAutoSubscribeWrapper } from './AutoSubscriptions';
import { SubscriptionCallbackFunction, SubscriptionCallbackBuildStateFunction, StoreSubscription } from './Types';

type SubscriptionLookup<S> = { [storeId: string]: { [key: string]: { [id: number]: StoreSubscriptionInternal<S> } } };

interface StoreSubscriptionInternal<S> extends StoreSubscription<S> {
    // Re-typing it here from the base interface so that it's strongly typed
    store: StoreBase;

    // Globally unique for each subscription being handled in the components.
    _id?: number;

    // Internal value used for tracking the local callback for this subscription
    _lambda?: any;

    // The callback to be used in the _lambda, if any.
    _callback?: SubscriptionCallbackFunction | SubscriptionCallbackBuildStateFunction<S>;

    // Subscription token for unsubscribing
    _subscriptionToken: number;

    // Key's value used in above subscription (null if not subscribed)
    _subscriptionKey?: string;
}

abstract class ComponentBase<P extends React.Props<any>, S extends Object> extends React.Component<P, S> {
    // ComponentBase gives the developer a variety of helpful ways to subscribe to changes on stores.  There are two
    // main subscription types (and then ways to combine them with some options in more nuanced ways):
    // 1. Simple subscription to a store -- every single trigger from a store causes this subscription to trigger:
    //    { store: UsersStore }
    // 2. Subscription only to a specific key -- when you are only looking for specific items to update based on, you can
    //    subscribe in two ways, depending on how the key is made available:
    //    a. You can trigger on a specific fixed value -- the subscription won't change over the lifetime, it's locked to one key:
    //       { store: UsersStore, specificKeyValue: '8:codingparadox' }
    //    b. You can trigger based on a property of the component -- if your component has a property called "conversationId", you can
    //       have ComponentBase automatically update the store subscription whenever the value of that property changes:
    //       { store: UsersStore, keyPropertyName: 'conversationId' }
    //       Note: You can do compound keys here as well (i.e. 'conversation.id' if you have a property named 'conversation' with a
    //       field called 'id' that you're trying to listen on.
    //
    // You can add these subscriptions to ComponentBase in two ways:
    // 1. There is a protected _initStoreSubscriptions() array of subscriptions that you can just override in your class, and those will be
    //    managed throughout the lifecycle of the component, and torn down when the component unmounts.
    // 2. If you have a subscription that you want to bring up dynamically, you can call this._addSubscription with the subscription
    //    object.  Anything added in this way will also be turn down when the component unmounts, or you can call _removeSubscription
    //    if you want to remove it before then.
    //
    // Finally, when ComponentBase receives a subscription trigger, there are two ways for the component to respond to
    // the trigger:
    // 1. If you don't provide a callback function in the subscription, _buildState will be called, providing an opportunity to rebuild
    //    the component's state now that the stores have changed.
    // 2. You can provide a callbackBuildState (or callback) in the subscription, which will be called whenever that specific
    //    subscription is triggered. If the subscription is granular to a specific key (not Key_All), then the callback will be invoked
    //    with the specific key that was triggered as the only parameter to the function.

    private _storeSubscriptions: StoreSubscription<S>[];

    private static _nextSubscriptionId = 1;

    private _handledSubscriptions: { [id: number]: StoreSubscriptionInternal<S> } = {};
    private _handledAutoSubscriptions: AutoSubscription[] = [];

    private _handledSubscriptionsLookup: SubscriptionLookup<S> = {};

    private _isMounted = false;

    constructor(props: P) {
        super(props);

        this._storeSubscriptions = this._initStoreSubscriptions();
        this.state = this._buildStateWithAutoSubscriptions(props, true) || ({} as S);

        const derivedClassRender = this.render || _.noop;
        // No one should use Store getters in render: do that in _buildState instead.
        this.render = forbidAutoSubscribeWrapper(() => {
            // Handle exceptions because otherwise React would break and the app would become unusable until refresh.
            try {
                return derivedClassRender.call(this);
            } catch (e) {
                // Annoy devs so this gets fixed.
                if (Options.development) {
                    // tslint:disable-next-line
                    throw e;
                }

                // Try to move on.
                return null;
            }
        });
    }

    protected _initStoreSubscriptions(): StoreSubscription<S>[] {
        return [];
    }

    // Subclasses may override, but _MUST_ call super.
    componentWillMount(): void {
        this._storeSubscriptions.forEach(subscription => {
            this._addSubscription(subscription);
        });

        this._isMounted = true;
    }

    // Subclasses may override, but _MUST_ call super.
    componentWillReceiveProps(nextProps: P): void {
        _.each(this._handledSubscriptions, (subscription: StoreSubscriptionInternal<S>) => {
            if (subscription.keyPropertyName) {
                let curVal = _.get<string>(this.props, subscription.keyPropertyName);
                let nextVal = _.get<string>(nextProps, subscription.keyPropertyName);
                if (curVal !== nextVal) {
                    // The property we care about changed, so unsubscribe and re-subscribe under the new value

                    this._removeSubscriptionFromLookup(subscription);
                    this._cleanupSubscription(subscription);

                    this._registerSubscription(subscription, nextVal);
                    this._addSubscriptionToLookup(subscription);
                }
            }
        });

        if (!_.isEqual(this.props, nextProps)) {
            let newState = this._buildStateWithAutoSubscriptions(nextProps, false);
            if (newState && !_.isEmpty(newState)) {
                this.setState(newState);
            }
        }
    }

    // Subclasses may override, but _MUST_ call super.
    componentWillUnmount(): void {
        _.each(this._handledSubscriptions, (subscription: StoreSubscriptionInternal<S>) => {
            this._cleanupSubscription(subscription);
        });
        this._handledSubscriptions = {};
        this._handledSubscriptionsLookup = {};

        // Remove and cleanup all suscriptions
        _.each(this._handledAutoSubscriptions, subscription => {
            subscription.used = false;
            subscription.store.removeAutoSubscription(subscription);
        });
        this._handledAutoSubscriptions = [];

        this._isMounted = false;
    }

    componentWillUpdate(nextProps: P, nextState: S): void {
        // Do nothing, included so that there is no ambiguity on when a subclass must call super
    }

    shouldComponentUpdate(nextProps: P, nextState: S): boolean {
        return !_.isEqual(this.state, nextState) || !_.isEqual(this.props, nextProps);
    }

    isComponentMounted(): boolean {
        return this._isMounted;
    }

    protected _addSubscription(subscription: StoreSubscription<S>): StoreSubscription<S> {
        assert.ok(subscription.store instanceof StoreBase,
            'Subscription added with store that\'s not an StoreBase');

        if (subscription.enablePropertyName) {
            let enabled = _.get<boolean>(this.props, subscription.enablePropertyName);
            if (!enabled) {
                // Do not process subscription

                // TODO: save this subscription and try again when props change!
                return;
            }
        }

        let nsubscription = subscription as StoreSubscriptionInternal<S>;

        // Wrap the given callback (if any) to provide extra functionality.
        nsubscription._callback = subscription.callbackBuildState
            // The caller wants auto-subscriptions, so enable them for the duration of the given callback.
            ? enableAutoSubscribeWrapper(ComponentBase._autoSubscribeHandler, subscription.callbackBuildState, this)
            : subscription.callback
                // The caller wants to take care of everything.
                // Note: eating the return value so we do not later confuse it for a state update.
                ? (keys?: string[]) => { subscription.callback(keys); }
                // Callback was not given.
                : null;

        nsubscription._lambda = _.bind(this._onSubscriptionChanged, this, subscription);
        nsubscription._id = ComponentBase._nextSubscriptionId++;

        if (nsubscription.keyPropertyName) {
            let keyVal = _.get<string>(this.props, nsubscription.keyPropertyName);
            assert.ok(typeof keyVal !== 'undefined',
                'Subscription can\'t resolve key property: ' + nsubscription.keyPropertyName);

            this._registerSubscription(nsubscription, keyVal);
        } else if (nsubscription.specificKeyValue) {
            this._registerSubscription(nsubscription, nsubscription.specificKeyValue);
        } else {
            this._registerSubscription(nsubscription);
        }

        this._handledSubscriptions[nsubscription._id] = nsubscription;
        this._addSubscriptionToLookup(nsubscription);

        return subscription;
    }

    protected _removeSubscription(subscription: StoreSubscription<S>): StoreSubscription<S>[] {
        const removed: StoreSubscription<S>[] = [];
        const nsubscription = subscription as StoreSubscriptionInternal<S>;

        const removedExplicit = this._handledSubscriptions[nsubscription._id];
        if (removedExplicit) {
            removed.push(removedExplicit);
            this._cleanupSubscription(removedExplicit);
            delete this._handledSubscriptions[nsubscription._id];
        }

        this._removeSubscriptionFromLookup(subscription as StoreSubscriptionInternal<S>);

        return removed;
    }

    private _registerSubscription(subscription: StoreSubscriptionInternal<S>, key: string|number = StoreBase.Key_All) {
        assert.ok(!subscription._subscriptionToken,
            'Subscription already subscribed!');
        assert.ok(!subscription.keyPropertyName || key !== StoreBase.Key_All,
                'Subscription created with key of all when it has a key property name');
        assert.notDeepEqual(subscription.specificKeyValue, StoreBase.Key_All,
                'Subscription created with specific key of all');

        if (key) {
            if (_.isNumber(key)) {
                key = key.toString();
            }
            subscription._subscriptionToken = subscription.store.subscribe(subscription._lambda, key);
            subscription._subscriptionKey = key;
        } else {
            subscription._subscriptionKey = null;
        }
    }

    private _cleanupSubscription(subscription: StoreSubscriptionInternal<S>) {
        if (subscription._subscriptionToken) {
            subscription.store.unsubscribe(subscription._subscriptionToken);
            subscription._subscriptionToken = null;
        }
    }

    private _shouldRemoveAndCleanupAutoSubscription(subscription: AutoSubscription): boolean {
        return !subscription.used;
    }

    private _onSubscriptionChanged(subscription: StoreSubscription<S>, changedItem: any) {
        // The only time we can get a subscription callback that's unmounted is after the component has already been
        // mounted and torn down, so this check can only catch that case (subscriptions living past the end of the
        // component's lifetime).
        if (!this.isComponentMounted()) {
            return;
        }

        let newState: S|void = undefined;

        let nsubscription = subscription as StoreSubscriptionInternal<S>;
        if (nsubscription._callback) {
            newState = nsubscription._callback(changedItem);
        } else {
            newState = this._buildStateWithAutoSubscriptions(this.props, false);
        }

        if (newState && !_.isEmpty(newState)) {
            this.setState(newState);
        }
    }

    private _onAutoSubscriptionChanged = () => {
        if (!this.isComponentMounted()) {
            return;
        }
        const newState = this._buildStateWithAutoSubscriptions(this.props, false);
        if (newState && !_.isEmpty(newState)) {
            this.setState(newState);
        }
    }

    private _addSubscriptionToLookup(subscription: StoreSubscriptionInternal<S>) {
        const lookup = this._handledSubscriptionsLookup;
        const storeId = subscription.store.storeId;
        const key = subscription._subscriptionKey || null;

        if (!lookup[storeId]) {
            lookup[storeId] = {};
        }
        if (!lookup[storeId][key]) {
            lookup[storeId][key] = {};
        }
        lookup[storeId][key][subscription._id] = subscription;
    }

    private _removeSubscriptionFromLookup(subscription: StoreSubscriptionInternal<S>) {
        const lookup = this._handledSubscriptionsLookup;
        const storeId = subscription.store.storeId;
        const key = subscription._subscriptionKey || null;

        if (lookup[storeId] && lookup[storeId][key] && lookup[storeId][key][subscription._id]) {
            delete lookup[storeId][key][subscription._id];
        }
    }

    private _handleAutoSubscribe(store: StoreBase, key: string) {
        // Check for an existing auto-subscription.
        if (this._hasMatchingAutoSubscription(store, key)) {
            return;
        }

        // Check for an existing explicit subscription.
        if (this._hasMatchingSubscription(store.storeId, key)) {
            return;
        }

        // None found: auto-subscribe!
        const subscription: AutoSubscription = {
            store: store,
            // Note: an undefined specificKeyValue will use Key_All by default.
            key: key,
            callback: this._onAutoSubscriptionChanged,
            used: true
        };
        this._handledAutoSubscriptions.push(subscription);
        subscription.store.trackAutoSubscription(subscription);
    }

    // Check if we already handle a subscription (explicit) for storeId with key.
    private _hasMatchingSubscription(storeId: string, key: string) {
        const subscriptionsWithStore = this._handledSubscriptionsLookup[storeId];
        if (subscriptionsWithStore) {
            const subscriptionsWithStoreAndKey = subscriptionsWithStore[key];
            const subscriptionsWithStoreAndKeyAll = subscriptionsWithStore[StoreBase.Key_All];
            if (!_.isEmpty(subscriptionsWithStoreAndKey) || !_.isEmpty(subscriptionsWithStoreAndKeyAll)) {
                // Already explicitly subscribed.
                return true;
            }

            const subscriptionsWithStoreAndPropName = subscriptionsWithStore[null as string];
            const matchingSubscription = _.find(subscriptionsWithStoreAndPropName, (sub: StoreSubscriptionInternal<S>) => {
                if (sub.keyPropertyName && (!sub.enablePropertyName || _.get<boolean>(this.props, sub.enablePropertyName))) {
                    const curVal = _.get<string>(this.props, sub.keyPropertyName);
                    return curVal === key;
                }
                // Subscribed to Key_All.
                return true;
            });
            if (matchingSubscription) {
                // Already explicitly subscribed.
                return true;
            }
        }
        return false;
    }

    // Check if we already handle a subscription (auto) for store with key.
    private _hasMatchingAutoSubscription(store: StoreBase, key: string) {
        return _.some(this._handledAutoSubscriptions, sub => {
            if (sub.store.storeId === store.storeId && (sub.key === key || sub.key === StoreBase.Key_All)) {
                sub.used = true;
                return true;
            }
            return false;
        });
    }

    // Hander for enableAutoSubscribe that does the actual auto-subscription work.
    private static _autoSubscribeHandler = {
        // Callback to handle the 'auto-subscribe'.
        handle(self: ComponentBase<any, any>, store: StoreBase, key: string) {
            self._handleAutoSubscribe(store, key);
        }
    };

    @enableAutoSubscribe(ComponentBase._autoSubscribeHandler)
    private _buildStateWithAutoSubscriptions(props: P, initialBuild: boolean): S {
        _.each(this._handledAutoSubscriptions, sub => {
            sub.used = false;
        });

        const state = this._buildState(props, initialBuild);
        _.remove(this._handledAutoSubscriptions, subscription => {
            if (this._shouldRemoveAndCleanupAutoSubscription(subscription)) {
                subscription.store.removeAutoSubscription(subscription);
                return true;
            }
            return false;
        });
        return state;
    }

    // All but the simplest of components should implement this virtual function.  This function is called in 3 places
    // by the framework:
    // 1. In the component constructor, it's called with the initial props and initialBuild = true.  This is where you should set all
    //    initial state for your component.  In many cases this case needs no special casing whatsoever because the component always
    //    rebuilds all of its state from whatever the props are, whether it's an initial build or a new props received event.
    // 2. In the React lifecycle, during a componentWillReceiveProps, if the props change (determined by a _.isEqual), this is called
    //    so that the component can rebuild state from the new props.
    // 3. If the component subscribes to any stores via the ComponentBase subscription system, if a specific callback function is not
    //    specified, then this function is called whenever the subscription is triggered.  Basically, this should be used if there are
    //    no performance considerations with simply rebuilding the whole component whenever a subscription is triggered, which is
    //    very often the case.
    //
    // In the majority of cases, this turns into a simple function that doesn't care about initialBuild, and simply
    // rebuilds the whole state of the component whenever called.  This should usually only be made more specific if
    // there are performance considerations with over-rebuilding.
    protected _buildState(props: P, initialBuild: boolean): S {
        return null;
    }

    // Wrap both didMount and didUpdate into componentDidRender
    componentDidMount() {
        this._componentDidRender();
    }

    componentDidUpdate(prevProps: P, prevState: S) {
        this._componentDidRender();
    }

    protected _componentDidRender() {
        // Virtual helper function to override as needed
    }
}

export default ComponentBase;
