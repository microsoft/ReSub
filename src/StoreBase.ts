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

import * as _ from './lodashMini';
import Options from './Options';
import * as Instrumentation from './Instrumentation';
import { assert, normalizeKey, normalizeKeys, KeyOrKeys } from './utils';
import { SubscriptionCallbackFunction } from './Types';

export interface AutoSubscription {
    store: StoreBase;
    callback: () => void;
    key: string;
    used: boolean;
}

interface CallbackMetadata {
    keys: string[] | null;
    throttledUntil: number | undefined;
    bypassBlock: boolean;
}
type CallbackMap = Map<SubscriptionCallbackFunction, CallbackMetadata>;

export abstract class StoreBase {
    static readonly Key_All = '%!$all';

    private readonly _subscriptions: _.Dictionary<SubscriptionCallbackFunction[]> = {};
    private readonly _autoSubscriptions: _.Dictionary<AutoSubscription[]> = {};

    private _subTokenNum = 1;
    private readonly _subsByNum: {
        [token: number]: {
            key: string;
            callback: SubscriptionCallbackFunction;
        };
    } = {};

    readonly storeId = _.uniqueId('store');

    private _throttleData: { timerId: number; callbackTime: number } | undefined;

    private static _triggerPending = false;
    private static _isTriggering = false;
    private static _triggerBlockCount = 0;
    private static _bypassThrottle = false;
    private static readonly _pendingCallbacks: CallbackMap = new Map();

    static pushTriggerBlock(): void {
        this._triggerBlockCount++;
    }

    static popTriggerBlock(): void {
        this._triggerBlockCount--;
        assert(this._triggerBlockCount >= 0, 'Over-popped trigger blocks!');

        if (this._triggerBlockCount === 0) {
            StoreBase._resolveCallbacks();
        }
    }

    static setThrottleStatus(enabled: boolean): void {
        this._bypassThrottle = !enabled;

        StoreBase._resolveCallbacks();
    }

    constructor(private readonly _throttleMs?: number, private readonly _bypassTriggerBlocks = false) {
    }

    // If you trigger a specific set of keys, then it will only trigger that specific set of callbacks (and subscriptions marked
    // as "All" keyed).  If the key is all, it will trigger all callbacks.
    protected trigger(keyOrKeys?: KeyOrKeys): void {
        const throttleMs = this._throttleMs !== undefined
            ? this._throttleMs
            : Options.defaultThrottleMs;

        // If we're throttling, save execution time
        let throttledUntil: number | undefined;
        if (throttleMs) {
            if (!this._throttleData) {
                // Needs to accumulate and trigger later -- start a timer if we don't have one running already
                // If there are no callbacks, don't bother setting up the timer
                this._throttleData = {
                    timerId: Options.setTimeout(this._handleThrottledCallbacks, this._throttleMs),
                    callbackTime: Date.now() + throttleMs,
                };
            }
            throttledUntil = this._throttleData.callbackTime;
        }

        const bypassBlock = this._bypassTriggerBlocks;

        // trigger(0) is valid, ensure that we catch this case
        if (!keyOrKeys && !_.isNumber(keyOrKeys)) {
            // Inspecific key, so generic callback call
            const allSubs = _.flatten(_.values(this._subscriptions));

            _.forEach(allSubs, sub => {
                this._setupAllKeySubscription(sub, throttledUntil, bypassBlock);
            });
            _.forEach(_.flatten(_.values(this._autoSubscriptions)),
                sub => {
                    this._setupAllKeySubscription(sub.callback, throttledUntil, bypassBlock);
                });
        } else {
            const keys = normalizeKeys(keyOrKeys);

            // Key list, so go through each key and queue up the callback
            _.forEach(keys, key => {
                _.forEach(this._subscriptions[key], callback => {
                    this._setupSpecificKeySubscription([key], callback, throttledUntil, bypassBlock);
                });

                _.forEach(this._autoSubscriptions[key], sub => {
                    this._setupSpecificKeySubscription([key], sub.callback, throttledUntil, bypassBlock);
                });
            });

            // Go through each of the all-key subscriptions and add the full key list to their gathered list
            _.forEach(this._subscriptions[StoreBase.Key_All], callback => {
                this._setupSpecificKeySubscription(keys, callback, throttledUntil, bypassBlock);
            });

            _.forEach(this._autoSubscriptions[StoreBase.Key_All], sub => {
                this._setupSpecificKeySubscription(keys, sub.callback, throttledUntil, bypassBlock);
            });
        }

        if (!throttledUntil || bypassBlock) {
            StoreBase._resolveCallbacks();
        }
    }

    private static _updateExistingMeta(meta: CallbackMetadata | undefined, throttledUntil: number|undefined, bypassBlock: boolean): void {
        if (!meta) {
            return;
        }
        // Update throttling value to me min of exiting and new value
        if (throttledUntil && meta.throttledUntil) {
            meta.throttledUntil = Math.min(meta.throttledUntil, throttledUntil);
        }

        if (!throttledUntil) {
            meta.throttledUntil = undefined;
        }

        if (bypassBlock) {
            meta.bypassBlock = true;
        }
    }

