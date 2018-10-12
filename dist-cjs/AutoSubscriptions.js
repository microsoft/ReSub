"use strict";
/**
* AutoSubscriptions.ts
* Author: Mark Davis
* Copyright: Microsoft 2016
*
* Method decorator for stores implementations, to help components auto-subscribe when they use certain methods.
*
* When an @autoSubscribe method is called, the most recent @enableAutoSubscribe method up the call stack will trigger its handler.
* When an @warnIfAutoSubscribeEnabled method is called, it will warn if the most recent @enableAutoSubscribe was in a component.
*/
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// -- Property descriptors --
//
// Method decorator functions operate on descriptors, so here is a basic overview of descriptors. Every property (including methods) on
// every object (including the prototype) are recorded internally as more than just a value: they have some associated metadata, such as
// 'enumerable' or 'writable'. You can directly access this metadata by getting a descriptor for a particular key on an obj via
// `Object.getOwnPropertyDescriptor(obj, key)`. If the descriptor has 'configurable' set to false, then it cannot be changed. Otherwise,
// you can update it via `Object.defineProperty(obj, key, descriptor)`.
// Note: TypeScript will call these methods for you. Method/property descriptor functions are given the descriptor and return the changes.
//
// For auto-subscriptions, only 'value' is needed. The 'value' is what is given when someone writes `obj[key]` (or equivalently `obj.key`).
// Usually the pattern to change 'value' is (assuming 'value' is a method):
//
//   const existingMethod = descriptor.value;
//   descriptor.value = function InternalWrapper(...args) {
//     return existingMethod.apply(this, args);
//   };
//   return descriptor;
//
// Note: the previous 'value' (called 'existingMethod' in the above example) might not be the original method the developer wrote. Some
// other decorator might have replaced the 'value' with something else. If every new 'value' holds onto the 'value' that came before it,
// then this is kind of like a linked list ending with the original method (where the 'links' are function calls). However, you do not have
// to call the previous 'value', e.g. `if (!__DEV__) { descriptor.value = _.noop; }`.
//
// More info:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor
// -- Decorator info --
//
// Decorators are called while the class is being defined, and method/property decorators are given a chance to modify a property
// descriptor (see above) before adding the method to the prototype. The can simply run some code and then return nothing, or they can
// modify/replace the descriptor.
//
// * Class decorators are only given the Target (class constructor, not the prototype).
//   @AutoSubscribeStore only runs some code, without changing the constructor.
//
// * Method/property decorators are given the Target (class prototype), the key (method name), and the existing descriptor.
//   @enableAutoSubscribe and @autoSubscribe wraps the 'value' so some custom logic can run every time the method is called.
//   @warnIfAutoSubscribeEnabled does nothing in production. For devs, it wraps the 'value' similar to the others.
//
// * Parameter decorators are given the Target (class prototype), the key (method name), and the index into the arguments list.
//   @key just records the index for that method.
//
// Note: TypeScript allows an arbitrary expression after the @, so long as it resolves to a function with the correct signiture. Thus using
// `@makeAutoSubscribeDecorator(false)` would be valid: the `makeAutoSubscribeDecorator(false)` would be evaluated to get the decorator,
// and then the decorator would be called with the parameters described above.
//
// Note: TypeScript does not automatically apply descriptors to child classes. If they want the decorator then they need to add it as well.
// For example, applying the @forbidAutoSubscribe decorator (does not actually exit) on ComponentBase.render could change the descriptor
// for that method in the prototype, but the child's render would be a different method. That would be completely useless: even if you call
// super.render, the descriptor's logic only applies until the end of that method, not the end of yours. This is why that functionality is
// exposes as a function instead of a decorator.
var assert = __importStar(require("assert"));
var _ = __importStar(require("./lodashMini"));
var Decorator = __importStar(require("./Decorator"));
var Options_1 = __importDefault(require("./Options"));
var StoreBase_1 = require("./StoreBase");
// The current handler info, or null if no handler is setup.
var handlerWrapper;
function createAutoSubscribeWrapper(handler, useAutoSubscriptions, existingMethod, thisArg) {
    // Note: we need to be given 'this', so cannot use '=>' syntax.
    // Note: T might have other properties (e.g. T = { (): void; bar: number; }). We don't support that and need a cast.
    return function AutoSubscribeWrapper() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        // Decorators are given 'this', but normal callers can supply it as a parameter.
        var instance = thisArg || this;
        // The handler will now be given all auto-subscribe callbacks.
        var previousHandlerWrapper = handlerWrapper;
        handlerWrapper = {
            handler: handler,
            instance: instance,
            useAutoSubscriptions: useAutoSubscriptions,
            inAutoSubscribe: false
        };
        var result = _tryFinally(function () {
            return existingMethod.apply(instance, args);
        }, function () {
            // Restore the previous handler.
            handlerWrapper = previousHandlerWrapper;
        });
        return result;
    };
}
// Returns a new function with auto-subscriptions enabled.
function enableAutoSubscribeWrapper(handler, existingMethod, thisArg) {
    return createAutoSubscribeWrapper(handler, 1 /* Enabled */, existingMethod, thisArg);
}
exports.enableAutoSubscribeWrapper = enableAutoSubscribeWrapper;
// Returns a new function that warns if any auto-subscriptions would have been encountered.
function forbidAutoSubscribeWrapper(existingMethod, thisArg) {
    if (!Options_1.default.development) {
        return thisArg ? existingMethod.bind(thisArg) : existingMethod;
    }
    return createAutoSubscribeWrapper(undefined, 2 /* Forbid */, existingMethod, thisArg);
}
exports.forbidAutoSubscribeWrapper = forbidAutoSubscribeWrapper;
// Hooks up the handler for @autoSubscribe methods called later down the call stack.
function enableAutoSubscribe(handler) {
    return function (target, propertyKey, descriptor) {
        // Note: T might have other properties (e.g. T = { (): void; bar: number; }). We don't support that and need a cast/assert.
        var existingMethod = descriptor.value;
        assert.ok(_.isFunction(existingMethod), 'Can only use @enableAutoSubscribe on methods');
        descriptor.value = enableAutoSubscribeWrapper(handler, existingMethod, undefined);
        return descriptor;
    };
}
exports.enableAutoSubscribe = enableAutoSubscribe;
// Wraps try/finally since those are not optimized.
function _tryFinally(tryFunc, finallyFunc) {
    try {
        return tryFunc();
    }
    finally {
        finallyFunc();
    }
}
function instanceTargetToInstanceTargetWithMetadata(instanceTarget) {
    // Upcast here and make sure property exists
    var newTarget = instanceTarget;
    newTarget.__resubMetadata = newTarget.__resubMetadata || {};
    return newTarget;
}
function getMethodMetadata(instance, methodName) {
    if (!instance.__resubMetadata[methodName]) {
        instance.__resubMetadata[methodName] = {};
    }
    return instance.__resubMetadata[methodName];
}
exports.AutoSubscribeStore = function (func) {
    // Upcast
    var target = instanceTargetToInstanceTargetWithMetadata(func.prototype);
    target.__resubMetadata.__decorated = true;
    if (Options_1.default.development) {
        // Add warning for non-decorated methods.
        _.forEach(Object.getOwnPropertyNames(target), function (property) {
            if (_.isFunction(target[property]) && property !== 'constructor') {
                var metaForMethod = target.__resubMetadata[property];
                if (!metaForMethod || !metaForMethod.hasAutoSubscribeDecorator) {
                    Decorator.decorate([
                        warnIfAutoSubscribeEnabled
                    ], target, property, null);
                }
            }
        });
    }
    return func;
};
// Triggers the handler of the most recent @enableAutoSubscribe method called up the call stack.
function makeAutoSubscribeDecorator(shallow, defaultKeyValues) {
    if (shallow === void 0) { shallow = false; }
    return function (target, methodName, descriptor) {
        var methodNameString = methodName.toString();
        var targetWithMetadata = instanceTargetToInstanceTargetWithMetadata(target);
        var metaForMethod = getMethodMetadata(targetWithMetadata, methodNameString);
        // Record that the target is decorated.
        metaForMethod.hasAutoSubscribeDecorator = true;
        // Save the method being decorated. Note this might not be the original method if already decorated.
        // Note: T might have other properties (e.g. T = { (): void; bar: number; }). We don't support that and need a cast/assert.
        var existingMethod = descriptor.value;
        assert.ok(_.isFunction(existingMethod), 'Can only use @autoSubscribe on methods');
        // Note: we need to be given 'this', so cannot use '=>' syntax.
        descriptor.value = function AutoSubscribe() {
            var _this = this;
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            assert.ok(targetWithMetadata.__resubMetadata.__decorated, 'Missing @AutoSubscribeStore class decorator: "' + methodNameString + '"');
            // Just call the method if no handler is setup.
            var scopedHandleWrapper = handlerWrapper;
            if (!scopedHandleWrapper || scopedHandleWrapper.useAutoSubscriptions === 0 /* None */) {
                return existingMethod.apply(this, args);
            }
            // If this is forbidding auto-subscribe then do not go through the auto-subscribe path below.
            if (scopedHandleWrapper.useAutoSubscriptions === 2 /* Forbid */) {
                assert.ok(false, 'Only Store methods WITHOUT the @autoSubscribe decorator can be called right now (e.g. in render): "'
                    + methodNameString + '"');
                return existingMethod.apply(this, args);
            }
            // Let the handler know about this auto-subscriptions, then proceed to the existing method.
            // Default to Key_All if no @key parameter.
            var specificKeyValues = defaultKeyValues;
            // Try to find an @key parameter in the target's metadata.
            if (metaForMethod.hasIndex) {
                var keyArg = args[metaForMethod.index];
                if (_.isNumber(keyArg)) {
                    keyArg = keyArg.toString();
                }
                assert.ok(keyArg, '@key parameter must be given a non-empty string or number: "' + methodNameString + '"@'
                    + metaForMethod.index + ' was given ' + JSON.stringify(keyArg));
                assert.ok(_.isString(keyArg), '@key parameter must be given a string or number: "' + methodNameString + '"@'
                    + metaForMethod.index);
                specificKeyValues = [keyArg];
            }
            var wasInAutoSubscribe;
            var result = _tryFinally(function () {
                // Disable further auto-subscriptions if shallow.
                scopedHandleWrapper.useAutoSubscriptions = shallow ? 0 /* None */ : 1 /* Enabled */;
                // Any further @warnIfAutoSubscribeEnabled methods are safe.
                wasInAutoSubscribe = scopedHandleWrapper.inAutoSubscribe;
                scopedHandleWrapper.inAutoSubscribe = true;
                // Let the handler know about this auto-subscription.
                _.forEach(specificKeyValues, function (specificKeyValue) {
                    scopedHandleWrapper.handler.handle.apply(scopedHandleWrapper.instance, [scopedHandleWrapper.instance, _this,
                        specificKeyValue]);
                });
                return existingMethod.apply(_this, args);
            }, function () {
                // Must have been previously enabled to reach here.
                scopedHandleWrapper.useAutoSubscriptions = 1 /* Enabled */;
                scopedHandleWrapper.inAutoSubscribe = wasInAutoSubscribe;
            });
            return result;
        };
        return descriptor;
    };
}
exports.autoSubscribe = makeAutoSubscribeDecorator(true, [StoreBase_1.StoreBase.Key_All]);
function autoSubscribeWithKey(keyOrKeys) {
    assert.ok(keyOrKeys || _.isNumber(keyOrKeys), 'Must specify a key when using autoSubscribeWithKey');
    var keys = _.map(_.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys], function (key) { return _.isNumber(key) ? key.toString() : key; });
    return makeAutoSubscribeDecorator(true, keys);
}
exports.autoSubscribeWithKey = autoSubscribeWithKey;
// Records which parameter of an @autoSubscribe method is the key used for the subscription.
// Note: at most one @key can be applied to each method.
function key(target, methodName, index) {
    var targetWithMetadata = instanceTargetToInstanceTargetWithMetadata(target);
    // Shorthand.
    var metaForMethod = getMethodMetadata(targetWithMetadata, methodName);
    assert.ok(!metaForMethod.hasIndex, 'Can only apply @key once per method: only the first will be used: "'
        + methodName + '"@' + index);
    // Save this parameter's index into the target's metadata.
    metaForMethod.index = index;
    metaForMethod.hasIndex = true;
}
exports.key = key;
function disableWarnings(target, methodName, descriptor) {
    var targetWithMetadata = instanceTargetToInstanceTargetWithMetadata(target);
    // Record that the target is decorated.
    var metaForMethod = getMethodMetadata(targetWithMetadata, methodName);
    metaForMethod.hasAutoSubscribeDecorator = true;
    if (!Options_1.default.development) {
        // Warnings are already disabled for production.
        return descriptor;
    }
    // Save the method being decorated. Note this might be another decorator method.
    var existingMethod = descriptor.value;
    // Note: we need to be given 'this', so cannot use '=>' syntax.
    // Note: T might have other properties (e.g. T = { (): void; bar: number; }). We don't support that and need a cast.
    descriptor.value = function DisableWarnings() {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        assert.ok(targetWithMetadata.__resubMetadata.__decorated, 'Missing @AutoSubscribeStore class decorator: "' + methodName + '"');
        // Just call the method if no handler is setup.
        var scopedHandleWrapper = handlerWrapper;
        if (!scopedHandleWrapper || scopedHandleWrapper.useAutoSubscriptions === 0 /* None */) {
            return existingMethod.apply(this, args);
        }
        var wasInAutoSubscribe;
        var wasUseAutoSubscriptions;
        var result = _tryFinally(function () {
            // Any further @warnIfAutoSubscribeEnabled methods are safe.
            wasInAutoSubscribe = scopedHandleWrapper.inAutoSubscribe;
            scopedHandleWrapper.inAutoSubscribe = true;
            // If in a forbidAutoSubscribeWrapper method, any further @autoSubscribe methods are safe.
            wasUseAutoSubscriptions = scopedHandleWrapper.useAutoSubscriptions;
            if (scopedHandleWrapper.useAutoSubscriptions === 2 /* Forbid */) {
                scopedHandleWrapper.useAutoSubscriptions = 0 /* None */;
            }
            return existingMethod.apply(_this, args);
        }, function () {
            scopedHandleWrapper.inAutoSubscribe = wasInAutoSubscribe;
            scopedHandleWrapper.useAutoSubscriptions = wasUseAutoSubscriptions;
        });
        return result;
    };
    return descriptor;
}
exports.disableWarnings = disableWarnings;
// Warns if the method is used in components' @enableAutoSubscribe methods (relying on handler.enableWarnings). E.g.
// _buildState.
function warnIfAutoSubscribeEnabled(target, methodName, descriptor) {
    if (!Options_1.default.development) {
        // Disable warning for production.
        return descriptor;
    }
    var targetWithMetadata = instanceTargetToInstanceTargetWithMetadata(target);
    if (Options_1.default.development) {
        // Ensure the metadata is created for dev warnings
        getMethodMetadata(targetWithMetadata, methodName);
    }
    // Save the method being decorated. Note this might be another decorator method.
    var originalMethod = descriptor.value;
    // Note: we need to be given 'this', so cannot use '=>' syntax.
    // Note: T might have other properties (e.g. T = { (): void; bar: number; }). We don't support that and need a cast.
    descriptor.value = function WarnIfAutoSubscribeEnabled() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        assert.ok(targetWithMetadata.__resubMetadata.__decorated, 'Missing @AutoSubscribeStore class decorator: "' + methodName + '"');
        assert.ok(!handlerWrapper || handlerWrapper.useAutoSubscriptions !== 1 /* Enabled */ || handlerWrapper.inAutoSubscribe, 'Only Store methods with the @autoSubscribe decorator can be called right now (e.g. in _buildState): "' + methodName + '"');
        var result = originalMethod.apply(this, args);
        return result;
    };
    return descriptor;
}
exports.warnIfAutoSubscribeEnabled = warnIfAutoSubscribeEnabled;
