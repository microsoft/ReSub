/**
 * Decorator.ts
 * Author: Mark Davis
 * Copyright: Microsoft 2016
 *
 * Exposes TypeScript's __decorate function to apply a decorator.
 */
declare var __decorate: Function;
declare class FakeClassWithDecorator {
    foo(): typeof FakeClassWithDecorator;
}
export { FakeClassWithDecorator as __unused, __decorate as decorate, };
