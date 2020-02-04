/**
* ComponentBase.ts
* Author: David de Regt
* Copyright: Microsoft 2016
*
* Base class for React components, adding in support for automatic store registration and unregistration.
*/

import * as React from 'react';

import Options from './Options';
import * as Instrumentation from './Instrumentation';
import { forbidAutoSubscribeWrapper, enableAutoSubscribe } from './AutoSubscriptions';
import { find, noop, remove } from './utils';
import { AutoSubscription, StoreBase } from './StoreBase';

interface InternalState {
    _resubGetInstance: () => ComponentBase<unknown, unknown>;
    _resubDirty: boolean;
}

// ComponentBase actually has InternalState, but we don't want this exposed, so don't indicate that on the component definition
export abstract class ComponentBase<P = {}, S = {}> extends React.Component<P, S> {
    // ComponentBase is provided a method to wrap autosubscriptions via _buildState in a component

    private _handledAutoSubscriptions: AutoSubscription[] = [];

    private _isMounted = false;

    constructor(props: P) {
        super(props);

        const derivedClassRender = this.render || noop;
        let render = derivedClassRender;
        if (!Options.preventTryCatchInRender) {
            render = () => {
                // Handle exceptions because otherwise React would break and the app would become unusable until refresh.
                // Note: React error boundaries will make this redundant.
                try {
                    return derivedClassRender.call(this);
                } catch (e) {
                    // Annoy devs so this gets fixed.
                    if (Options.development) {
                        // tslint:disable-next-line
                        throw e;
                    }

                    // Try to move on.
                    return null;
                }
            };
        }
        // No one should use Store getters in render: do that in _buildState instead.
        this.render = forbidAutoSubscribeWrapper(render, this);

        const instance = this;
        /*
         * We can't call _buildInitialState here, because the properties of the subclass are initialized **after** the base class
         * constructor. https://github.com/microsoft/TypeScript/issues/1617#issuecomment-69215655
         * Therefore we need to call it after the constructor.
         * Since getDerivedStateFromProps is called after the constructor, we can ensure, that the state is properly initialized
         * there.
         * But we need to put the instance into the state, so that getDerivedStateFromProps works.
         * Hence the rather hacky type conversion.
         */
        // eslint-disable-next-line
        this.state = {
            _resubGetInstance: () => instance,
            _resubDirty: false,
        } as InternalState as unknown as S;
    }

    // Subclasses may redeclare, but must call ComponentBase.getDerivedStateFromProps
    static getDerivedStateFromProps: React.GetDerivedStateFromProps<unknown, unknown> =
    (nextProps, prevState: unknown) => {
        const internalState = prevState as Readonly<InternalState>;
        if (!internalState._resubGetInstance) {
            throw new Error('Resub internal state missing - ensure you aren\'t setting state directly in component construtor');
        }
        let newState: unknown & Partial<InternalState>;
        const instance = internalState._resubGetInstance();
        if (!instance._isMounted) {
            newState = instance._buildInitialState();
        } else {
            newState = instance._handleUpdate(nextProps, internalState) || {};
        }

        // reset dirty bit
        newState._resubDirty = false;
        return newState;
    };

    private _handleUpdate(nextProps: Readonly<P>, incomingState: Readonly<S>): Partial<S> | null {
        if (!Options.shouldComponentUpdateComparator(this.props, nextProps)) {
            const newState = this._buildStateWithAutoSubscriptions(nextProps, incomingState, false);
            if (newState && Object.keys(newState).length) {
                return newState;
            }
        }
        return null;
    }

    // Subclasses may override, but _MUST_ call super.
    componentWillUnmount(): void {
        // Remove and cleanup all suscriptions
        this._handledAutoSubscriptions.forEach(subscription => {
            subscription.used = false;
            subscription.store.removeAutoSubscription(subscription);
        });

        this._handledAutoSubscriptions = [];
        this._isMounted = false;
    }

    shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): boolean {
        return !Options.shouldComponentUpdateComparator(this.state, nextState) ||
            !Options.shouldComponentUpdateComparator(this.props, nextProps) ||
            !Options.shouldComponentUpdateComparator(this.context, nextContext);
    }

    isComponentMounted(): boolean {
        return this._isMounted;
    }

    private _shouldRemoveAndCleanupAutoSubscription(subscription: AutoSubscription): boolean {
        return !subscription.used;
    }

    // Performance optimization - don't put this in _onAutoSubscriptionChanged because every component will have it's own
    // instance of the function instead of hanging off the prototype. Bound functions also lack some runtime optimizations
    private static _onAutoSubscriptionChangedUnbound<P, S extends {}>(that: ComponentBase<P, S>): void {
        if (!that.isComponentMounted()) {
            return;
        }

        // eslint-disable-next-line
        that.setState({_resubDirty: true} as InternalState as any);
    }

    private _onAutoSubscriptionChanged = (): void => {
        ComponentBase._onAutoSubscriptionChangedUnbound(this);
    };

    private _handleAutoSubscribe(store: StoreBase, key: string): void {
        // Check for an existing auto-subscription.
        const autoSubscription = this._findMatchingAutoSubscription(store, key);
        if (autoSubscription) {
            // Set auto-subscription as used
            autoSubscription.used = true;
            return;
        }

        // None found: auto-subscribe!
        const subscription: AutoSubscription = {
            store: store,
            // Note: an undefined specificKeyValue will use Key_All by default.
            key: key,
            callback: this._onAutoSubscriptionChanged,
            used: true,
        };
        this._handledAutoSubscriptions.push(subscription);
        subscription.store.trackAutoSubscription(subscription);
    }

    // Search already handled auto-subscription
    private _findMatchingAutoSubscription(store: StoreBase, key: string): AutoSubscription | undefined {
        return find(this._handledAutoSubscriptions, subscription => (
            (subscription.store.storeId === store.storeId) &&
            (subscription.key === key || subscription.key === StoreBase.Key_All)
        ));
    }

    // Handler for enableAutoSubscribe that does the actual auto-subscription work.
    private static _autoSubscribeHandler = {
        // Callback to handle the 'auto-subscribe'.
        handle(self: ComponentBase<any, any>, store: StoreBase, key: string) {
            self._handleAutoSubscribe(store, key);
        },
    };

    @enableAutoSubscribe(ComponentBase._autoSubscribeHandler)
    private _buildStateWithAutoSubscriptions(props: P, incomingState: undefined | Readonly<S>, initialBuild: boolean):
    Partial<S> | undefined {
        this._handledAutoSubscriptions.forEach(sub => {
            sub.used = false;
        });

        if (Instrumentation.impl) { Instrumentation.impl.beginBuildState(); }
        const state: Partial<S> | undefined = this._buildState(props, initialBuild, incomingState);
        if (Instrumentation.impl) { Instrumentation.impl.endBuildState(this.constructor); }

        remove(this._handledAutoSubscriptions, subscription => {
            if (this._shouldRemoveAndCleanupAutoSubscription(subscription)) {
                subscription.store.removeAutoSubscription(subscription);
                return true;
            }

            return false;
        });

        return state;
    }

    // All but the simplest of components should implement this virtual function.  This function is called in 3 places
    // by the framework:
    // 1. In the component constructor, it's called with the initial props and initialBuild = true.  This is where you should set all
    //    initial state for your component.  In many cases this case needs no special casing whatsoever because the component always
    //    rebuilds all of its state from whatever the props are, whether it's an initial build or a new props received event.
    // 2. In the React lifecycle, during a UNSAFE_componentWillReceiveProps, if the props change (determined by a _.isEqual), this is called
    //    so that the component can rebuild state from the new props.
    // 3. If the component subscribes to any stores via the ComponentBase subscription system, if a specific callback function is not
    //    specified, then this function is called whenever the subscription is triggered.  Basically, this should be used if there are
    //    no performance considerations with simply rebuilding the whole component whenever a subscription is triggered, which is
    //    very often the case.
    //
    // In the majority of cases, this turns into a simple function that doesn't care about initialBuild, and simply
    // rebuilds the whole state of the component whenever called.  This should usually only be made more specific if
    // there are performance considerations with over-rebuilding.
    protected _buildState(props: P, initialBuild: boolean, incomingState: Readonly<S> | undefined): Partial<S> | undefined {
        return undefined;
    }

    // The initial state is unavailable in UNSAFE_componentWillMount. Override this method to get access to it.
    // Subclasses may override, but _MUST_ call super.
    protected _buildInitialState(): Readonly<S> {
        // Initialize state, here we omit the internal state to the user
        const initialState = this._buildStateWithAutoSubscriptions(this.props, undefined, true) || {};
        return initialState as S;
    }

    // Wrap both didMount and didUpdate into componentDidRender
    componentDidMount(): void {
        this._isMounted = true;
        this._componentDidRender();
    }

    componentDidUpdate(prevProps: Readonly<P>, prevState: S, prevContext: any): void {
        this._componentDidRender();
    }

    protected _componentDidRender(): void {
        // Virtual helper function to override as needed
    }
}

export default ComponentBase;
