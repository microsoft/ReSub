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
// to call the previous 'value', e.g. `if (!__DEV__) { descriptor.value = noop; }`.
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

import * as _ from './lodashMini';
import * as Decorator from './Decorator';
import Options from './Options';
import { assert } from './utils';
import { StoreBase } from './StoreBase';
import ComponentBase from './ComponentBase';

type MetadataIndex = {
    [methodName: string]: MetadataIndexData
};
type MetadataIndexData = {
    hasAutoSubscribeDecorator?: boolean;
    hasIndex?: never;
    index?: number
} | {
    hasAutoSubscribeDecorator?: boolean;
    hasIndex: true;
    index: number
};
type MetadataProperties = { __decorated?: boolean; };
type Metadata = MetadataIndex & MetadataProperties;

// Class prototype for decorated methods/parameters.
type InstanceTargetWithMetadata = InstanceTarget & {
    // Extra property shoved onto targets to hold auto-subscribe metadata.
    __resubMetadata: Metadata;
};

export type InstanceTarget = {};

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
    handler: AutoSubscribeHandler|undefined;
    instance: InstanceTarget;

    useAutoSubscriptions: AutoOptions;
    inAutoSubscribe: boolean;
}

// The current handler info, or null if no handler is setup.
let handlerWrapper: HandlerWraper|undefined;

