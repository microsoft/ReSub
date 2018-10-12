/**
* Options.ts
* Author: David de Regt
* Copyright: Microsoft 2015
*
* Basic options for ReSub.
*/
export interface IOptions {
    setTimeout: (callback: () => void, timeoutMs?: number) => number;
    clearTimeout: (id: number) => void;
    shouldComponentUpdateComparator: <T>(values: T, compareTo: T) => boolean;
    defaultThrottleMs: number;
    preventTryCatchInRender: boolean;
    development: boolean;
}
declare let OptionsVals: IOptions;
export default OptionsVals;
