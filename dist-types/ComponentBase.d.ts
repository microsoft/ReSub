/**
* ComponentBase.ts
* Author: David de Regt
* Copyright: Microsoft 2016
*
* Base class for React components, adding in support for automatic store registration and unregistration.
*/
import * as React from 'react';
import { StoreSubscription } from './Types';
export declare abstract class ComponentBase<P extends React.Props<any>, S extends Object> extends React.Component<P, S> {
    private static _nextSubscriptionId;
    private _handledSubscriptions;
    private _handledAutoSubscriptions;
    private _handledSubscriptionsLookup;
    private _isMounted;
    constructor(props: P);
    protected _initStoreSubscriptions(): StoreSubscription<P, S>[];
    componentWillMount(): void;
    componentWillReceiveProps(nextProps: Readonly<P>, nextContext: any): void;
    componentWillUnmount(): void;
    componentWillUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): void;
    shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): boolean;
    isComponentMounted(): boolean;
    protected _addSubscription(subscription: StoreSubscription<P, S>): StoreSubscription<P, S> | undefined;
    protected _removeSubscription(subscription: StoreSubscription<P, S>): StoreSubscription<P, S>[];
    private _registerSubscription;
    private _cleanupSubscription;
    private _shouldRemoveAndCleanupAutoSubscription;
    private _onSubscriptionChanged;
    private _onAutoSubscriptionChanged;
    private _addSubscriptionToLookup;
    private _removeSubscriptionFromLookup;
    private _handleAutoSubscribe;
    private _hasMatchingSubscription;
    private _findMatchingAutoSubscription;
    private _findKeyFromPropertyName;
    private _isEnabledByPropertyName;
    private static _autoSubscribeHandler;
    private _buildStateWithAutoSubscriptions;
    protected _buildState(props: P, initialBuild: boolean): Partial<S> | undefined;
    protected _buildInitialState(): Readonly<S>;
    componentDidMount(): void;
    componentDidUpdate(prevProps: Readonly<P>, prevState: S, prevContext: any): void;
    protected _componentDidRender(): void;
}
export default ComponentBase;