function createAutoSubscribeWrapper<T extends Function>(handler: AutoSubscribeHandler|undefined, useAutoSubscriptions: AutoOptions,
        existingMethod: T, thisArg: any): T {
    // Note: we need to be given 'this', so cannot use '=>' syntax.
    // Note: T might have other properties (e.g. T = { (): void; bar: number; }). We don't support that and need a cast.
    return <T><any>function AutoSubscribeWrapper(this: any, ...args: any[]) {

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
export function forbidAutoSubscribeWrapper<T extends any[], R>(existingMethod: (...args: T) => R, thisArg?: any): (...args: T) => R {
    if (!Options.development) {
        return thisArg ? existingMethod.bind(thisArg) : existingMethod;
    }
    return createAutoSubscribeWrapper(undefined, AutoOptions.Forbid, existingMethod, thisArg);
}

// Hooks up the handler for @autoSubscribe methods called later down the call stack.
export function enableAutoSubscribe(handler: AutoSubscribeHandler): MethodDecorator {
    return <T>(target: InstanceTarget, propertyKey: string|symbol, descriptor: TypedPropertyDescriptor<T>) => {
        // Note: T might have other properties (e.g. T = { (): void; bar: number; }). We don't support that and need a cast/assert.
        const existingMethod = <Function><any>descriptor.value;
        assert(_.isFunction(existingMethod), 'Can only use @enableAutoSubscribe on methods');

        descriptor.value = <T><any>enableAutoSubscribeWrapper(handler, existingMethod, undefined);
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

function instanceTargetToInstanceTargetWithMetadata(instanceTarget: InstanceTarget): InstanceTargetWithMetadata {
    // Upcast here and make sure property exists
    const newTarget = instanceTarget as InstanceTargetWithMetadata;
    newTarget.__resubMetadata = newTarget.__resubMetadata || {};
    return newTarget;
}

function getMethodMetadata(instance: InstanceTargetWithMetadata, methodName: string): MetadataIndexData {
    if (!instance.__resubMetadata[methodName]) {
        instance.__resubMetadata[methodName] = {};
    }
    return instance.__resubMetadata[methodName];
}

export const AutoSubscribeStore: ClassDecorator = <TFunction extends Function>(func: TFunction): TFunction => {
    // Upcast
    const target = instanceTargetToInstanceTargetWithMetadata(func.prototype);

    target.__resubMetadata.__decorated = true;

    if (Options.development) {
        // Add warning for non-decorated methods.
        _.forEach(Object.getOwnPropertyNames(target), property => {
            if (_.isFunction(target[property]) && property !== 'constructor') {
                const metaForMethod = target.__resubMetadata[property];
                if (!metaForMethod || !metaForMethod.hasAutoSubscribeDecorator) {
                    Decorator.decorate([warnIfAutoSubscribeEnabled], target, property, null);
                }
            }
        });
    }

    return func;
};

export function CustomEqualityShouldComponentUpdate<P extends React.Props<any>, S extends Object>(comparator: (this: ComponentBase<P, S>,
        nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any) => boolean) {
    return function <T extends { new(props: any): ComponentBase<P, S>}>(constructor: T): T {
        constructor.prototype.shouldComponentUpdate = comparator;
        return constructor;
    };
}

export function DeepEqualityShouldComponentUpdate<T extends { new(props: any): ComponentBase<any, any> }>(constructor: T): T {
    return CustomEqualityShouldComponentUpdate<any, any>(deepEqualityComparator)(constructor);
}
function deepEqualityComparator<P extends React.Props<any>, S extends Object>(this: ComponentBase<P, S>, nextProps: Readonly<P>,
        nextState: Readonly<S>, nextContext: any): boolean {
    return !_.isEqual(this.state, nextState) ||
        !_.isEqual(this.props, nextProps) ||
        !_.isEqual(this.context, nextContext);
}

// Triggers the handler of the most recent @enableAutoSubscribe method called up the call stack.
function makeAutoSubscribeDecorator(shallow = false, defaultKeyValues: string[]): MethodDecorator {
    return <T>(target: InstanceTarget, methodName: string|symbol, descriptor: TypedPropertyDescriptor<T>) => {
        const methodNameString = methodName.toString();
        const targetWithMetadata = instanceTargetToInstanceTargetWithMetadata(target);
        const metaForMethod = getMethodMetadata(targetWithMetadata, methodNameString);

        // Record that the target is decorated.
        metaForMethod.hasAutoSubscribeDecorator = true;

        // Save the method being decorated. Note this might not be the original method if already decorated.
        // Note: T might have other properties (e.g. T = { (): void; bar: number; }). We don't support that and need a cast/assert.
        const existingMethod = <Function><any>descriptor.value;
        assert(_.isFunction(existingMethod), 'Can only use @autoSubscribe on methods');

        // Note: we need to be given 'this', so cannot use '=>' syntax.
        descriptor.value = <T><any>function AutoSubscribe(this: any, ...args: any[]) {
            assert(targetWithMetadata.__resubMetadata.__decorated, `Missing @AutoSubscribeStore class decorator: "${ methodNameString }"`);

            // Just call the method if no handler is setup.
            const scopedHandleWrapper = handlerWrapper;
            if (!scopedHandleWrapper || scopedHandleWrapper.useAutoSubscriptions === AutoOptions.None) {
                return existingMethod.apply(this, args);
            }

            // If this is forbidding auto-subscribe then do not go through the auto-subscribe path below.
            if (scopedHandleWrapper.useAutoSubscriptions === AutoOptions.Forbid) {
                assert(false, `Only Store methods WITHOUT the ` +
                    `@autoSubscribe decorator can be called right now (e.g. in render): "${ methodNameString }"`);

                return existingMethod.apply(this, args);
            }

            // Let the handler know about this auto-subscriptions, then proceed to the existing method.

            // Default to Key_All if no @key parameter.
            let specificKeyValues = defaultKeyValues;

            // Try to find an @key parameter in the target's metadata.
            if (metaForMethod.hasIndex) {
                let keyArg: number | string = args[metaForMethod.index];

                if (_.isNumber(keyArg)) {
                    keyArg = keyArg.toString();
                }

                assert(keyArg, `@key parameter must be given a non-empty string or number: ` +
                    `"${ methodNameString }"@${ metaForMethod.index } was given ${ JSON.stringify(keyArg) }`);

                assert(_.isString(keyArg), `@key parameter must be given a string or number: ` +
                    `"${ methodNameString }"@${ metaForMethod.index }`);

                specificKeyValues = [keyArg];
            }

            let wasInAutoSubscribe: boolean;
            const result = _tryFinally(() => {
                // Disable further auto-subscriptions if shallow.
                scopedHandleWrapper.useAutoSubscriptions = shallow ? AutoOptions.None : AutoOptions.Enabled;
                // Any further @warnIfAutoSubscribeEnabled methods are safe.
                wasInAutoSubscribe = scopedHandleWrapper.inAutoSubscribe;
                scopedHandleWrapper.inAutoSubscribe = true;

                // Let the handler know about this auto-subscription.
                _.forEach(specificKeyValues, specificKeyValue => {
                    scopedHandleWrapper.handler!!!.handle.apply(scopedHandleWrapper.instance, [scopedHandleWrapper.instance, this,
                        specificKeyValue]);
                });

                return existingMethod.apply(this, args);
            }, () => {
                // Must have been previously enabled to reach here.
                scopedHandleWrapper.useAutoSubscriptions = AutoOptions.Enabled;
                scopedHandleWrapper.inAutoSubscribe = wasInAutoSubscribe;
            });

            return result;
        };

        return descriptor;
    };
}

export const autoSubscribe = makeAutoSubscribeDecorator(true, [StoreBase.Key_All]);
export function autoSubscribeWithKey(keyOrKeys: string|number|(string|number)[]) {
    assert(keyOrKeys || _.isNumber(keyOrKeys), 'Must specify a key when using "autoSubscribeWithKey"');
    const keys = _.map(Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys], key => _.isNumber(key) ? key.toString() : key);
    return makeAutoSubscribeDecorator(true, keys);
}

// Records which parameter of an @autoSubscribe method is the key used for the subscription.
// Note: at most one @key can be applied to each method.
export function key(target: InstanceTarget, methodName: string, index: number) {
    const targetWithMetadata = instanceTargetToInstanceTargetWithMetadata(target);

    // Shorthand.
    const metaForMethod = getMethodMetadata(targetWithMetadata, methodName);

    assert(!metaForMethod.hasIndex, `Can only apply @key once per method: only the first will be used "${ methodName }"@${ index }`);

    // Save this parameter's index into the target's metadata.
    metaForMethod.index = index;
    metaForMethod.hasIndex = true;
}

export function disableWarnings<T extends Function>(target: InstanceTarget, methodName: string, descriptor: TypedPropertyDescriptor<T>) {
    const targetWithMetadata = instanceTargetToInstanceTargetWithMetadata(target);

    // Record that the target is decorated.
    const metaForMethod = getMethodMetadata(targetWithMetadata, methodName);
    metaForMethod.hasAutoSubscribeDecorator = true;

    if (!Options.development) {
        // Warnings are already disabled for production.
        return descriptor;
    }

    // Save the method being decorated. Note this might be another decorator method.
    const existingMethod = descriptor.value!!!;

    // Note: we need to be given 'this', so cannot use '=>' syntax.
    // Note: T might have other properties (e.g. T = { (): void; bar: number; }). We don't support that and need a cast.
    descriptor.value = <T><any>function DisableWarnings(this: any, ...args: any[]) {
        assert(targetWithMetadata.__resubMetadata.__decorated, `Missing @AutoSubscribeStore class decorator: "${ methodName }"`);

        // Just call the method if no handler is setup.
        const scopedHandleWrapper = handlerWrapper;
        if (!scopedHandleWrapper || scopedHandleWrapper.useAutoSubscriptions === AutoOptions.None) {
            return existingMethod.apply(this, args);
        }

        let wasInAutoSubscribe: boolean;
        let wasUseAutoSubscriptions: AutoOptions;
        const result = _tryFinally(() => {
            // Any further @warnIfAutoSubscribeEnabled methods are safe.
            wasInAutoSubscribe = scopedHandleWrapper.inAutoSubscribe;
            scopedHandleWrapper.inAutoSubscribe = true;

            // If in a forbidAutoSubscribeWrapper method, any further @autoSubscribe methods are safe.
            wasUseAutoSubscriptions = scopedHandleWrapper.useAutoSubscriptions;
            if (scopedHandleWrapper.useAutoSubscriptions === AutoOptions.Forbid) {
                scopedHandleWrapper.useAutoSubscriptions = AutoOptions.None;
            }

            return existingMethod.apply(this, args);
        }, () => {
            scopedHandleWrapper.inAutoSubscribe = wasInAutoSubscribe;
            scopedHandleWrapper.useAutoSubscriptions = wasUseAutoSubscriptions;
        });

        return result;
    };

    return descriptor;
}

// Warns if the method is used in components' @enableAutoSubscribe methods (relying on handler.enableWarnings). E.g.
// _buildState.
export function warnIfAutoSubscribeEnabled<T extends Function>(target: InstanceTarget, methodName: string,
        descriptor: TypedPropertyDescriptor<T>) {
    if (!Options.development) {
        // Disable warning for production.
        return descriptor;
    }

    const targetWithMetadata = instanceTargetToInstanceTargetWithMetadata(target);

    if (Options.development) {
        // Ensure the metadata is created for dev warnings
        getMethodMetadata(targetWithMetadata, methodName);
    }

    // Save the method being decorated. Note this might be another decorator method.
    const originalMethod = descriptor.value!!!;

    // Note: we need to be given 'this', so cannot use '=>' syntax.
    // Note: T might have other properties (e.g. T = { (): void; bar: number; }). We don't support that and need a cast.
    descriptor.value = <T><any>function WarnIfAutoSubscribeEnabled(this: any, ...args: any[]) {
        assert(targetWithMetadata.__resubMetadata.__decorated, `Missing @AutoSubscribeStore class decorator: "${ methodName }"`);
        assert(!handlerWrapper || handlerWrapper.useAutoSubscriptions !== AutoOptions.Enabled || handlerWrapper.inAutoSubscribe,
            `Only Store methods with the @autoSubscribe decorator can be called right now (e.g. in _buildState): "${ methodName }"`);

        return originalMethod.apply(this, args);
    };

    return descriptor;
}
