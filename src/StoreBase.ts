/**
* StoreBase.ts
* Author: David de Regt
* Copyright: Microsoft 2015
*
* StoreBase acts as the base class to all stores.  Allows for pub/sub and event triggering at a variety of levels of the store.
* It also supports key triggering deferral and aggregation.  Stores can mark that they're okay getting delayed triggers for X ms,
* during which period the StoreBase gathers all incoming triggers and dedupes them, and releases them all at the same time at
* the end of the delay period.  You can also globally push a trigger-block onto a stack and if the stack is nonzero, then
* triggers will be queued for ALL stores until the block is popped, at which point all queued triggers will fire simultaneously.
* Stores can mark themselves as opt-out of the trigger-block logic for critical stores that must flow under all conditions.
*/

import _ = require('lodash');
import assert = require('assert');

import MapShim from './MapShim';
import Options from './Options';
import { SubscriptionCallbackFunction } from './Types';

export interface AutoSubscription {
    store: StoreBase;
    callback: () => void;
    key: string;
    used: boolean;
}

export abstract class StoreBase {
    static Key_All = '%!$all';

    private _subscriptions: _.Dictionary<SubscriptionCallbackFunction[]> = {};
    private _autoSubscriptions: _.Dictionary<AutoSubscription[]> = {};

    private _subTokenNum = 1;
    private _subsByNum: { [token: number]: { key: string, callback: SubscriptionCallbackFunction } } = {};

    storeId = _.uniqueId('store');

    private _gatheredCallbacks = new MapShim<SubscriptionCallbackFunction, string[]>();

    private _throttleMs: number;
    private _throttleTimerId: number;

    private _bypassTriggerBlocks: boolean;
    private _triggerBlocked = false;

    private static _triggerBlockCount = 0;
    private static _triggerBlockedStoreList: StoreBase[] = [];
    private static _pendingThrottledStores: StoreBase[] = [];
    private static _bypassThrottle = false;

    static pushTriggerBlock() {
        this._triggerBlockCount++;
    }

    static popTriggerBlock() {
        this._triggerBlockCount--;
        assert.ok(this._triggerBlockCount >= 0, 'Over-popped trigger blocks!');

        if (this._triggerBlockCount === 0) {
            // Go through the list of stores awaiting resolution and resolve them all
            const awaitingList = this._triggerBlockedStoreList;
            this._triggerBlockedStoreList = [];
            _.each(awaitingList, store => {
                store._resolveThrottledCallbacks();
            });
        }
    }

    static setThrottleStatus(enabled: boolean) {
        this._bypassThrottle = !enabled;

        // If we're going to bypass the throttle, trigger all pending stores now
        if (this._bypassThrottle) {
            let pendingThrottledStore = this._pendingThrottledStores.shift();
            while (!!pendingThrottledStore) {
                pendingThrottledStore._resolveThrottledCallbacks();
                pendingThrottledStore = this._pendingThrottledStores.shift();
            }
        }
    }

    constructor(throttleMs: number = 0, bypassTriggerBans = false) {
        this._throttleMs = throttleMs;
        this._bypassTriggerBlocks = bypassTriggerBans;
    }

    // If you trigger a specific set of keys, then it will only trigger that specific set of callbacks (and subscriptions marked
    // as "All" keyed).  If the key is all, it will trigger all callbacks.
    protected trigger(keyOrKeys?: string|number|(string|number)[]) {
        let keys: string[];
        if (keyOrKeys) {
            keys = _.map(_.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys], key => _.isNumber(key) ? key.toString() : key);
        }

        // Build a list of callbacks to call, trying to accumulate keys into a single callback set to avoid multiple callbacks
        // to the same target with different keys.

        if (!keys) {
            // Inspecific key, so generic callback call
            const allSubs = _.flatten(_.values(this._subscriptions));
            _.each(allSubs, callback => {
                // Clear the key list to null for the callback
                this._gatheredCallbacks.set(callback, null);
            });

            _.each(_.flatten(_.values(this._autoSubscriptions)),
                sub => {
                    this._gatheredCallbacks.set(sub.callback, null);
                });
        } else {
            // Key list, so go through each key and queue up the callback
            _.each(keys, key => {
                _.each(this._subscriptions[key], callback => {
                    const existingKeys = this._gatheredCallbacks.get(callback);
                    if (existingKeys === undefined) {
                        this._gatheredCallbacks.set(callback, [key]);
                    } else if (existingKeys === null) {
                        // Do nothing since it's already an all-key-trigger
                    } else {
                        // Add it to the end of the list
                        existingKeys.push(key);
                    }
                });

                _.each(this._autoSubscriptions[key], sub => {
                    const existingKeys = this._gatheredCallbacks.get(sub.callback);
                    if (existingKeys === undefined) {
                        this._gatheredCallbacks.set(sub.callback, [key]);
                    } else if (existingKeys === null) {
                        // Do nothing since it's already an all-key-trigger
                    } else {
                        // Add it to the end of the list
                        existingKeys.push(key);
                    }
                });
            });

            // Go through each of the all-key subscriptions and add the full key list to their gathered list
            _.each(this._subscriptions[StoreBase.Key_All], callback => {
                const existingKeys = this._gatheredCallbacks.get(callback);
                if (existingKeys === undefined) {
                    this._gatheredCallbacks.set(callback, _.clone(keys));
                } else if (existingKeys === null) {
                    // Do nothing since it's already an all-key-trigger
                } else {
                    // Add them all to the end of the list
                    _.each(keys, key => {
                        existingKeys.push(key);
                    });
                }
            });

            _.each(this._autoSubscriptions[StoreBase.Key_All], sub => {
                const existingKeys = this._gatheredCallbacks.get(sub.callback);
                if (existingKeys === undefined) {
                    this._gatheredCallbacks.set(sub.callback, _.clone(keys));
                } else if (existingKeys === null) {
                    // Do nothing since it's already an all-key-trigger
                } else {
                    // Add them all to the end of the list
                    _.each(keys, key => {
                        existingKeys.push(key);
                    });
                }
            });
        }

