/**
* Types.ts
* Author: David de Regt
* Copyright: Microsoft 2016
*
* Shared basic types for ReSub.
*/

export type SubscriptionCallbackFunction = { (keys?: string[]): void; }
export type SubscriptionCallbackBuildStateFunction<S> = { (keys?: string[]): S | void; }

export interface StoreSubscription<S> {
    store: any; // Should be StoreBase but not a good way to do the interfaces that I could find for that to work...
    callbackBuildState?: SubscriptionCallbackBuildStateFunction<S>;
    callback?: SubscriptionCallbackFunction;
    autoForceUpdate?: boolean;

    // If we're subscribing to a specific key of a type, what's the name of the React property that we're subscribing
    // against (and detecting changes to)
    keyPropertyName?: string;
    // To subscribe to a specific key instead of the contents of a property, use this
    specificKeyValue?: string|number;
    // Allow toggling of subscription based on prop
    enablePropertyName?: string;
}
