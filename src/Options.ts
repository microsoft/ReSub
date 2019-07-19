/**
* Options.ts
* Author: David de Regt
* Copyright: Microsoft 2015
*
* Basic options for ReSub.
*/

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IOptions {
    // Use this to shim calls to setTimeout/clearTimeout with any other service/local function you want
    setTimeout: <T extends any[]>(handler: (params: T) => void, timeout?: number | undefined , ...params: T) => number;
    clearTimeout: (id?: number) => void;

    shouldComponentUpdateComparator: <T>(values: T, compareTo: T) => boolean;

    defaultThrottleMs: number;

    // Default behavior is to try/catch in render and unmount if there was an exception. However, the new React error boundaries
    // makes this redundant. Set to false to disable our extra try/catch behavior.
    preventTryCatchInRender: boolean;

    // Enables development mode -- more run-time checks.  By default, matches the NODE_ENV environment variable -- only set to true when
    // NODE_ENV is set and is set to something other than "production".
    development: boolean;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
interface IProcess {
    env: { NODE_ENV?: string };
}
declare var process: IProcess; // eslint-disable-line no-var

let OptionsVals: IOptions = {
    setTimeout: setTimeout.bind(null),
    clearTimeout: clearTimeout.bind(null),
    shouldComponentUpdateComparator: () => false,

    defaultThrottleMs: 0,
    preventTryCatchInRender: false,
    development: typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production',
};

export default OptionsVals;
