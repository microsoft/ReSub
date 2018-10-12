/**
* Types.ts
* Author: David de Regt
* Copyright: Microsoft 2016
*
* Shared basic types for ReSub.
*/
import { StoreBase } from './StoreBase';
export declare type SubscriptionCallbackFunction = {
    (keys?: string[]): void;
};
export declare type SubscriptionCallbackBuildStateFunction<S> = {
    (keys?: string[]): Partial<S> | void;
};
export interface StoreSubscription<P, S> {
    store: StoreBase;
    callbackBuildState?: SubscriptionCallbackBuildStateFunction<S>;
    callback?: SubscriptionCallbackFunction;
    keyPropertyName?: keyof P;
    specificKeyValue?: string | number;
    enablePropertyName?: keyof P;
}
