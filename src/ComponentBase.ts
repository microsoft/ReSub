/**
* ComponentBase.ts
* Author: David de Regt
* Copyright: Microsoft 2016
*
* Base class for React components, adding in support for automatic store registration and unregistration.
*/

import * as React from 'react';

import * as _ from './lodashMini';
import Options from './Options';
import * as Instrumentation from './Instrumentation';
import { SubscriptionCallbackBuildStateFunction, SubscriptionCallbackFunction, StoreSubscription } from './Types';
import { forbidAutoSubscribeWrapper, enableAutoSubscribeWrapper, enableAutoSubscribe } from './AutoSubscriptions';
import { assert, noop, normalizeKey } from './utils';
import { AutoSubscription, StoreBase } from './StoreBase';

// Subscriptions without a key need some way to be identified in the SubscriptionLookup.
const SubKeyNoKey = '%$^NONE';

interface SubscriptionLookup<P, S> {
    [storeId: string]: {
        [key: string]: { [id: number]: StoreSubscriptionInternal<P, S> };
    };
}

interface StoreSubscriptionInternal<P, S> extends StoreSubscription<P, S> {
    // Re-typing it here from the base interface so that it's strongly typed
    store: StoreBase;

    // Globally unique for each subscription being handled in the components.
    _id: number;

    // Internal value used for tracking the local callback for this subscription
    _lambda: any;

    // The callback to be used in the _lambda, if any.
    _callback?: SubscriptionCallbackFunction | SubscriptionCallbackBuildStateFunction<S>;

    // Subscription token for unsubscribing (undefined before registering)
    _subscriptionToken?: number;

    // Key's value used in above subscription (undefined if not subscribed)
    _subscriptionKey?: string;
}

export abstract class ComponentBase<P extends {}, S extends _.Dictionary<any>> extends React.Component<P, S> {
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

    private static _nextSubscriptionId = 1;

    private _handledSubscriptions: { [id: number]: StoreSubscriptionInternal<P, S> } = {};
    private _handledAutoSubscriptions: AutoSubscription[] = [];

    private _handledSubscriptionsLookup: SubscriptionLookup<P, S> = {};

    private _isMounted = false;

    constructor(props: P) {
        super(props);

        const derivedClassRender = this.render || noop;
        let render = derivedClassRender;
        if (!Options.preventTryCatchInRender) {
            render = () => {
                // Handle exceptions because otherwise React would break and the app would become unusable until refresh.
                // Note: React error boundaries will make this redundant.
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
            };
        }
        // No one should use Store getters in render: do that in _buildState instead.
        this.render = forbidAutoSubscribeWrapper(render, this);
    }

    protected _initStoreSubscriptions(): StoreSubscription<P, S>[] {
        return [];
    }

    // Subclasses may override, but _MUST_ call super.
    componentWillMount(): void {
        this.setState(this._buildInitialState());
        this._isMounted = true;
    }

    // Subclasses may override, but _MUST_ call super.
    componentWillReceiveProps(nextProps: Readonly<P>, nextContext: any): void {
        _.forEach(this._handledSubscriptions, (subscription: StoreSubscriptionInternal<P, S>) => {
            if (subscription.keyPropertyName) {
                const currKey = this._findKeyFromPropertyName(this.props, subscription.keyPropertyName);
                const nextKey = this._findKeyFromPropertyName(nextProps, subscription.keyPropertyName);

                if (currKey !== nextKey) {
                    // The property we care about changed, so unsubscribe and re-subscribe under the new value

                    this._removeSubscriptionFromLookup(subscription);
                    this._cleanupSubscription(subscription);

                    this._registerSubscription(subscription, nextKey);
                    this._addSubscriptionToLookup(subscription);
                }
            }
        });

        if (!Options.shouldComponentUpdateComparator(this.props, nextProps)) {
            const newState = this._buildStateWithAutoSubscriptions(nextProps, false);
            if (!_.isEmpty(newState)) {
                this.setState(newState as Pick<S, any>);
            }
        }
    }

    // Subclasses may override, but _MUST_ call super.
    componentWillUnmount(): void {
        _.forEach(this._handledSubscriptions, (subscription: StoreSubscriptionInternal<P, S>) => {
            this._cleanupSubscription(subscription);
        });

        this._handledSubscriptions = {};
        this._handledSubscriptionsLookup = {};

        // Remove and cleanup all suscriptions
        _.forEach(this._handledAutoSubscriptions, subscription => {
            subscription.used = false;
            subscription.store.removeAutoSubscription(subscription);
        });
        this._handledAutoSubscriptions = [];

        this._isMounted = false;
    }

    componentWillUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): void {
        // Do nothing, included so that there is no ambiguity on when a subclass must call super
    }

    shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): boolean {
        return !Options.shouldComponentUpdateComparator(this.state, nextState) ||
            !Options.shouldComponentUpdateComparator(this.props, nextProps) ||
            !Options.shouldComponentUpdateComparator(this.context, nextContext);
    }

    isComponentMounted(): boolean {
        return this._isMounted;
    }

    protected _addSubscription(subscription: StoreSubscription<P, S>): StoreSubscription<P, S> | undefined {
        assert(subscription.store instanceof StoreBase, `Subscription added with store that's not an StoreBase`);

        const { enablePropertyName } = subscription;

        if (enablePropertyName && !this._isEnabledByPropertyName(this.props, enablePropertyName)) {
            // Do not process subscription
            // TODO: save this subscription and try again when props change!
            return undefined;
        }

        let nsubscription: StoreSubscriptionInternal<P, S> = _.extend(subscription, {
            // Wrap the given callback (if any) to provide extra functionality.
            _callback: subscription.callbackBuildState
                // The caller wants auto-subscriptions, so enable them for the duration of the given callback.
                ? enableAutoSubscribeWrapper(ComponentBase._autoSubscribeHandler, subscription.callbackBuildState, this)
                : subscription.callback
                    // The caller wants to take care of everything.
                    // Note: eating the return value so we do not later confuse it for a state update.
                    ? (keys?: string[]) => { subscription.callback!!!(keys); }
                    // Callback was not given.
                    : undefined,
            _lambda: this._onSubscriptionChanged.bind(this, subscription),
            _id: ComponentBase._nextSubscriptionId++,
        });

        if (nsubscription.keyPropertyName) {
            const key = this._findKeyFromPropertyName(this.props, nsubscription.keyPropertyName);
            this._registerSubscription(nsubscription, key);
        } else if (nsubscription.specificKeyValue) {
            this._registerSubscription(nsubscription, nsubscription.specificKeyValue);
        } else {
            this._registerSubscription(nsubscription);
        }

        this._handledSubscriptions[nsubscription._id] = nsubscription;
        this._addSubscriptionToLookup(nsubscription);

        return subscription;
    }

    protected _removeSubscription(subscription: StoreSubscription<P, S>): StoreSubscription<P, S>[] {
        const removed: StoreSubscription<P, S>[] = [];
        const nsubscription = subscription as StoreSubscriptionInternal<P, S>;

        const removedExplicit = this._handledSubscriptions[nsubscription._id];
        if (removedExplicit) {
            removed.push(removedExplicit);
            this._cleanupSubscription(removedExplicit);
            delete this._handledSubscriptions[nsubscription._id];
        }

        this._removeSubscriptionFromLookup(subscription as StoreSubscriptionInternal<P, S>);

        return removed;
    }

    private _registerSubscription(subscription: StoreSubscriptionInternal<P, S>, key: string | number = StoreBase.Key_All): void {
        assert(!subscription._subscriptionToken, 'Subscription already subscribed!');
        assert(!subscription.keyPropertyName || key !== StoreBase.Key_All,
            'Subscription created with key of all when it has a key property name');
        assert(!_.isEqual(subscription.specificKeyValue, StoreBase.Key_All), 'Subscription created with specific key of all');

        if (key) {
            key = normalizeKey(key);
            subscription._subscriptionToken = subscription.store.subscribe(subscription._lambda, key);
            subscription._subscriptionKey = key;
        } else {
            subscription._subscriptionKey = undefined;
        }
    }

    private _cleanupSubscription(subscription: StoreSubscriptionInternal<P, S>): void {
        if (subscription._subscriptionToken) {
            subscription.store.unsubscribe(subscription._subscriptionToken);
            subscription._subscriptionToken = undefined;
        }
    }

    private _shouldRemoveAndCleanupAutoSubscription(subscription: AutoSubscription): boolean {
        return !subscription.used;
    }

    private _onSubscriptionChanged(subscription: StoreSubscription<P, S>, changedItem: any): void {
        // The only time we can get a subscription callback that's unmounted is after the component has already been
        // mounted and torn down, so this check can only catch that case (subscriptions living past the end of the
        // component's lifetime).
        if (!this.isComponentMounted()) {
            return;
        }

        let newState: Pick<S, any>|void = undefined;

        let nsubscription = subscription as StoreSubscriptionInternal<P, S>;
        if (nsubscription._callback) {
            newState = nsubscription._callback(changedItem) as Pick<S, any> | void;
        } else {
            newState = this._buildStateWithAutoSubscriptions(this.props, false) as Pick<S, any> | void;
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
            this.setState(newState as Pick<S, any>);
        }
    };

    private _addSubscriptionToLookup(subscription: StoreSubscriptionInternal<P, S>): void {
        let lookup = this._handledSubscriptionsLookup;
        const storeId = subscription.store.storeId;
        const key = subscription._subscriptionKey || SubKeyNoKey;

        if (!lookup[storeId]) {
            lookup[storeId] = {};
        }
        if (!lookup[storeId][key]) {
            lookup[storeId][key] = {};
        }
        lookup[storeId][key][subscription._id] = subscription;
    }

    private _removeSubscriptionFromLookup(subscription: StoreSubscriptionInternal<P, S>): void {
        let lookup = this._handledSubscriptionsLookup;
        const storeId = subscription.store.storeId;
        const key = subscription._subscriptionKey || SubKeyNoKey;

        if (lookup[storeId] && lookup[storeId][key] && lookup[storeId][key][subscription._id]) {
            delete lookup[storeId][key][subscription._id];
        }
    }

    private _handleAutoSubscribe(store: StoreBase, key: string): void {
        // Check for an existing auto-subscription.
        const autoSubscription = this._findMatchingAutoSubscription(store, key);
        if (autoSubscription) {
            // Set auto-subscription as used
            autoSubscription.used = true;
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
            used: true,
        };
        this._handledAutoSubscriptions.push(subscription);
        subscription.store.trackAutoSubscription(subscription);
    }

    // Check if we already handle a subscription (explicit) for storeId with key.
    private _hasMatchingSubscription(storeId: string, key: string): boolean {
        const subscriptionsWithStore = this._handledSubscriptionsLookup[storeId];

        if (subscriptionsWithStore) {
            const subscriptionsWithStoreAndKey = subscriptionsWithStore[key];
            const subscriptionsWithStoreAndKeyAll = subscriptionsWithStore[StoreBase.Key_All];

            if (!_.isEmpty(subscriptionsWithStoreAndKey) || !_.isEmpty(subscriptionsWithStoreAndKeyAll)) {
                // Already explicitly subscribed.
                return true;
            }

            const subscriptionsWithStoreAndPropName = subscriptionsWithStore[SubKeyNoKey];
            const matchingSubscription = _.find(subscriptionsWithStoreAndPropName, (sub: StoreSubscriptionInternal<P, S>) => {
                const {
                    enablePropertyName,
                    keyPropertyName,
                } = sub;

                // @see - https://github.com/Microsoft/ReSub/issues/44
                if (
                    keyPropertyName
                    && (!enablePropertyName || this._isEnabledByPropertyName(this.props, enablePropertyName))
                ) {
                    const currKey = this._findKeyFromPropertyName(this.props, keyPropertyName);
                    return currKey === key;
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

    // Search already handled auto-subscription
    private _findMatchingAutoSubscription(store: StoreBase, key: string): AutoSubscription | undefined {
        return _.find(this._handledAutoSubscriptions, subscription => (
            (subscription.store.storeId === store.storeId)
            && (subscription.key === key || subscription.key === StoreBase.Key_All)
        ));
    }

    // Search Subscription "keyPropertyName" in Component props(this.props)
    private _findKeyFromPropertyName(props: Readonly<P>, keyPropertyName: keyof P): string {
        const key = _.get(props, keyPropertyName);
        if (!_.isString(key)) {
            assert(false, `Subscription key property value ${ keyPropertyName } must be a string`);
            // Fallback to subscribing to all values
            return StoreBase.Key_All;
        }

        return key;
    }

    // Check if enablePropertyName is enabled
    private _isEnabledByPropertyName(props: Readonly<P>, enablePropertyName: keyof P): boolean {
        return !!_.get(props, enablePropertyName);
    }

    // Hander for enableAutoSubscribe that does the actual auto-subscription work.
    private static _autoSubscribeHandler = {
        // Callback to handle the 'auto-subscribe'.
        handle(self: ComponentBase<any, any>, store: StoreBase, key: string) {
            self._handleAutoSubscribe(store, key);
        },
    };

    @enableAutoSubscribe(ComponentBase._autoSubscribeHandler)
    private _buildStateWithAutoSubscriptions(props: P, initialBuild: boolean): Partial<S> | undefined {
        _.forEach(this._handledAutoSubscriptions, sub => {
            sub.used = false;
        });

        if (Instrumentation.impl) { Instrumentation.impl.beginBuildState(); }
        const state = this._buildState(props, initialBuild);
        if (Instrumentation.impl) { Instrumentation.impl.endBuildState(this.constructor); }

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
    protected _buildState(props: P, initialBuild: boolean): Partial<S> | undefined {
        return undefined;
    }

    // The initial state is unavailable in componentWillMount. Override this method to get access to it.
    // Subclasses may override, but _MUST_ call super.
    protected _buildInitialState(): Readonly<S> {
        _.forEach(this._initStoreSubscriptions(), subscription => {
            this._addSubscription(subscription);
        });

        // Initialize state
        const initialState = this._buildStateWithAutoSubscriptions(this.props, true) || {};
        return initialState as S;
    }

    // Wrap both didMount and didUpdate into componentDidRender
    componentDidMount(): void {
        this._componentDidRender();
    }

    componentDidUpdate(prevProps: Readonly<P>, prevState: S, prevContext: any): void {
        this._componentDidRender();
    }

    protected _componentDidRender(): void {
        // Virtual helper function to override as needed
    }
}

export default ComponentBase;
