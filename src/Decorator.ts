/**
* Decorator.ts
* Author: Mark Davis
* Copyright: Microsoft 2016
*
* Exposes TypeScript's __decorate function to apply a decorator. Also, documentation about applying descriptors.
*/
// TypeScript should put '__decorate' in the local scope around here.
// Note: See the '__decorate' below it for a better commented version of the same code.

declare var __decorate: Function;
declare var Reflect: { decorate?: Function };

// Unused class. Only here so TypeScript generates the '__decorate' method.
class FakeClassWithDecorator {
    @((FakeClassWithDecoratorPrototype: Object, fooName: string, descriptor: TypedPropertyDescriptor<any>) => descriptor)
    foo() { return 0; }
}

// Decorator 'target' is the prototype of the containing Method/Property/Parameter, or a constructor function for a
// ClassDecorator.
type Target = Object|Function;

// Unifying interface for the {Class, Property, Method, Parameter}Decorator types.
interface Decorator {
    // ClassDecorator
    <T extends Function>(func: T): T|void;
    // PropertyDecorator
    (target: Target, propertyKey: string|symbol): void;
    // MethodDecorator
    <T>(target: Target, propertyKey: string|symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T>|void;
    // ParameterDecorator
    // Note: TypeScript converts this to a decorator like (target, propertyKey) => void, with parameterIndex captured.
    (target: Target, propertyKey: string|symbol, parameterIndex: number): void;
}

// Local copy of '__decorate', just in case TypeScript changes how they do things.

// This can be called a few different ways:
// 1. constructorFunction = __decorate(classDecorators, constructorFunction);
// 2. __decorate(methodOrParameterDecorators, classPrototype, propertyName, null);
// 3. __decorate(propertyDecorators, classPrototype, propertyName, previousPropertyDescriptor || undefined /* not null */);
// 4. Something else that I do not know about.
__decorate = __decorate || function (decorators: Decorator[], target: Target, key: string, desc: PropertyDescriptor) {
    // Will be 2 for ClassDecorators, 4 for the others.
    const argLength_c = arguments.length;
    // 1. ClassDecorator: target.
    // 2. Method/Parameter: the existing property descriptor on the object (if any).
    // 3. Property: the given property descriptor. Usually undefined.
    let currentDescriptor_r: Target|PropertyDescriptor = argLength_c < 3
        ? target
        // Note: Method and Parameter Decorators have desc === null, but PropertyDecorator has desc === void 0.
        : desc === null
            ? desc = Object.getOwnPropertyDescriptor(target, key)
            : desc;
    // decorators[i], used in the loop below.
    let currentDecorator_d: Decorator;

    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function') {
        // Use Reflect to do the work.
        currentDescriptor_r = Reflect.decorate(decorators, target, key, desc);
    } else {
        // No Refect: do it ourself.
        for (var i = decorators.length - 1; i >= 0; i--) {
            currentDecorator_d = decorators[i];
            if (currentDecorator_d) {
                // Apply the decorator to the current descriptor, resulting in the new descriptor.
                currentDescriptor_r = (argLength_c < 3
                    ? currentDecorator_d(currentDescriptor_r as Function)
                    : argLength_c > 3
                        ? currentDecorator_d(target, key, currentDescriptor_r)
                        : currentDecorator_d(target, key)
                ) as Target
                    // Keep using the current descriptor if not given a replacement.
                    || currentDescriptor_r;
            }
        }
    }
    // Return the current desciptor. Also use Object.defineProperty if this is not a ClassDecorator.
    return (argLength_c > 3 && currentDescriptor_r && Object.defineProperty(target, key, currentDescriptor_r)), currentDescriptor_r;
};

export var decorate = __decorate;
