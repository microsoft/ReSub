/**
* ReSub.ts
* Author: David de Regt
* Copyright: Microsoft 2016
*
* Shared basic types for ReSub.
*/

import ComponentBaseI = require('./ComponentBase');
import AutoSubscriptionsI = require('./AutoSubscriptions');
import StoreBaseI = require('./StoreBase');
import TypesI = require('./Types');

export const ComponentBase = ComponentBaseI.default;

export const StoreBase = StoreBaseI.StoreBase;

export const AutoSubscribeStore = AutoSubscriptionsI.AutoSubscribeStore;
export const autoSubscribe = AutoSubscriptionsI.autoSubscribe;
export const autoSubscribeWithKey = AutoSubscriptionsI.autoSubscribeWithKey;
export const key = AutoSubscriptionsI.key;
export const disableWarnings = AutoSubscriptionsI.disableWarnings;

export import Types = TypesI;
