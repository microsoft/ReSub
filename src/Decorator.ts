/**
 * Decorator.ts
 * Author: Mark Davis
 * Copyright: Microsoft 2016
 *
 * Exposes TypeScript's __decorate function to apply a decorator.
 */

// TypeScript should put '__decorate' in the local scope around here.
import { __decorate as tslib_decorate } from 'tslib';

declare var __decorate: Function;

// Unused class. Only here so TypeScript generates the '__decorate' method.
class FakeClassWithDecorator {
    @((FakeClassWithDecoratorPrototype: Object, fooName: string, descriptor: TypedPropertyDescriptor<any>) => descriptor)
    foo() { return FakeClassWithDecorator; }
}

// Fallback to the tslib version if this doesn't work.
__decorate = __decorate || tslib_decorate;

export {
    FakeClassWithDecorator as __unused,
    __decorate as decorate,
};
