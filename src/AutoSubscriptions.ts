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

import _ = require('lodash');
import assert = require('assert');

import Decorator = require('./Decorator');
import Options from './Options';
import { StoreBase } from './StoreBase';

export type MetadataIndex = { [methodName: string]: { hasAutoSubscribeDecorator?: boolean; hasIndex?: boolean; index?: number } };
export type MetadataProperties = { __decorated?: boolean; };
export type Metadata = MetadataIndex & MetadataProperties;

// Class prototype for decorated methods/parameters.
export type InstanceTarget = {
    // Extra property shoved onto targets to hold auto-subscribe metadata.
    __metadata?: Metadata;
};

// Callback and info for setting up auto-subscriptions.
export interface AutoSubscribeHandler {
    handle(instance: InstanceTarget, store: StoreBase, key: string): void;
}

const enum AutoOptions {
    None,
    Enabled,
    Forbid
}

// Holds the handler and info for using it.
interface HandlerWraper {
    handler: AutoSubscribeHandler;
    instance: InstanceTarget;

    useAutoSubscriptions: AutoOptions;
    inAutoSubscribe: boolean;
}

// The current handler info, or null if no handler is setup.
let handlerWrapper: HandlerWraper = null;

function createAutoSubscribeWrapper<T extends Function>(handler: AutoSubscribeHandler, useAutoSubscriptions: AutoOptions, existingMethod: T,
        thisArg: any): T {
    // Note: we need to be given 'this', so cannot use '=>' syntax.
    return <T><any>function AutoSubscribeWrapper(...args: any[]) {

        // Decorators are given 'this', but normal callers can supply it as a parameter.
        const instance = thisArg || this;

        // The handler will now be given all auto-subscribe callbacks.
        const previousHandlerWrapper = handlerWrapper;
        handlerWrapper = {
            handler: handler,
            instance: instance,
            useAutoSubscriptions: useAutoSubscriptions,
            inAutoSubscribe: false
        };

        const result = _tryFinally(() => {
            return existingMethod.apply(instance, args);
        }, () => {
            // Restore the previous handler.
            handlerWrapper = previousHandlerWrapper;
        });

        return result;
    };
}

// Returns a new function with auto-subscriptions enabled.
export function enableAutoSubscribeWrapper<T extends Function>(handler: AutoSubscribeHandler, existingMethod: T, thisArg: any): T {
    return createAutoSubscribeWrapper(handler, AutoOptions.Enabled, existingMethod, thisArg);
}

// Returns a new function that warns if any auto-subscriptions would have been encountered.
export function forbidAutoSubscribeWrapper<T extends Function>(existingMethod: T, thisArg?: any): T {
    if (!Options.development) {
        return <T><any>_.bind(existingMethod, thisArg);
    }
    return createAutoSubscribeWrapper(null, AutoOptions.Forbid, existingMethod, thisArg);
}

