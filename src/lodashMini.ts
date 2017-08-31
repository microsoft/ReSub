/**
* lodashMini.ts
*
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT license.
*
* Imports a subset of lodash library needed for ReSub
*/

 import bind = require('lodash/bind');
 import forEach = require('lodash/forEach');
 import extend = require('lodash/extend');
 import isArray = require('lodash/isArray');
 import isFunction = require('lodash/isFunction');
 import isNumber = require('lodash/isNumber');
 import isString = require('lodash/isString');
 import map = require('lodash/map');
 import noop = require('lodash/noop');
 import get = require('lodash/get');
 import isEqual = require('lodash/isEqual');
 import isEmpty = require('lodash/isEmpty');
 import find = require('lodash/find');
 import some = require('lodash/some');
 import remove = require('lodash/remove');
 import findIndex = require('lodash/findIndex');
 import flatten = require('lodash/flatten');
 import values = require('lodash/values');
 import clone = require('lodash/clone');
 import uniq = require('lodash/uniq');
 import indexOf = require('lodash/indexOf');
 import pull = require('lodash/pull');
 import union = require('lodash/union');
 import keys = require('lodash/keys');
 import uniqueId = require('lodash/uniqueId');

 export interface Dictionary<T> {
    [index: string]: T;
}

 export {
    bind,
    forEach,
    isArray,
    isFunction,
    isNumber,
    isString,
    map,
    noop,
    extend,
    get,
    isEqual,
    isEmpty,
    find,
    some,
    remove,
    findIndex,
    flatten,
    values,
    clone,
    uniq,
    indexOf,
    pull,
    union,
    keys,
    uniqueId
};
