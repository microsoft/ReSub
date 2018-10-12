/**
* Instrumentation.ts
* Author: Lukas Weber
* Copyright: Microsoft 2017
*
*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import * as _ from './lodashMini';
import Options from './Options';
function getPerformanceImpl() {
    var g = typeof global !== 'undefined' ? global : undefined;
    var w = typeof window !== 'undefined' ? window : undefined;
    var performance = (g || w || {}).performance;
    if (performance && performance.mark && performance.measure) {
        return performance;
    }
    return {
        mark: _.noop,
        measure: _.noop,
    };
}
var BuildStateBeginMark = 'ComponentBase._buildState begin';
var BuildStateEndMark = 'ComponentBase._buildState end';
var CallbackBeginMark = 'StoreBase callbacks begin';
var CallbackEndMark = 'StoreBase callbacks end';
// replace method implementation with noop outside of development mode
function devOnly(target, propertyKey, descriptor) {
    if (!Options.development && descriptor) {
        descriptor.value = _.noop;
    }
}
var Instrumentation = /** @class */ (function () {
    function Instrumentation(performance) {
        if (performance === void 0) { performance = getPerformanceImpl(); }
        this.performance = performance;
    }
    Instrumentation.prototype._measure = function (measureName, beginMark, endMark) {
        this.performance.mark(endMark);
        try {
            this.performance.measure(measureName, beginMark, endMark);
        }
        catch (e) {
            // We might be missing some marks if something would go south
            // at call site and in next attempt measure() will throw
            // an exception which may be misleading and could cover real
            // source of problems so it's better to swallow it as this
            // tool should be as much transparent as possible.
        }
    };
    Instrumentation.prototype.beginBuildState = function () {
        this.performance.mark(BuildStateBeginMark);
    };
    Instrumentation.prototype.endBuildState = function (target) {
        var measureName = "\uD83C\uDF00 " + (target.name || 'ComponentBase') + " build state";
        this._measure(measureName, BuildStateBeginMark, BuildStateEndMark);
    };
    Instrumentation.prototype.beginInvokeStoreCallbacks = function () {
        this.performance.mark(CallbackBeginMark);
    };
    Instrumentation.prototype.endInvokeStoreCallbacks = function (target, count) {
        var measureName = "\uD83D\uDCE6 " + (target.name || 'StoreBase') + " callbacks(" + count + ")";
        this._measure(measureName, CallbackBeginMark, CallbackEndMark);
    };
    __decorate([
        devOnly
    ], Instrumentation.prototype, "beginBuildState", null);
    __decorate([
        devOnly
    ], Instrumentation.prototype, "endBuildState", null);
    __decorate([
        devOnly
    ], Instrumentation.prototype, "beginInvokeStoreCallbacks", null);
    __decorate([
        devOnly
    ], Instrumentation.prototype, "endInvokeStoreCallbacks", null);
    return Instrumentation;
}());
export { Instrumentation };
export default new Instrumentation;