        if (this._throttleMs && !StoreBase._bypassThrottle) {
            // Needs to accumulate and trigger later -- start a timer if we don't have one running already
            // If there are no callbacks, don't bother setting up the timer
            if (!this._throttleTimerId && this._gatheredCallbacks.size !== 0) {
                this._throttleTimerId = Options.setTimeout(this._resolveThrottledCallbacks, this._throttleMs);
            }
        } else {
            // No throttle timeout, so just resolve now
            this._resolveThrottledCallbacks();
        }
    }

    private _resolveThrottledCallbacks = () => {
        // Clear a timer if one's still pending
        if (this._throttleTimerId) {
            Options.clearTimeout(this._throttleTimerId);
            this._throttleTimerId = undefined;
            _.remove(StoreBase._pendingThrottledStores, this);
        }

        if (StoreBase._triggerBlockCount > 0 && !this._bypassTriggerBlocks) {
            // Trigger-blocked without a bypass flag.  Please wait until later.
            if (!this._triggerBlocked) {
                // Save this store to the global list that will be resolved when the block count is popped back to zero.
                StoreBase._triggerBlockedStoreList.push(this);
                this._triggerBlocked = true;
            }
            return;
        }

        this._triggerBlocked = false;

        // Store the callbacks early, since calling callbacks may actually cause cascade changes to the subscription system and/or
        // pending callbacks.
        const storedCallbacks = this._gatheredCallbacks;
        this._gatheredCallbacks = new MapShim<SubscriptionCallbackFunction, string[]>();

        storedCallbacks.forEach((keys, callback) => {
            // Do a quick dedupe on keys
            const uniquedKeys = keys ? _.uniq(keys) : keys;
            callback(uniquedKeys);
        });
    };

    // Subscribe to triggered events from this store.  You can leave the default key, in which case you will be
    // notified of any triggered events, or you can use a key to filter it down to specific event keys you want.
    // Returns a token you can pass back to unsubscribe.
    subscribe(callback: SubscriptionCallbackFunction, rawKey: string|number = StoreBase.Key_All): number {
        const key = _.isNumber(rawKey) ? rawKey.toString() : rawKey;

        // Adding extra type-checks since the key is often the result of following a string path, which is not type-safe.
        assert.ok(key && _.isString(key), 'Trying to subscribe to invalid key: "' + key + '"');

        let callbacks = this._subscriptions[key];
        if (!callbacks) {
            this._subscriptions[key] = [callback];

            if (key !== StoreBase.Key_All && !this._autoSubscriptions[key]) {
                this._startedTrackingKey(key);
            }
        } else {
            callbacks.push(callback);
        }

        let token = this._subTokenNum++;
        this._subsByNum[token] = { key: key, callback: callback };
        return token;
    }

    // Unsubscribe from a previous subscription.  Pass in the token the subscribe function handed you.
    unsubscribe(subToken: number) {
        assert.ok(this._subsByNum[subToken], 'No subscriptions found for token ' + subToken);

        let key = this._subsByNum[subToken].key;
        let callback = this._subsByNum[subToken].callback;
        delete this._subsByNum[subToken];

        // Remove this callback set from our tracking lists
        this._gatheredCallbacks.delete(callback);

        let callbacks = this._subscriptions[key];
        assert.ok(callbacks, 'No subscriptions under key ' + key);

        const index = _.indexOf(callbacks, callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
            if (callbacks.length === 0) {
                // No more callbacks for key, so clear it out
                delete this._subscriptions[key];

                if (key !== StoreBase.Key_All && !this._autoSubscriptions[key]) {
                    this._stoppedTrackingKey(key);
                }
            }
        } else {
            assert.ok(false, 'Subscription not found during unsubscribe...');
        }
    }

    trackAutoSubscription(subscription: AutoSubscription) {
        const key = subscription.key;
        const callbacks = this._autoSubscriptions[key];
        if (!callbacks) {
            this._autoSubscriptions[key] = [subscription];

            if (key !== StoreBase.Key_All && !this._subscriptions[key]) {
                this._startedTrackingKey(key);
            }
        } else {
            callbacks.push(subscription);
        }
    }

    removeAutoSubscription(subscription: AutoSubscription) {
        const key = subscription.key;

        let subs = this._autoSubscriptions[key];
        assert.ok(subs, 'No subscriptions under key ' + key);

        const oldLength = subs.length;
        _.pull(subs, subscription);
        assert.equal(subs.length, oldLength - 1, 'Subscription not found during unsubscribe...');

        this._gatheredCallbacks.delete(subscription.callback);

        if (subs.length === 0) {
            // No more callbacks for key, so clear it out
            delete this._autoSubscriptions[key];

            if (key !== StoreBase.Key_All && !this._subscriptions[key]) {
                this._stoppedTrackingKey(key);
            }
        }
    }

    protected _startedTrackingKey(key: string): void {
        // Virtual function, noop default behavior
    }

    protected _stoppedTrackingKey(key: string): void {
        // Virtual function, noop default behavior
    }

    protected _getSubscriptionKeys() {
        return _.union(_.keys(this._subscriptions), _.keys(this._autoSubscriptions));
    }

    protected _isTrackingKey(key: string) {
        return !!this._subscriptions[key] || !!this._autoSubscriptions[key];
    }

    test_getSubscriptions() {
        return this._subscriptions;
    }

    test_getAutoSubscriptions() {
        return this._autoSubscriptions;
    }
}
