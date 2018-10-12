"use strict";
/**
* Options.ts
* Author: David de Regt
* Copyright: Microsoft 2015
*
* Basic options for ReSub.
*/
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var _ = __importStar(require("./lodashMini"));
var OptionsVals = {
    setTimeout: setTimeout.bind(null),
    clearTimeout: clearTimeout.bind(null),
    shouldComponentUpdateComparator: _.isEqual.bind(_),
    preventTryCatchInRender: false,
    development: typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
};
exports.default = OptionsVals;
