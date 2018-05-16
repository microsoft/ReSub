/**
* Instrumentation.ts
* Author: Lukas Weber
* Copyright: Microsoft 2017
*
*/

import * as _ from './lodashMini';
import Options from './Options';

export interface Performance {
    mark: (name: string) => void;
    measure: (name: string, startMark: string, endMark: string) => void;
}

function getPerformanceImpl(): Performance {
    const g = typeof global !== 'undefined' ? global : undefined;
    const w = typeof window !== 'undefined' ? window : undefined;
    const { performance } = (g || w || {}) as any;

    if (performance && performance.mark && performance.measure) {
        return performance;
    }

    return {
        mark: _.noop,
        measure: _.noop,
    };
}

const BuildStateBeginMark = 'ComponentBase._buildState begin';
const BuildStateEndMark = 'ComponentBase._buildState end';
const CallbackBeginMark = 'StoreBase callbacks begin';
const CallbackEndMark = 'StoreBase callbacks end';

// replace method implementation with noop outside of development mode
function devOnly(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!Options.development && descriptor) {
        descriptor.value = _.noop;
    }
}

export class Instrumentation {
    constructor(private performance = getPerformanceImpl()) {
    }

    private _measure(measureName: string, beginMark: string, endMark: string) {
        this.performance.mark(endMark);

        try {
            this.performance.measure(measureName, beginMark, endMark);
        } catch (e) {
            // We might be missing some marks if something would go south
            // at call site and in next attempt measure() will throw
            // an exception which may be misleading and could cover real
            // source of problems so it's better to swallow it as this
            // tool should be as much transparent as possible.
        }
    }

    @devOnly
    beginBuildState() {
        this.performance.mark(BuildStateBeginMark);
    }

    @devOnly
    endBuildState(target: any) {
        const measureName = `🌀 ${target.name || 'ComponentBase'} build state`;
        this._measure(measureName, BuildStateBeginMark, BuildStateEndMark);
    }

    @devOnly
    beginInvokeStoreCallbacks() {
        this.performance.mark(CallbackBeginMark);
    }

    @devOnly
    endInvokeStoreCallbacks(target: any, count: number) {
        const measureName = `📦 ${target.name || 'StoreBase'} callbacks(${count})`;
        this._measure(measureName, CallbackBeginMark, CallbackEndMark);
    }
}

export default new Instrumentation;
