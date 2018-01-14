/**
* withStoreSubscription.ts
* Author: Brent Traut
* Copyright: Microsoft 2017
*
* withStoreSubscription is a HOC that tries to reduce the store subscription boilerplate
* code. It moves autosubscription values out of state and into props by inserting an extra
* container component.
*
* Create a wrapper factory by passing a buildState function into withStoreSubscription.
* Then pass dumb components into the wrapper factory to wrap them with autosubscribed
* container components that leverage the given buildState method.
*/

'use strict';

import * as React from 'react';
import ComponentBase from './ComponentBase';

export function withStoreSubscription<
    WrapperProps extends React.Props<any>,
    State extends Object
>(buildState: (props?: WrapperProps, initialBuild?: boolean) => State) {
    return (Subject: React.ComponentClass<WrapperProps & State> | React.SFC<WrapperProps & State>) => {
        return class WithStoreSubscription extends ComponentBase<WrapperProps, State> {
            protected _buildState(props: WrapperProps, initialBuild: boolean) {
                return buildState.apply(this, arguments);
            }

            public displayName = `WithSubscription(${Subject.displayName || 'Component'}`;

            public render() {
                return <Subject {...(this.props || {}) as any} {...(this.state || {}) as any} />;
            }
        } as React.ComponentClass<WrapperProps>;
    };
}
