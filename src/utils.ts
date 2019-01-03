/**
 * utils.ts
 * Copyright: Microsoft 2019
 */
import map from 'lodash/map';

export type KeyOrKeys = string | number | (string | number)[];
export const normalizeKeys = (keyOrKeys: KeyOrKeys): string[] => (
    map(Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys], key => typeof key === 'number' ? key.toString() : key)
);
