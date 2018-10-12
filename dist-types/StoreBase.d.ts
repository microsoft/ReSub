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
import { SubscriptionCallbackFunction } from './Types';
export interface AutoSubscription {
    store: StoreBase;
    callback: () => void;
    key: string;
    used: boolean;
}
export declare abstract class StoreBase {
    private _throttleMs;
    private _bypassTriggerBlocks;
    static readonly Key_All: string;
    private _subscriptions;
    private _autoSubscriptions;
    private _subTokenNum;
    private readonly _subsByNum;
    readonly storeId: string;
    private _throttleData;
    private static _triggerPending;
    private static _isTriggering;
    private static _triggerBlockCount;
    private static _bypassThrottle;
    private static readonly _pendingCallbacks;
    static pushTriggerBlock(): void;
    static popTriggerBlock(): void;
    static setThrottleStatus(enabled: boolean): void;
    constructor(_throttleMs?: number, _bypassTriggerBlocks?: boolean);
    private static _updateExistingMeta;
    protected trigger(keyOrKeys?: string | number | (string | number)[]): void;
    private _resolveThrottledCallbacks;
    private static _resolveCallbacks;
    subscribe(callback: SubscriptionCallbackFunction, rawKey?: string | number): number;
    unsubscribe(subToken: number): void;
    trackAutoSubscription(subscription: AutoSubscription): void;
    removeAutoSubscription(subscription: AutoSubscription): void;
    protected _startedTrackingKey(key: string): void;
    protected _stoppedTrackingKey(key: string): void;
    protected _getSubscriptionKeys(): string[];
    protected _isTrackingKey(key: string): boolean;
}
