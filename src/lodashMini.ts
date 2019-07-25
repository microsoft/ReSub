/**
* lodashMini.ts
*
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT license.
*
* Imports a subset of lodash library needed for ReSub
*/

import flatten from 'lodash/flatten';
import isEqual from 'lodash/isEqual';
import forEach from 'lodash/forEach';
import remove from 'lodash/remove';
import values from 'lodash/values';
import uniq from 'lodash/uniq';
import pull from 'lodash/pull';
import find from 'lodash/find';

export interface Dictionary<T> {
    [index: string]: T;
}

function isFunction(object: any): object is Function {
    return typeof object === 'function';
}

function isString(object: any): object is string {
    return typeof object === 'string';
}

function isNumber(object: any): object is number {
    return typeof object === 'number';
}

export {
    isFunction,
    isString,
    isNumber,
    flatten,
    isEqual,
    forEach,
    remove,
    values,
    uniq,
    pull,
    find,
};
