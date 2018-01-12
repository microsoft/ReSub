/**
* Instrumentation.ts
* Author: Lukas Weber
* Copyright: Microsoft 2017
*
*/

import _ = require('./lodashMini');

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

    @devOnly
    beginBuildState() {
        this.performance.mark(BuildStateBeginMark);
    }

    @devOnly
    endBuildState(target: any) {
        this.performance.mark(BuildStateEndMark);
        this.performance.measure(`🌀 ${target.name || 'ComponentBase'} callback`, BuildStateBeginMark, BuildStateEndMark);
    }

    @devOnly
    beginStoreCallback() {
        this.performance.mark(CallbackBeginMark);
    }

    @devOnly
    endStoreCallback(target: any) {
        this.performance.mark(CallbackEndMark);
        this.performance.measure(`📦 ${target.name || 'StoreBase'} callback`, CallbackBeginMark, CallbackEndMark);
    }
}

export default new Instrumentation;