    private _setupAllKeySubscription(callback: SubscriptionCallbackFunction, throttledUntil: number | undefined,
            bypassBlock: boolean): void {
        const existingMeta = StoreBase._pendingCallbacks.get(callback);
        const newMeta = { keys: null, throttledUntil, bypassBlock };
        // Clear the key list to null for the callback but respect previous throttle/bypass values
        if (existingMeta && throttledUntil && existingMeta.throttledUntil) {
            newMeta.throttledUntil = Math.min(throttledUntil, existingMeta.throttledUntil);
        }
        if (existingMeta && existingMeta.bypassBlock) {
            newMeta.bypassBlock = true;
        }
        StoreBase._pendingCallbacks.set(callback, newMeta);
    }

    private _setupSpecificKeySubscription(keys: string[], callback: SubscriptionCallbackFunction,
            throttledUntil: number | undefined, bypassBlock: boolean): void {
        const existingMeta = StoreBase._pendingCallbacks.get(callback);
        StoreBase._updateExistingMeta(existingMeta, throttledUntil, bypassBlock);

        if (existingMeta === undefined) {
            // We need to clone keys in order to prevent accidental by-ref mutations
            StoreBase._pendingCallbacks.set(callback, { keys: [...keys], throttledUntil, bypassBlock });
        } else if (existingMeta.keys === null) {
            // Do nothing since it's already an all-key-trigger
        } else {
            // Add them all to the end of the list
            // Refrain from using spead operater here, this can result in a stack overflow if a large number of keys are triggered
            const keyCount = keys.length;
            for (let i = 0; i < keyCount; i++) {
                existingMeta.keys.push(keys[i]);
            }
        }
    }

    private _handleThrottledCallbacks = () => {
        this._throttleData = undefined;
        StoreBase._resolveCallbacks();
    };

    private static _resolveCallbacks(): void {
        // Prevent a store from triggering while it's already in a trigger state
        if (StoreBase._isTriggering) {
            StoreBase._triggerPending = true;
            return;
        }

        StoreBase._isTriggering = true;
        StoreBase._triggerPending = false;
        if (Instrumentation.impl) { Instrumentation.impl.beginInvokeStoreCallbacks(); }

        let callbacksCount = 0;
        const currentTime = Date.now();

        // Capture the callbacks we need to call
        const callbacks: [SubscriptionCallbackFunction, string[]|undefined][] = [];
        this._pendingCallbacks.forEach((meta, callback, map) => {
            // Block check
            if (StoreBase._triggerBlockCount > 0 && !meta.bypassBlock) {
                return;
            }

            // Throttle check
            if (meta.throttledUntil && meta.throttledUntil > currentTime && !StoreBase._bypassThrottle) {
                return;
            }
            // Do a quick dedupe on keys
            const uniquedKeys = meta.keys ? _.uniq(meta.keys) : meta.keys;
            // Convert null key (meaning "all") to undefined for the callback.
            callbacks.push([callback, uniquedKeys || undefined]);
            map.delete(callback);
        });

        callbacks.forEach(([callback, keys]) => {
            callbacksCount++;
            callback(keys);
        });

        if (Instrumentation.impl) { Instrumentation.impl.endInvokeStoreCallbacks(this.constructor, callbacksCount); }

        StoreBase._isTriggering = false;

        if (this._triggerPending) {
            StoreBase._resolveCallbacks();
        }
    }

    // Subscribe to triggered events from this store.  You can leave the default key, in which case you will be
    // notified of any triggered events, or you can use a key to filter it down to specific event keys you want.
    // Returns a token you can pass back to unsubscribe.
    subscribe(callback: SubscriptionCallbackFunction, rawKey: string | number = StoreBase.Key_All): number {
        const key = normalizeKey(rawKey);

        // Adding extra type-checks since the key is often the result of following a string path, which is not type-safe.
        assert(key && _.isString(key), `Trying to subscribe to invalid key: "${ key }"`);

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
    unsubscribe(subToken: number): void {
        assert(this._subsByNum[subToken], `No subscriptions found for token ${ subToken }`);

        let key = this._subsByNum[subToken].key;
        let callback = this._subsByNum[subToken].callback;
        delete this._subsByNum[subToken];

        // Remove this callback set from our tracking lists
        StoreBase._pendingCallbacks.delete(callback);

        let callbacks = this._subscriptions[key];
        assert(callbacks, `No subscriptions under key ${ key }`);

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
            assert(false, 'Subscription not found during unsubscribe...');
        }
    }

    trackAutoSubscription(subscription: AutoSubscription): void {
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

    removeAutoSubscription(subscription: AutoSubscription): void {
        const key = subscription.key;
        let subs = this._autoSubscriptions[key];

        assert(subs, `No subscriptions under key ${ key }`);

        const oldLength = subs.length;
        _.pull(subs, subscription);

        assert(subs.length === oldLength - 1, 'Subscription not found during unsubscribe...');

        StoreBase._pendingCallbacks.delete(subscription.callback);

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

    protected _getSubscriptionKeys(): string[] {
        return _.union(Object.keys(this._subscriptions), Object.keys(this._autoSubscriptions));
    }

    protected _isTrackingKey(key: string): boolean {
        return !!this._subscriptions[key] || !!this._autoSubscriptions[key];
    }
}
