/**
 * ComponentDecorators.ts
 * Copyright: Microsoft 2019
 *
 * Exposes helper decorator functions for use with ReSub Components
 */

import ComponentBase from './ComponentBase';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function CustomEqualityShouldComponentUpdate<P extends {}, S = {}>(
        comparator: (this: ComponentBase<P, S>, nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any) => boolean) {
    return function <T extends { new(props: any): ComponentBase<P, S>}>(constructor: T): T {
        constructor.prototype.shouldComponentUpdate = comparator;
        return constructor;
    };
}
