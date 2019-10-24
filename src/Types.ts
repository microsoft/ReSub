/**
* Types.ts
* Author: David de Regt
* Copyright: Microsoft 2016
*
* Shared basic types for ReSub.
*/

export interface SubscriptionCallbackFunction {
    (keys?: string[]): void;
}

