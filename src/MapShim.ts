/**
* MapShim.ts
* Author: David de Regt
* Copyright: Microsoft 2016
*
* ES6-compliant browsers/devices support a new construct called a Map.  This is like a standard hashmap dictionary, but supports
* a variety of key types (not limited to strings).  This class shims support for Maps on systems that don't have it.  Note that the
* lookup in the shim mode is a linear lookup, and hence quite slow, so be careful about using this class unless you absolutely
* have no other choice.
*/

import _ = require('lodash');

// Limiting the interface since IE11 doesn't support much of it
export interface Map<K, V> {
    clear(): void;
    delete(key: K): boolean;
    forEach(callbackfn: (value: V, index: K, map: Map<K, V>) => void): void;
    get(key: K): V;
    has(key: K): boolean;
    set(key: K, value?: V): Map<K, V>;
    size: number;
}

export interface MapConstructor {
    new <K, V>(): Map<K, V>;
    prototype: Map<any, any>;
}

declare var Map: MapConstructor;

interface IMapShimItem<K, V> {
    key: K;
    value: V;
}

class MapShim<K, V> implements Map<K, V> {
    private _mapShimItems: IMapShimItem<K, V>[] = [];

    size: number = 0;

    clear(): void {
        this._mapShimItems = [];
        this.size = 0;
    }

    delete(key: K): boolean {
        const index = _.findIndex(this._mapShimItems, item => item.key === key);
        if (index === -1) {
            return false;
        }

        this._mapShimItems.splice(index, 1);
        this.size--;
        return true;
    }

    forEach(callbackfn: (value: V, index: K, map: Map<K, V>) => void): void {
        _.each(this._mapShimItems, item => callbackfn(item.value, item.key, this));
    }

    get(key: K): V {
        const index = _.findIndex(this._mapShimItems, item => item.key === key);
        if (index === -1) {
            return undefined;
        }

        return this._mapShimItems[index].value;
    }

    has(key: K): boolean {
        return _.some(this._mapShimItems, item => item.key === key);
    }

    set(key: K, value?: V): Map<K, V> {
        const item = _.find(this._mapShimItems, item => item.key === key);
        if (item) {
            item.value = value;
        } else {
            this._mapShimItems.push({ key: key, value: value });
            this.size++;
        }
        return this;
    }
}

export default (typeof Map !== 'undefined' ? Map : MapShim) as MapConstructor;
