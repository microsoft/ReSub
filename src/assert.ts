/**
  * assert
  *
  * Copyright (c) Microsoft Corporation. All rights reserved.
  * Licensed under the MIT license.
  *
  */
const assert = (cond: any, message?: string | undefined) => {
    if (!cond) {
        throw new Error(`[resub] ${ message || 'Assertion Failed' }`);
    }
};

export default assert;
