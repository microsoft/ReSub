/**
* lodashMini.ts
*
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT license.
*
* Imports a subset of lodash library needed for ReSub
*/

import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import flatten from 'lodash/flatten';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import forEach from 'lodash/forEach';
import extend from 'lodash/extend';
import remove from 'lodash/remove';
import values from 'lodash/values';
import uniq from 'lodash/uniq';
import pull from 'lodash/pull';
import find from 'lodash/find';
import get from 'lodash/get';

export interface Dictionary<T> {
    [index: string]: T;
}

export {
    isFunction,
    isString,
    isNumber,
    flatten,
    isEmpty,
    isEqual,
    forEach,
    extend,
    remove,
    values,
    uniq,
    pull,
    find,
    get,
};
