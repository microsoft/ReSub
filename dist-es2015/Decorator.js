/**
 * Decorator.ts
 * Author: Mark Davis
 * Copyright: Microsoft 2016
 *
 * Exposes TypeScript's __decorate function to apply a decorator.
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
// TypeScript should put '__decorate' in the local scope around here.
import { __decorate as tslib_decorate } from 'tslib';
// Unused class. Only here so TypeScript generates the '__decorate' method.
var FakeClassWithDecorator = /** @class */ (function () {
    function FakeClassWithDecorator() {
    }
    FakeClassWithDecorator.prototype.foo = function () { return FakeClassWithDecorator; };
    __decorate([
        (function (FakeClassWithDecoratorPrototype, fooName, descriptor) { return descriptor; })
    ], FakeClassWithDecorator.prototype, "foo", null);
    return FakeClassWithDecorator;
}());
// Fallback to the tslib version if this doesn't work.
__decorate = __decorate || tslib_decorate;
export { FakeClassWithDecorator as __unused, __decorate as decorate, };
