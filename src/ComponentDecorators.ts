/**
 * ComponentDecorators.ts
 * Copyright: Microsoft 2019
 *
 * Exposes helper decorator functions for use with ReSub Components
 */

import * as _ from './lodashMini';
import ComponentBase from './ComponentBase';

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