// Hooks up the handler for @autoSubscribe methods called later down the call stack.
export function enableAutoSubscribe<T extends Function>(handler: AutoSubscribeHandler): MethodDecorator {
    return (target: InstanceTarget, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => {
        const existingMethod = descriptor.value;

        descriptor.value = enableAutoSubscribeWrapper(handler, existingMethod, undefined);

        return descriptor;
    };
}

// Wraps try/finally since those are not optimized.
function _tryFinally<TResult>(tryFunc: () => TResult, finallyFunc: Function): TResult {
    try {
        return tryFunc();
    } finally {
        finallyFunc();
    }
}

export var AutoSubscribeStore: ClassDecorator = (func: Function) => {
    const target = <InstanceTarget> func.prototype;
    target.__metadata = target.__metadata || {};

    target.__metadata.__decorated = true;

    if (Options.development) {
        // Add warning for non-decorated methods.
        _.each(Object.getOwnPropertyNames(target), property => {
            if (_.isFunction(target[property]) && property !== 'constructor') {
                const metaForMethod = target.__metadata[property];
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
function makeAutoSubscribeDecorator<T extends Function>(shallow = false, defaultKeyValue: string): MethodDecorator {
    return (target: InstanceTarget, methodName: string, descriptor: TypedPropertyDescriptor<T>) => {
        target.__metadata = target.__metadata || {};
        target.__metadata[methodName] = target.__metadata[methodName] || {};

        // Record that the target is decorated.
        target.__metadata[methodName].hasAutoSubscribeDecorator = true;

        // Save the method being decorated. Note this might not be the original method if already decorated.
        const existingMethod = descriptor.value;

        // Note: we need to be given 'this', so cannot use '=>' syntax.
        descriptor.value = <T><any>function AutoSubscribe(...args: any[]) {
            assert.ok(target.__metadata.__decorated, 'Missing @AutoSubscribeStore class decorator: "' + methodName + '"');

            // Just call the method if no handler is setup.
            if (!handlerWrapper || handlerWrapper.useAutoSubscriptions === AutoOptions.None) {
                return existingMethod.apply(this, args);
            }

            // If this is forbidding auto-subscribe then do not go through the auto-subscribe path below.
            if (handlerWrapper.useAutoSubscriptions === AutoOptions.Forbid) {
                assert.ok(false, 'Only Store methods WITHOUT the @autoSubscribe decorator can be called right now (e.g. in render): "'
                        + methodName + '"');
                return existingMethod.apply(this, args);
            }

            // Let the handler know about this auto-subscriptions, then proceed to the existing method.

            // Default to Key_All if no @key parameter.
            let specificKeyValue = defaultKeyValue;

            // Try to find an @key parameter in the target's metadata.
            const metaForMethod = target.__metadata[methodName];
            assert.ok(metaForMethod, 'Internal failure: what happened to the metadata for this method?');
            if (metaForMethod.hasIndex) {
                let keyArg = args[metaForMethod.index];

                if (_.isNumber(keyArg)) {
                    keyArg = keyArg.toString();
                }

                assert.ok(keyArg, '@key parameter must be given a non-empty string or number: "' + methodName + '"@' + metaForMethod.index
                    + ' was given ' + JSON.stringify(keyArg));
                assert.ok(_.isString(keyArg), '@key parameter must be given a string or number: "' + methodName + '"@' + metaForMethod.index);

                specificKeyValue = keyArg;
            }

            let wasInAutoSubscribe: boolean;
            const result = _tryFinally(() => {
                // Disable further auto-subscriptions if shallow.
                handlerWrapper.useAutoSubscriptions = shallow ? AutoOptions.None : AutoOptions.Enabled;
                // Any further @warnIfAutoSubscribeEnabled methods are safe.
                wasInAutoSubscribe = handlerWrapper.inAutoSubscribe;
                handlerWrapper.inAutoSubscribe = true;

                // Let the handler know about this auto-subscription.
                handlerWrapper.handler.handle.apply(handlerWrapper.instance, [handlerWrapper.instance, this, specificKeyValue]);

                return existingMethod.apply(this, args);
            }, () => {
                // Must have been previously enabled to reach here.
                handlerWrapper.useAutoSubscriptions = AutoOptions.Enabled;
                handlerWrapper.inAutoSubscribe = wasInAutoSubscribe;
            });

            return result;
        };

        return descriptor;
    };
}

export var autoSubscribe = makeAutoSubscribeDecorator(true, StoreBase.Key_All);
export function autoSubscribeWithKey(key: string) { return makeAutoSubscribeDecorator(true, key); };

// Records which parameter of an @autoSubscribe method is the key used for the subscription.
// Note: at most one @key can be applied to each method.
export function key(target: InstanceTarget, methodName: string, index: number) {
    target.__metadata = target.__metadata || {};
    target.__metadata[methodName] = target.__metadata[methodName] || {};

    // Shorthand.
    const metaForMethod = target.__metadata[methodName];

    assert.ok(!metaForMethod.hasIndex, 'Can only apply @key once per method: only the first will be used: "'
        + methodName + '"@' + index);

    // Save this parameter's index into the target's metadata.
    metaForMethod.index = index;
    metaForMethod.hasIndex = true;
}

export function disableWarnings<T extends Function>(target: InstanceTarget, methodName: string, descriptor: TypedPropertyDescriptor<T>) {
    target.__metadata = target.__metadata || {};
    target.__metadata[methodName] = target.__metadata[methodName] || {};

    // Record that the target is decorated.
    target.__metadata[methodName].hasAutoSubscribeDecorator = true;

    if (!Options.development) {
        // Warnings are already disabled for production.
        return descriptor;
    }

    // Save the method being decorated. Note this might be another decorator method.
    const existingMethod = descriptor.value;

    // Note: we need to be given 'this', so cannot use '=>' syntax.
    descriptor.value = <T><any>function DisableWarnings(...args: any[]) {
        assert.ok(target.__metadata.__decorated, 'Missing @AutoSubscribeStore class decorator: "' + methodName + '"');

        // Just call the method if no handler is setup.
        if (!handlerWrapper || handlerWrapper.useAutoSubscriptions === AutoOptions.None) {
            return existingMethod.apply(this, args);
        }

        let wasInAutoSubscribe: boolean;
        let wasUseAutoSubscriptions: AutoOptions;
        const result = _tryFinally(() => {
            // Any further @warnIfAutoSubscribeEnabled methods are safe.
            wasInAutoSubscribe = handlerWrapper.inAutoSubscribe;
            handlerWrapper.inAutoSubscribe = true;

            // If in a forbidAutoSubscribeWrapper method, any further @autoSubscribe methods are safe.
            wasUseAutoSubscriptions = handlerWrapper.useAutoSubscriptions;
            if (handlerWrapper.useAutoSubscriptions === AutoOptions.Forbid) {
                handlerWrapper.useAutoSubscriptions = AutoOptions.None;
            }

            return existingMethod.apply(this, args);
        }, () => {
            handlerWrapper.inAutoSubscribe = wasInAutoSubscribe;
            handlerWrapper.useAutoSubscriptions = wasUseAutoSubscriptions;
        });

        return result;
    };

    return descriptor;
}

// Warns if the method is used in components' @enableAutoSubscribe methods (relying on handler.enableWarnings). E.g.
// _buildState.
export function warnIfAutoSubscribeEnabled<T extends Function>(target: InstanceTarget, methodName: string, descriptor: TypedPropertyDescriptor<T>) {
    if (!Options.development) {
        // Disable warning for production.
        return descriptor;
    }

    target.__metadata = target.__metadata || {};
    target.__metadata[methodName] = target.__metadata[methodName] || {};

    // Save the method being decorated. Note this might be another decorator method.
    const originalMethod = descriptor.value;

    // Note: we need to be given 'this', so cannot use '=>' syntax.
    descriptor.value = <T><any>function WarnIfAutoSubscribeEnabled(...args: any[]) {
        assert.ok(target.__metadata.__decorated, 'Missing @AutoSubscribeStore class decorator: "' + methodName + '"');

        assert.ok(!handlerWrapper || handlerWrapper.useAutoSubscriptions !== AutoOptions.Enabled || handlerWrapper.inAutoSubscribe,
            'Only Store methods with the @autoSubscribe decorator can be called right now (e.g. in _buildState): "' + methodName + '"');

        const result = originalMethod.apply(this, args);
        return result;
    };

    return descriptor;
}
