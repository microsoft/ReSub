/**
* Options.ts
* Author: David de Regt
* Copyright: Microsoft 2015
*
* Basic options for ReSub.
*/
import * as _ from './lodashMini';
var OptionsVals = {
    setTimeout: setTimeout.bind(null),
    clearTimeout: clearTimeout.bind(null),
    shouldComponentUpdateComparator: _.isEqual.bind(_),
    preventTryCatchInRender: false,
    development: typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
};
export default OptionsVals;
