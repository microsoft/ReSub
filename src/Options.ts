/**
* Options.ts
* Author: David de Regt
* Copyright: Microsoft 2015
*
* Basic options for ReSub.
*/

import _ = require('./lodashMini');

export interface Options {
    // Use this to shim calls to setTimeout/clearTimeout with any other service/local function you want
    setTimeout: (callback: () => void, timeoutMs?: number) => number;
    clearTimeout: (id: number) => void;

    shouldComponentUpdateComparator: <T>(values: T, compareTo: T) => boolean;

    // Default behavior is to try/catch in render and unmount if there was an exception. However, the new React error boundaries
    // makes this redundant. Set to false to disable our extra try/catch behavior.
    preventTryCatchInRender: boolean;

    // Enables development mode -- more run-time checks.  By default, matches the NODE_ENV environment variable -- only set to true when
    // NODE_ENV is set and is set to something other than "production".
    development: boolean;
}

interface Process {
    env: { NODE_ENV?: string };
}
declare var process: Process;

let OptionsVals: Options = {
    setTimeout: setTimeout.bind(null),
    clearTimeout: clearTimeout.bind(null),

    shouldComponentUpdateComparator: _.isEqual.bind(_),

    preventTryCatchInRender: false,

    development: typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
};

export default OptionsVals;
