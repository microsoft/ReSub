/**
* Instrumentation.ts
* Author: Lukas Weber
* Copyright: Microsoft 2017
*
*/
export interface Performance {
    mark: (name: string) => void;
    measure: (name: string, startMark: string, endMark: string) => void;
}
export declare class Instrumentation {
    private performance;
    constructor(performance?: Performance);
    private _measure;
    beginBuildState(): void;
    endBuildState(target: any): void;
    beginInvokeStoreCallbacks(): void;
    endInvokeStoreCallbacks(target: any, count: number): void;
}
declare const _default: Instrumentation;
export default _default;
