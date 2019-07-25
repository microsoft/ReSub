/**
 * utils.ts
 * Copyright: Microsoft 2019
 */

const CompoundKeyJoinerString = '%&';

export type KeyOrKeys = string | number | (string | number)[];

export const normalizeKey = (key: string | number): string => (
    typeof key === 'number' ? key.toString() : key
);

export const normalizeKeys = (keyOrKeys: KeyOrKeys): string[] => (
    Array.isArray(keyOrKeys) ? keyOrKeys.map(normalizeKey) : [normalizeKey(keyOrKeys)]
);

export const formCompoundKey = (...keys: (string | number)[]): string => {
    return keys.join(CompoundKeyJoinerString);
};

export const assert = (cond: any, message?: string | undefined): void => {
    if (!cond) {
        throw new Error(`[resub] ${ message || 'Assertion Failed' }`);
    }
};

export function noop(): void {
    // noop
}
