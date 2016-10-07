/**
* Types.ts
* Author: David de Regt
* Copyright: Microsoft 2016
*
* Shared basic types for ReSub.
*/

import { StoreBase } from './StoreBase';
export type SubscriptionCallbackFunction = { (keys?: string[]): void; }
export type SubscriptionCallbackBuildStateFunction<S> = { (keys?: string[]): S | void; }

export interface StoreSubscription<S> {
    store: StoreBase;
    callbackBuildState?: SubscriptionCallbackBuildStateFunction<S>;
    callback?: SubscriptionCallbackFunction;

    // If we're subscribing to a specific key of a type, what's the name of the React property that we're subscribing
    // against (and detecting changes to)
    keyPropertyName?: string;
    // To subscribe to a specific key instead of the contents of a property, use this
    specificKeyValue?: string|number;
    // Allow toggling of subscription based on prop
    enablePropertyName?: string;
}
