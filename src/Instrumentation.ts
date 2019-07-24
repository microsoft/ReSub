/**
 * Instrumentation.ts
 * Author: Lukas Weber
 * Copyright: Microsoft 2017
 */

import { noop } from './utils';

// eslint-disable-next-line no-var
declare var global: {
    performance: Performance;
};

export interface Performance {
    mark: (name: string) => void;
    measure: (name: string, startMark: string, endMark: string) => void;
}

const BuildStateBeginMark = 'ComponentBase._buildState begin';
const BuildStateEndMark = 'ComponentBase._buildState end';
const CallbackBeginMark = 'StoreBase callbacks begin';
const CallbackEndMark = 'StoreBase callbacks end';

export class Instrumentation {
    private _perf = Instrumentation._getPerformanceImpl();

    private static _getPerformanceImpl(): Performance {
        const g = typeof global !== 'undefined' ? global : undefined;
        const w = typeof window !== 'undefined' ? window : undefined;
        const { performance } = (g || w || {performance: undefined});

        if (performance && performance.mark && performance.measure) {
            return performance;
        }

        return {
            mark: noop,
            measure: noop,
        };
    }

    private _measure(measureName: string, beginMark: string, endMark: string): void {
        this._perf.mark(endMark);

        try {
            this._perf.measure(measureName, beginMark, endMark);
        } catch (e) {
            // We might be missing some marks if something would go south
            // at call site and in next attempt measure() will throw
            // an exception which may be misleading and could cover real
            // source of problems so it's better to swallow it as this
            // tool should be as much transparent as possible.
        }
    }

    beginBuildState(): void {
        this._perf.mark(BuildStateBeginMark);
    }

    endBuildState(target: any): void {
        const measureName = `🌀 ${target.name || 'ComponentBase'} build state`;
        this._measure(measureName, BuildStateBeginMark, BuildStateEndMark);
    }

    beginInvokeStoreCallbacks(): void {
        this._perf.mark(CallbackBeginMark);
    }

    endInvokeStoreCallbacks(target: any, count: number): void {
        const measureName = `📦 ${target.name || 'StoreBase'} callbacks(${count})`;
        this._measure(measureName, CallbackBeginMark, CallbackEndMark);
    }
}

// By default, disabled
export let impl: Instrumentation | undefined;

export function setPerformanceMarkingEnabled(enabled: boolean): void {
    impl = enabled ? new Instrumentation() : undefined;
}
