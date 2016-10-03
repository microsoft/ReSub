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

    // Enables development mode -- more run-time checks
    development: boolean;
};

let OptionsVals: IOptions = {
    setTimeout: setTimeout.bind(null),
    clearTimeout: clearTimeout.bind(null),

    development: true
};

export default OptionsVals;
