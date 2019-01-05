/**
  * utils
  *
  * Copyright (c) Microsoft Corporation. All rights reserved.
  * Licensed under the MIT license.
  *
  */
export const assert = (cond: any, message?: string | undefined) => {
    if (!cond) {
        throw new Error(`[resub] ${ message || 'Assertion Failed' }`);
    }
};
