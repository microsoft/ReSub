/**
 * ComponentDecorators.ts
 * Copyright: Microsoft 2019
 *
 * Exposes helper decorator functions for use with ReSub Components
 */

import { isEqual, Dictionary } from './lodashMini';
import ComponentBase from './ComponentBase';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function CustomEqualityShouldComponentUpdate<P extends React.Props<any>, S extends Dictionary<any>>(
        comparator: (this: ComponentBase<P, S>, nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any) => boolean) {
    return function <T extends { new(props: any): ComponentBase<P, S>}>(constructor: T): T {
        constructor.prototype.shouldComponentUpdate = comparator;
        return constructor;
    };
}

export function DeepEqualityShouldComponentUpdate<T extends { new(props: any): ComponentBase<any, any> }>(constructor: T): T {
    return CustomEqualityShouldComponentUpdate<any, any>(deepEqualityComparator)(constructor);
}

function deepEqualityComparator<P extends React.Props<any>, S extends Dictionary<any>>(
        this: ComponentBase<P, S>, nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): boolean {
    return isEqual(this.state, nextState) || isEqual(this.props, nextProps) || isEqual(this.context, nextContext);
}
