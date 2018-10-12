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
import * as assert from 'assert';
import * as _ from './lodashMini';
import Options from './Options';
import Instrumentation from './Instrumentation';
var StoreBase = /** @class */ (function () {
    function StoreBase(_throttleMs, _bypassTriggerBlocks) {
        if (_throttleMs === void 0) { _throttleMs = Options.defaultThrottleMs; }
        if (_bypassTriggerBlocks === void 0) { _bypassTriggerBlocks = false; }
        var _this = this;
        this._throttleMs = _throttleMs;
        this._bypassTriggerBlocks = _bypassTriggerBlocks;
        this._subscriptions = {};
        this._autoSubscriptions = {};
        this._subTokenNum = 1;
        this._subsByNum = {};
        this.storeId = _.uniqueId('store');
        this._resolveThrottledCallbacks = function () {
            _this._throttleData = undefined;
            StoreBase._resolveCallbacks();
        };
    }
    StoreBase.pushTriggerBlock = function () {
        this._triggerBlockCount++;
    };
    StoreBase.popTriggerBlock = function () {
        this._triggerBlockCount--;
        assert.ok(this._triggerBlockCount >= 0, 'Over-popped trigger blocks!');
        if (this._triggerBlockCount === 0) {
            StoreBase._resolveCallbacks();
        }
    };
    StoreBase.setThrottleStatus = function (enabled) {
        this._bypassThrottle = !enabled;
        StoreBase._resolveCallbacks();
    };
    StoreBase._updateExistingMeta = function (meta, throttledUntil, bypassBlock) {
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
    };
    // If you trigger a specific set of keys, then it will only trigger that specific set of callbacks (and subscriptions marked
    // as "All" keyed).  If the key is all, it will trigger all callbacks.
    StoreBase.prototype.trigger = function (keyOrKeys) {
        var _this = this;
        // If we're throttling, save execution time
        var throttledUntil;
        if (this._throttleMs) {
            if (!this._throttleData) {
                // Needs to accumulate and trigger later -- start a timer if we don't have one running already
                // If there are no callbacks, don't bother setting up the timer
                this._throttleData = {
                    timerId: Options.setTimeout(this._resolveThrottledCallbacks, this._throttleMs),
                    callbackTime: Date.now() + this._throttleMs
                };
            }
            throttledUntil = this._throttleData.callbackTime;
        }
        var bypassBlock = this._bypassTriggerBlocks;
        // trigger(0) is valid, ensure that we catch this case
        if (!keyOrKeys && !_.isNumber(keyOrKeys)) {
            // Inspecific key, so generic callback call
            var allSubs = _.flatten(_.values(this._subscriptions));
            _.forEach(allSubs, function (callback) {
                var existingMeta = StoreBase._pendingCallbacks.get(callback);
                var newMeta = { keys: null, throttledUntil: throttledUntil, bypassBlock: bypassBlock };
                // Clear the key list to null for the callback but respect previous throttle/bypass values
                if (existingMeta && throttledUntil && existingMeta.throttledUntil) {
                    newMeta.throttledUntil = Math.min(throttledUntil, existingMeta.throttledUntil);
                }
                if (existingMeta && existingMeta.bypassBlock) {
                    newMeta.bypassBlock = true;
                }
                StoreBase._pendingCallbacks.set(callback, newMeta);
            });
            _.forEach(_.flatten(_.values(this._autoSubscriptions)), function (sub) {
                var existingMeta = StoreBase._pendingCallbacks.get(sub.callback);
                var newMeta = { keys: null, throttledUntil: throttledUntil, bypassBlock: bypassBlock };
                // Clear the key list to null for the callback but respect previous throttle/bypass values
                if (existingMeta && throttledUntil && existingMeta.throttledUntil) {
                    newMeta.throttledUntil = Math.min(throttledUntil, existingMeta.throttledUntil);
                }
                if (existingMeta && existingMeta.bypassBlock) {
                    newMeta.bypassBlock = true;
                }
                StoreBase._pendingCallbacks.set(sub.callback, newMeta);
            });
        }
        else {
            var keys_1 = _.map(_.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys], function (key) { return _.isNumber(key) ? key.toString() : key; });
            // Key list, so go through each key and queue up the callback
            _.forEach(keys_1, function (key) {
                _.forEach(_this._subscriptions[key], function (callback) {
                    var existingMeta = StoreBase._pendingCallbacks.get(callback);
                    StoreBase._updateExistingMeta(existingMeta, throttledUntil, bypassBlock);
                    if (existingMeta === undefined) {
                        StoreBase._pendingCallbacks.set(callback, { keys: [key], throttledUntil: throttledUntil, bypassBlock: bypassBlock });
                    }
                    else if (existingMeta.keys === null) {
                        // Do nothing since it's already an all-key-trigger
                    }
                    else {
                        // Add it to the end of the list
                        existingMeta.keys.push(key);
                    }
                });
                _.forEach(_this._autoSubscriptions[key], function (sub) {
                    var existingMeta = StoreBase._pendingCallbacks.get(sub.callback);
                    StoreBase._updateExistingMeta(existingMeta, throttledUntil, bypassBlock);
                    if (existingMeta === undefined) {
                        StoreBase._pendingCallbacks.set(sub.callback, { keys: [key], throttledUntil: throttledUntil, bypassBlock: bypassBlock });
                    }
                    else if (existingMeta.keys === null) {
                        // Do nothing since it's already an all-key-trigger
                    }
                    else {
                        // Add it to the end of the list
                        existingMeta.keys.push(key);
                    }
                });
            });
            // Go through each of the all-key subscriptions and add the full key list to their gathered list
            _.forEach(this._subscriptions[StoreBase.Key_All], function (callback) {
                var existingMeta = StoreBase._pendingCallbacks.get(callback);
                StoreBase._updateExistingMeta(existingMeta, throttledUntil, bypassBlock);
                if (existingMeta === undefined) {
                    StoreBase._pendingCallbacks.set(callback, { keys: _.clone(keys_1), throttledUntil: throttledUntil, bypassBlock: bypassBlock });
                }
                else if (existingMeta.keys === null) {
                    // Do nothing since it's already an all-key-trigger
                }
                else {
                    // Add them all to the end of the list
                    _.forEach(keys_1, function (key) {
                        existingMeta.keys.push(key);
                    });
                }
            });
            _.forEach(this._autoSubscriptions[StoreBase.Key_All], function (sub) {
                var existingMeta = StoreBase._pendingCallbacks.get(sub.callback);
                StoreBase._updateExistingMeta(existingMeta, throttledUntil, bypassBlock);
                if (existingMeta === undefined) {
                    StoreBase._pendingCallbacks.set(sub.callback, { keys: _.clone(keys_1), throttledUntil: throttledUntil, bypassBlock: bypassBlock });
                }
                else if (existingMeta.keys === null) {
                    // Do nothing since it's already an all-key-trigger
                }
                else {
                    // Add them all to the end of the list
                    _.forEach(keys_1, function (key) {
                        existingMeta.keys.push(key);
                    });
                }
            });
        }
        if (!throttledUntil || this._bypassTriggerBlocks) {
            StoreBase._resolveCallbacks();
        }
    };
    StoreBase._resolveCallbacks = function () {
        // Prevent a store from trigginer while it's already in a trigger state
        if (StoreBase._isTriggering) {
            StoreBase._triggerPending = true;
            return;
        }
        StoreBase._isTriggering = true;
        StoreBase._triggerPending = false;
        Instrumentation.beginInvokeStoreCallbacks();
        var callbacksCount = 0;
        var currentTime = Date.now();
        // Capture the callbacks we need to call
        var callbacks = [];
        this._pendingCallbacks.forEach(function (meta, callback, map) {
            // Block check
            if (StoreBase._triggerBlockCount > 0 && !meta.bypassBlock) {
                return;
            }
            // Throttle check
            if (meta.throttledUntil && meta.throttledUntil > currentTime && !StoreBase._bypassThrottle) {
                return;
            }
            // Do a quick dedupe on keys
            var uniquedKeys = meta.keys ? _.uniq(meta.keys) : meta.keys;
            // Convert null key (meaning "all") to undefined for the callback.
            callbacks.push([callback, uniquedKeys || undefined]);
            map.delete(callback);
        });
        callbacks.forEach(function (_a) {
            var callback = _a[0], keys = _a[1];
            callback(keys);
        });
        Instrumentation.endInvokeStoreCallbacks(this.constructor, callbacksCount);
        StoreBase._isTriggering = false;
        if (this._triggerPending) {
            StoreBase._resolveCallbacks();
        }
    };
    // Subscribe to triggered events from this store.  You can leave the default key, in which case you will be
    // notified of any triggered events, or you can use a key to filter it down to specific event keys you want.
    // Returns a token you can pass back to unsubscribe.
    StoreBase.prototype.subscribe = function (callback, rawKey) {
        if (rawKey === void 0) { rawKey = StoreBase.Key_All; }
        var key = _.isNumber(rawKey) ? rawKey.toString() : rawKey;
        // Adding extra type-checks since the key is often the result of following a string path, which is not type-safe.
        assert.ok(key && _.isString(key), 'Trying to subscribe to invalid key: "' + key + '"');
        var callbacks = this._subscriptions[key];
        if (!callbacks) {
            this._subscriptions[key] = [callback];
            if (key !== StoreBase.Key_All && !this._autoSubscriptions[key]) {
                this._startedTrackingKey(key);
            }
        }
        else {
            callbacks.push(callback);
        }
        var token = this._subTokenNum++;
        this._subsByNum[token] = { key: key, callback: callback };
        return token;
    };
    // Unsubscribe from a previous subscription.  Pass in the token the subscribe function handed you.
    StoreBase.prototype.unsubscribe = function (subToken) {
        assert.ok(this._subsByNum[subToken], 'No subscriptions found for token ' + subToken);
        var key = this._subsByNum[subToken].key;
        var callback = this._subsByNum[subToken].callback;
        delete this._subsByNum[subToken];
        // Remove this callback set from our tracking lists
        StoreBase._pendingCallbacks.delete(callback);
        var callbacks = this._subscriptions[key];
        assert.ok(callbacks, 'No subscriptions under key ' + key);
        var index = _.indexOf(callbacks, callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
            if (callbacks.length === 0) {
                // No more callbacks for key, so clear it out
                delete this._subscriptions[key];
                if (key !== StoreBase.Key_All && !this._autoSubscriptions[key]) {
                    this._stoppedTrackingKey(key);
                }
            }
        }
        else {
            assert.ok(false, 'Subscription not found during unsubscribe...');
        }
    };
    StoreBase.prototype.trackAutoSubscription = function (subscription) {
        var key = subscription.key;
        var callbacks = this._autoSubscriptions[key];
        if (!callbacks) {
            this._autoSubscriptions[key] = [subscription];
            if (key !== StoreBase.Key_All && !this._subscriptions[key]) {
                this._startedTrackingKey(key);
            }
        }
        else {
            callbacks.push(subscription);
        }
    };
    StoreBase.prototype.removeAutoSubscription = function (subscription) {
        var key = subscription.key;
        var subs = this._autoSubscriptions[key];
        assert.ok(subs, 'No subscriptions under key ' + key);
        var oldLength = subs.length;
        _.pull(subs, subscription);
        assert.equal(subs.length, oldLength - 1, 'Subscription not found during unsubscribe...');
        StoreBase._pendingCallbacks.delete(subscription.callback);
        if (subs.length === 0) {
            // No more callbacks for key, so clear it out
            delete this._autoSubscriptions[key];
            if (key !== StoreBase.Key_All && !this._subscriptions[key]) {
                this._stoppedTrackingKey(key);
            }
        }
    };
    StoreBase.prototype._startedTrackingKey = function (key) {
        // Virtual function, noop default behavior
    };
    StoreBase.prototype._stoppedTrackingKey = function (key) {
        // Virtual function, noop default behavior
    };
    StoreBase.prototype._getSubscriptionKeys = function () {
        return _.union(_.keys(this._subscriptions), _.keys(this._autoSubscriptions));
    };
    StoreBase.prototype._isTrackingKey = function (key) {
        return !!this._subscriptions[key] || !!this._autoSubscriptions[key];
    };
    StoreBase.Key_All = '%!$all';
    StoreBase._triggerPending = false;
    StoreBase._isTriggering = false;
    StoreBase._triggerBlockCount = 0;
    StoreBase._bypassThrottle = false;
    StoreBase._pendingCallbacks = new Map();
    return StoreBase;
}());
export { StoreBase };
