/**
 * utils.ts
 * Copyright: Microsoft 2019
 */

const CompoundKeyJoinerString = '%&';

export type KeyOrKeys = string | number | (string | number)[];

export function noop(): void {
    // noop
}

export function isFunction(object: any): object is Function {
    return typeof object === 'function';
}

export function isString(object: any): object is string {
    return typeof object === 'string';
}

export function isNumber(object: any): object is number {
    return typeof object === 'number';
}

export const normalizeKey = (key: string | number): string => (
    isNumber(key) ? key.toString() : key
);

export const normalizeKeys = (keyOrKeys: KeyOrKeys): string[] => (
    Array.isArray(keyOrKeys) ? keyOrKeys.map(normalizeKey) : [normalizeKey(keyOrKeys)]
);

export const formCompoundKey = (...keys: (string | number)[]): string => keys.join(CompoundKeyJoinerString);

export const assert = (cond: any, message?: string | undefined): void => {
    if (!cond) {
        throw new Error(`[resub] ${ message || 'Assertion Failed' }`);
    }
};

export const remove = <T>(array: T[], predicate: (value: T) => boolean): void => {
    for (let i = array.length - 1; i >= 0; i--) {
        if (predicate(array[i])) {
            array.splice(i, 1);
        }
    }
};

export const uniq = <T>(array: T[]): T[] => {
    const set = new Set(array);
    if (isFunction(Array.from)) {
        return Array.from(set);
    }

    const uniq: T[] = [];
    set.forEach(value => uniq.push(value));

    return uniq;
};

export const find = <T>(array: T[], predicate: (value: T, index: number, array: T[]) => boolean): T | undefined => {
    if (isFunction(array.find)) {
        return array.find(predicate);
    }

    const len = array.length;
    for (let i = 0; i < len; i++) {
        if (predicate(array[i], i, array)) {
            return array[i];
        }
    }

    return undefined;
};
