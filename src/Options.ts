/**
* Options.ts
* Author: David de Regt
* Copyright: Microsoft 2015
*
* Basic options for ReSub.
*/

import _ = require('lodash');

export interface IOptions {
    // Use this to shim calls to setTimeout/clearTimeout with any other service/local function you want
    setTimeout: (callback: () => void, timeoutMs?: number) => number;
    clearTimeout: (id: number) => void;

    shouldComponentUpdateComparator: <T>(values: T, compareTo: T) => boolean;

    // Enables development mode -- more run-time checks.  By default, matches the NODE_ENV environment variable -- only set to true when
    // NODE_ENV is set and is set to something other than "production".
    development: boolean;
};

interface IProcess {
    env: { NODE_ENV?: string };
}
declare var process: IProcess;

let OptionsVals: IOptions = {
    setTimeout: setTimeout.bind(null),
    clearTimeout: clearTimeout.bind(null),

    shouldComponentUpdateComparator: _.isEqual.bind(_),

    development: typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
};

export default OptionsVals;
