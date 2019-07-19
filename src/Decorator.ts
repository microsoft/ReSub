/**
 * Decorator.ts
 * Author: Mark Davis
 * Copyright: Microsoft 2016
 *
 * Exposes TypeScript's __decorate function to apply a decorator.
 */

// TypeScript should put '__decorate' in the local scope around here.
import { __decorate as tslibDecorate } from 'tslib';

declare var __decorate: Function; // eslint-disable-line no-var

// Unused class. Only here so TypeScript generates the '__decorate' method.
class FakeClassWithDecorator {
    @((FakeClassWithDecoratorPrototype: object, fooName: string, descriptor: TypedPropertyDescriptor<any>) => descriptor)
    foo() { return FakeClassWithDecorator; } // eslint-disable-line @typescript-eslint/explicit-function-return-type
}

// Fallback to the tslib version if this doesn't work.
__decorate = __decorate || tslibDecorate;

export {
    FakeClassWithDecorator as __unused,
    __decorate as decorate,
};
