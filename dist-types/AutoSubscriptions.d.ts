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
import { StoreBase } from './StoreBase';
export declare type InstanceTarget = {};
export interface AutoSubscribeHandler {
    handle(instance: InstanceTarget, store: StoreBase, key: string): void;
}
export declare function enableAutoSubscribeWrapper<T extends Function>(handler: AutoSubscribeHandler, existingMethod: T, thisArg: any): T;
export declare function forbidAutoSubscribeWrapper<T extends () => any>(existingMethod: T, thisArg?: any): T;
export declare function enableAutoSubscribe(handler: AutoSubscribeHandler): MethodDecorator;
export declare const AutoSubscribeStore: ClassDecorator;
export declare const autoSubscribe: MethodDecorator;
export declare function autoSubscribeWithKey(keyOrKeys: string | number | (string | number)[]): MethodDecorator;
export declare function key(target: InstanceTarget, methodName: string, index: number): void;
export declare function disableWarnings<T extends Function>(target: InstanceTarget, methodName: string, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T>;
export declare function warnIfAutoSubscribeEnabled<T extends Function>(target: InstanceTarget, methodName: string, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T>;
