"use strict";
/**
* lodashMini.ts
*
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT license.
*
* Imports a subset of lodash library needed for ReSub
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var isUndefined_1 = __importDefault(require("lodash/isUndefined"));
exports.isUndefined = isUndefined_1.default;
var isFunction_1 = __importDefault(require("lodash/isFunction"));
exports.isFunction = isFunction_1.default;
var findIndex_1 = __importDefault(require("lodash/findIndex"));
exports.findIndex = findIndex_1.default;
var isString_1 = __importDefault(require("lodash/isString"));
exports.isString = isString_1.default;
var uniqueId_1 = __importDefault(require("lodash/uniqueId"));
exports.uniqueId = uniqueId_1.default;
var isNumber_1 = __importDefault(require("lodash/isNumber"));
exports.isNumber = isNumber_1.default;
var flatten_1 = __importDefault(require("lodash/flatten"));
exports.flatten = flatten_1.default;
var isEmpty_1 = __importDefault(require("lodash/isEmpty"));
exports.isEmpty = isEmpty_1.default;
var isEqual_1 = __importDefault(require("lodash/isEqual"));
exports.isEqual = isEqual_1.default;
var isArray_1 = __importDefault(require("lodash/isArray"));
exports.isArray = isArray_1.default;
var forEach_1 = __importDefault(require("lodash/forEach"));
exports.forEach = forEach_1.default;
var indexOf_1 = __importDefault(require("lodash/indexOf"));
exports.indexOf = indexOf_1.default;
var extend_1 = __importDefault(require("lodash/extend"));
exports.extend = extend_1.default;
var remove_1 = __importDefault(require("lodash/remove"));
exports.remove = remove_1.default;
var values_1 = __importDefault(require("lodash/values"));
exports.values = values_1.default;
var clone_1 = __importDefault(require("lodash/clone"));
exports.clone = clone_1.default;
var union_1 = __importDefault(require("lodash/union"));
exports.union = union_1.default;
var some_1 = __importDefault(require("lodash/some"));
exports.some = some_1.default;
var uniq_1 = __importDefault(require("lodash/uniq"));
exports.uniq = uniq_1.default;
var pull_1 = __importDefault(require("lodash/pull"));
exports.pull = pull_1.default;
var find_1 = __importDefault(require("lodash/find"));
exports.find = find_1.default;
var keys_1 = __importDefault(require("lodash/keys"));
exports.keys = keys_1.default;
var noop_1 = __importDefault(require("lodash/noop"));
exports.noop = noop_1.default;
var map_1 = __importDefault(require("lodash/map"));
exports.map = map_1.default;
var get_1 = __importDefault(require("lodash/get"));
exports.get = get_1.default;
