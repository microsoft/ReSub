/**
* ComponentBase.ts
* Author: David de Regt
* Copyright: Microsoft 2016
*
* Base class for React components, adding in support for automatic store registration and unregistration.
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import * as React from 'react';
import * as assert from 'assert';
import * as _ from './lodashMini';
import Options from './Options';
import Instrumentation from './Instrumentation';
import { forbidAutoSubscribeWrapper, enableAutoSubscribeWrapper, enableAutoSubscribe } from './AutoSubscriptions';
import { StoreBase } from './StoreBase';
// Subscriptions without a key need some way to be identified in the SubscriptionLookup.
var SubKeyNoKey = '%$^NONE';
var ComponentBase = /** @class */ (function (_super) {
    __extends(ComponentBase, _super);
    function ComponentBase(props) {
        var _this = _super.call(this, props) || this;
        _this._handledSubscriptions = {};
        _this._handledAutoSubscriptions = [];
        _this._handledSubscriptionsLookup = {};
        _this._isMounted = false;
        _this._onAutoSubscriptionChanged = function () {
            if (!_this.isComponentMounted()) {
                return;
            }
            var newState = _this._buildStateWithAutoSubscriptions(_this.props, false);
            if (newState && !_.isEmpty(newState)) {
                _this.setState(newState);
            }
        };
        var derivedClassRender = _this.render || _.noop;
        var render = derivedClassRender;
        if (!Options.preventTryCatchInRender) {
            render = function () {
                // Handle exceptions because otherwise React would break and the app would become unusable until refresh.
                // Note: React error boundaries will make this redundant.
                try {
                    return derivedClassRender.call(_this);
                }
                catch (e) {
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
        _this.render = forbidAutoSubscribeWrapper(render, _this);
        return _this;
    }
    ComponentBase.prototype._initStoreSubscriptions = function () {
        return [];
    };
    // Subclasses may override, but _MUST_ call super.
    ComponentBase.prototype.componentWillMount = function () {
        this.setState(this._buildInitialState());
        this._isMounted = true;
    };
    // Subclasses may override, but _MUST_ call super.
    ComponentBase.prototype.componentWillReceiveProps = function (nextProps, nextContext) {
        var _this = this;
        _.forEach(this._handledSubscriptions, function (subscription) {
            if (subscription.keyPropertyName) {
                var currKey = _this._findKeyFromPropertyName(_this.props, subscription.keyPropertyName);
                var nextKey = _this._findKeyFromPropertyName(nextProps, subscription.keyPropertyName);
                if (currKey !== nextKey) {
                    // The property we care about changed, so unsubscribe and re-subscribe under the new value
                    _this._removeSubscriptionFromLookup(subscription);
                    _this._cleanupSubscription(subscription);
                    _this._registerSubscription(subscription, nextKey);
                    _this._addSubscriptionToLookup(subscription);
                }
            }
        });
        if (!Options.shouldComponentUpdateComparator(this.props, nextProps)) {
            var newState = this._buildStateWithAutoSubscriptions(nextProps, false);
            if (!_.isEmpty(newState)) {
                this.setState(newState);
            }
        }
    };
    // Subclasses may override, but _MUST_ call super.
    ComponentBase.prototype.componentWillUnmount = function () {
        var _this = this;
        _.forEach(this._handledSubscriptions, function (subscription) {
            _this._cleanupSubscription(subscription);
        });
        this._handledSubscriptions = {};
        this._handledSubscriptionsLookup = {};
        // Remove and cleanup all suscriptions
        _.forEach(this._handledAutoSubscriptions, function (subscription) {
            subscription.used = false;
            subscription.store.removeAutoSubscription(subscription);
        });
        this._handledAutoSubscriptions = [];
        this._isMounted = false;
    };
    ComponentBase.prototype.componentWillUpdate = function (nextProps, nextState, nextContext) {
        // Do nothing, included so that there is no ambiguity on when a subclass must call super
    };
    ComponentBase.prototype.shouldComponentUpdate = function (nextProps, nextState, nextContext) {
        return !Options.shouldComponentUpdateComparator(this.state, nextState) ||
            !Options.shouldComponentUpdateComparator(this.props, nextProps) ||
            !Options.shouldComponentUpdateComparator(this.context, nextContext);
    };
    ComponentBase.prototype.isComponentMounted = function () {
        return this._isMounted;
    };
    ComponentBase.prototype._addSubscription = function (subscription) {
        assert.ok(subscription.store instanceof StoreBase, 'Subscription added with store that\'s not an StoreBase');
        var enablePropertyName = subscription.enablePropertyName;
        if (enablePropertyName && !this._isEnabledByPropertyName(this.props, enablePropertyName)) {
            // Do not process subscription
            // TODO: save this subscription and try again when props change!
            return undefined;
        }
        var nsubscription = _.extend(subscription, {
            // Wrap the given callback (if any) to provide extra functionality.
            _callback: subscription.callbackBuildState
                // The caller wants auto-subscriptions, so enable them for the duration of the given callback.
                ? enableAutoSubscribeWrapper(ComponentBase._autoSubscribeHandler, subscription.callbackBuildState, this)
                : subscription.callback
                    // The caller wants to take care of everything.
                    // Note: eating the return value so we do not later confuse it for a state update.
                    ? function (keys) { subscription.callback(keys); }
                    // Callback was not given.
                    : undefined,
            _lambda: this._onSubscriptionChanged.bind(this, subscription),
            _id: ComponentBase._nextSubscriptionId++
        });
        if (nsubscription.keyPropertyName) {
            var key = this._findKeyFromPropertyName(this.props, nsubscription.keyPropertyName);
            this._registerSubscription(nsubscription, key);
        }
        else if (nsubscription.specificKeyValue) {
            this._registerSubscription(nsubscription, nsubscription.specificKeyValue);
        }
        else {
            this._registerSubscription(nsubscription);
        }
        this._handledSubscriptions[nsubscription._id] = nsubscription;
        this._addSubscriptionToLookup(nsubscription);
        return subscription;
    };
    ComponentBase.prototype._removeSubscription = function (subscription) {
        var removed = [];
        var nsubscription = subscription;
        var removedExplicit = this._handledSubscriptions[nsubscription._id];
        if (removedExplicit) {
            removed.push(removedExplicit);
            this._cleanupSubscription(removedExplicit);
            delete this._handledSubscriptions[nsubscription._id];
        }
        this._removeSubscriptionFromLookup(subscription);
        return removed;
    };
    ComponentBase.prototype._registerSubscription = function (subscription, key) {
        if (key === void 0) { key = StoreBase.Key_All; }
        assert.ok(!subscription._subscriptionToken, 'Subscription already subscribed!');
        assert.ok(!subscription.keyPropertyName || key !== StoreBase.Key_All, 'Subscription created with key of all when it has a key property name');
        assert.notDeepEqual(subscription.specificKeyValue, StoreBase.Key_All, 'Subscription created with specific key of all');
        if (key) {
            if (_.isNumber(key)) {
                key = key.toString();
            }
            subscription._subscriptionToken = subscription.store.subscribe(subscription._lambda, key);
            subscription._subscriptionKey = key;
        }
        else {
            subscription._subscriptionKey = undefined;
        }
    };
    ComponentBase.prototype._cleanupSubscription = function (subscription) {
        if (subscription._subscriptionToken) {
            subscription.store.unsubscribe(subscription._subscriptionToken);
            subscription._subscriptionToken = undefined;
        }
    };
    ComponentBase.prototype._shouldRemoveAndCleanupAutoSubscription = function (subscription) {
        return !subscription.used;
    };
    ComponentBase.prototype._onSubscriptionChanged = function (subscription, changedItem) {
        // The only time we can get a subscription callback that's unmounted is after the component has already been
        // mounted and torn down, so this check can only catch that case (subscriptions living past the end of the
        // component's lifetime).
        if (!this.isComponentMounted()) {
            return;
        }
        var newState = undefined;
        var nsubscription = subscription;
        if (nsubscription._callback) {
            newState = nsubscription._callback(changedItem);
        }
        else {
            newState = this._buildStateWithAutoSubscriptions(this.props, false);
        }
        if (newState && !_.isEmpty(newState)) {
            this.setState(newState);
        }
    };
    ComponentBase.prototype._addSubscriptionToLookup = function (subscription) {
        var lookup = this._handledSubscriptionsLookup;
        var storeId = subscription.store.storeId;
        var key = subscription._subscriptionKey || SubKeyNoKey;
        if (!lookup[storeId]) {
            lookup[storeId] = {};
        }
        if (!lookup[storeId][key]) {
            lookup[storeId][key] = {};
        }
        lookup[storeId][key][subscription._id] = subscription;
    };
    ComponentBase.prototype._removeSubscriptionFromLookup = function (subscription) {
        var lookup = this._handledSubscriptionsLookup;
        var storeId = subscription.store.storeId;
        var key = subscription._subscriptionKey || SubKeyNoKey;
        if (lookup[storeId] && lookup[storeId][key] && lookup[storeId][key][subscription._id]) {
            delete lookup[storeId][key][subscription._id];
        }
    };
    ComponentBase.prototype._handleAutoSubscribe = function (store, key) {
        // Check for an existing auto-subscription.
        var autoSubscription = this._findMatchingAutoSubscription(store, key);
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
        var subscription = {
            store: store,
            // Note: an undefined specificKeyValue will use Key_All by default.
            key: key,
            callback: this._onAutoSubscriptionChanged,
            used: true
        };
        this._handledAutoSubscriptions.push(subscription);
        subscription.store.trackAutoSubscription(subscription);
    };
    // Check if we already handle a subscription (explicit) for storeId with key.
    ComponentBase.prototype._hasMatchingSubscription = function (storeId, key) {
        var _this = this;
        var subscriptionsWithStore = this._handledSubscriptionsLookup[storeId];
        if (subscriptionsWithStore) {
            var subscriptionsWithStoreAndKey = subscriptionsWithStore[key];
            var subscriptionsWithStoreAndKeyAll = subscriptionsWithStore[StoreBase.Key_All];
            if (!_.isEmpty(subscriptionsWithStoreAndKey) || !_.isEmpty(subscriptionsWithStoreAndKeyAll)) {
                // Already explicitly subscribed.
                return true;
            }
            var subscriptionsWithStoreAndPropName = subscriptionsWithStore[SubKeyNoKey];
            var matchingSubscription = _.find(subscriptionsWithStoreAndPropName, function (sub) {
                var enablePropertyName = sub.enablePropertyName, keyPropertyName = sub.keyPropertyName;
                // @see - https://github.com/Microsoft/ReSub/issues/44
                if (keyPropertyName
                    && (!enablePropertyName || _this._isEnabledByPropertyName(_this.props, enablePropertyName))) {
                    var currKey = _this._findKeyFromPropertyName(_this.props, keyPropertyName);
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
    };
    // Search already handled auto-subscription
    ComponentBase.prototype._findMatchingAutoSubscription = function (store, key) {
        return _.find(this._handledAutoSubscriptions, function (subscription) { return ((subscription.store.storeId === store.storeId)
            && (subscription.key === key || subscription.key === StoreBase.Key_All)); });
    };
    // Search Subscription "keyPropertyName" in Component props(this.props)
    ComponentBase.prototype._findKeyFromPropertyName = function (props, keyPropertyName) {
        var key = _.get(props, keyPropertyName);
        if (!_.isString(key)) {
            assert.ok(false, 'Subscription key property value ' + keyPropertyName + ' must be a string');
            // Fallback to subscribing to all values
            return StoreBase.Key_All;
        }
        return key;
    };
    // Check if enablePropertyName is enabled
    ComponentBase.prototype._isEnabledByPropertyName = function (props, enablePropertyName) {
        return !!_.get(props, enablePropertyName);
    };
    ComponentBase.prototype._buildStateWithAutoSubscriptions = function (props, initialBuild) {
        var _this = this;
        _.forEach(this._handledAutoSubscriptions, function (sub) {
            sub.used = false;
        });
        Instrumentation.beginBuildState();
        var state = this._buildState(props, initialBuild);
        Instrumentation.endBuildState(this.constructor);
        _.remove(this._handledAutoSubscriptions, function (subscription) {
            if (_this._shouldRemoveAndCleanupAutoSubscription(subscription)) {
                subscription.store.removeAutoSubscription(subscription);
                return true;
            }
            return false;
        });
        return state;
    };
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
    ComponentBase.prototype._buildState = function (props, initialBuild) {
        return undefined;
    };
    // The initial state is unavailable in componentWillMount. Override this method to get access to it.
    // Subclasses may override, but _MUST_ call super.
    ComponentBase.prototype._buildInitialState = function () {
        var _this = this;
        _.forEach(this._initStoreSubscriptions(), function (subscription) {
            _this._addSubscription(subscription);
        });
        // Initialize state
        return this._buildStateWithAutoSubscriptions(this.props, true) || {};
    };
    // Wrap both didMount and didUpdate into componentDidRender
    ComponentBase.prototype.componentDidMount = function () {
        this._componentDidRender();
    };
    ComponentBase.prototype.componentDidUpdate = function (prevProps, prevState, prevContext) {
        this._componentDidRender();
    };
    ComponentBase.prototype._componentDidRender = function () {
        // Virtual helper function to override as needed
    };
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
    ComponentBase._nextSubscriptionId = 1;
    // Hander for enableAutoSubscribe that does the actual auto-subscription work.
    ComponentBase._autoSubscribeHandler = {
        // Callback to handle the 'auto-subscribe'.
        handle: function (self, store, key) {
            self._handleAutoSubscribe(store, key);
        }
    };
    __decorate([
        enableAutoSubscribe(ComponentBase._autoSubscribeHandler)
    ], ComponentBase.prototype, "_buildStateWithAutoSubscriptions", null);
    return ComponentBase;
}(React.Component));
export { ComponentBase };
export default ComponentBase;
