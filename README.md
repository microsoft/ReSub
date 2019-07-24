# ReSub

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://github.com/Microsoft/ReSub/blob/master/LICENSE) [![npm version](https://img.shields.io/npm/v/resub.svg?style=flat-square)](https://www.npmjs.com/package/resub) [![npm downloads](https://img.shields.io/npm/dm/resub.svg?style=flat-square)](https://www.npmjs.com/package/resub) [![Build Status](https://img.shields.io/travis/Microsoft/ReSub/master.svg?style=flat-square)](https://travis-ci.org/Microsoft/ReSub) [![David](https://img.shields.io/david/Microsoft/ReSub.svg?style=flat-square)](https://github.com/Microsoft/ReSub) [![David](https://img.shields.io/david/dev/Microsoft/ReSub.svg?style=flat-square)](https://github.com/Microsoft/ReSub)

A library for writing better React components and data stores. Uses automatic subscriptions to reduce code and avoid common data flow pitfalls. Scales for projects of all sizes and works great with TypeScript.

## Overview

In React’s early days, Flux gave us guidance on how to manage data flow in our apps. At its core, data would be placed into stores and React components would fetch it from them. When a store’s data was updated, it would notify all concerned components and give them the opportunity to rebuild their states.

While Flux works well, it can also be cumbersome and error prone. Separate actions, action creators, and stores can result in a great deal of boilerplate code. Developers can fetch data from a store but fail to subscribe to changes, or components can oversubscribe and cause performance issues. Furthermore, developers are left to implement these patterns from scratch.

ReSub aims to eliminate these limitations (and more) through the use of automatic data binding between stores and components called autosubscriptions. By using TypeScript’s method decorators, ReSub components can subscribe to only the data they need on only the stores that provide it, all without writing any code.

## Basic Example

The easiest way to understand ReSub is to see it in action. Let’s make a simple todo app.

The heavy lifting in ReSub is done mostly within two classes, `ComponentBase` and `StoreBase`. It’s from these that we make subclasses and implement the appropriate virtual functions.

First, we create a store to hold todos:

```typescript
import { StoreBase, AutoSubscribeStore, autoSubscribe } from 'resub';

@AutoSubscribeStore
class TodosStore extends StoreBase {
    private _todos: string[] = [];

    addTodo(todo: string) {
        // Don't use .push here, we need a new array since the old _todos array was passed to the component by reference value
        this._todos = this._todos.concat(todo);
        this.trigger();
    }

    @autoSubscribe
    getTodos() {
        return this._todos;
    }
}

export = new TodosStore();
```

Next, we create a component to display the todos:

```typescript
import * as React from 'react';
import { ComponentBase } from 'resub';

import TodosStore = require('./TodosStore');

interface TodoListState {
    todos?: string[];
}

class TodoList extends ComponentBase<{}, TodoListState> {
    protected _buildState(props: {}, initialBuild: boolean): TodoListState {
        return {
            todos: TodosStore.getTodos()
        }
    }

    render() {
        return (
            <ul className="todos">
                { this.state.todos.map(todo => <li>{ todo }</li> ) }
            </ul>
        );
    }
}

export = TodoList;
```

That’s it. *Done!*

When future todos are added to the `TodoStore`, `TodoList` will automatically fetch them and re-render. This is achieved because `TodoList._buildState` makes a call to `TodosStore.getTodos()` which is decorated as an `@autoSubscribe` method.

## Subscriptions and Scaling

ReSub is built with scalability in mind; it works for apps of all sizes with all scales of data traffic. But this doesn’t mean scalability should be the top concern for every developer. Instead, ReSub encourages developers to create the simplest code possible and to only add complexity and tune performance when it becomes an issue. Follow these guidelines for best results:

1. Start by doing all your work in `_buildState` and rebuilding the state from scratch using autosubscriptions. Tracking deltas and only rebuilding partial state at this stage is unnecessary for the vast majority of components.
2. If you find that components are re-rendering too often, introduce subscriptions keys. For more information, see the “Subscriptions by key” and “Subscriptions by props” sections below.
3. If components are still re-rendering too often, consider using trigger throttling and trigger blocks to cut down on the number of callbacks. For more information, see the “Trigger throttling” and “Trigger blocks” sections below.
4. If rebuilding state completely from scratch is expensive, manual subscriptions with custom callbacks may help. For more information, see the “Custom subscription callbacks” section below.

## A Deep Dive on ReSub Features

### Subscriptions and Triggering

#### Subscriptions by key:

By default, a store will notify all of its subscriptions any time new data is available. This is the simplest approach and useful for many scenarios, however, stores that have heavy data traffic may result in performance bottlenecks. ReSub overcomes this by allowing subscribers to specify a string `key` that limit the scope in which they will trigger.

Consider an example where our Todo app differentiates between high and low priority todo items. Perhaps we want to show a list of all high priority todo items in a `HighPriorityTodoItems` component. This component could subscribe to all changes on the `TodosStore`, but this means it’d re-render even when a new low priority todo was created. That’s wasted effort!

Let’s make `TodosStore` smarter. When a new high priority todo item is added, it should trigger with a special key `TodosStore.Key_HighPriorityTodoAdded` instead of using the default `StoreBase.Key_All` key. Our `HighPriorityTodoItems` component can now subscribe to just this key, and its subscription will trigger whenever `TodosStore` triggers with either `TodosStore.Key_HighPriorityTodoAdded` or `StoreBase.Key_All`, but not for `TodosStore.Key_LowPriorityTodoAdded`.

All of this can still be accomplished using method decorators and autosubscriptions. Let’s create a new method in `TodosStore`:

```javascript
class TodosStore extends StoreBase {
    ...

    static Key_HighPriorityTodoAdded = "Key_HighPriorityTodoAdded";

    @autoSubscribeWithKey(TodosStore.Key_HighPriorityTodoAdded)
    getHighPriorityTodos() {
        return this._highPriorityTodos;
    }
}
```

Components that call `TodosStore.getHighPriorityTodos()` inside `_buildState` will automatically subscribe to all future high priority todos triggers from `TodosStore`.

Alternatively, this subscription can be made manually. Subclasses of `ComponentBase` would implement a `_initStoreSubscriptions` method that returns a custom `StoreSubscription` like the following:

```javascript
protected _initStoreSubscriptions(): StoreSubscription<TodoListState>[] {
    return [{
        store: TodosStore,
        specificKeyValue: 'Key_HighPriorityTodoAdded'
    }];
}
```

*Note: Of course it’s possible to separate high and low priority todo items into separate stores, but sometimes similar data is simultaneously divided on different axes and is therefore difficult to separate into stores without duplicating. Using custom keys is an elegant solution to this problem.*

#### Subscriptions by props:

Once you’re comfortable with key-based subscriptions, you can push the concept further and eliminate even more boilerplate code. `ComponentBase` allows developers to create manual subscriptions that, instead of specifying a `key`, will use whatever value is found inside of a given component `prop`.

For example, perhaps our `TodosList` receives the user’s `username` as a prop, and it only wishes to subscribe to `TodosStore` updates related to that user. This could be established like the following:

```javascript
protected _initStoreSubscriptions(): StoreSubscription<TodoListState>[] {
    return [{
        store: TodosStore,
        keyPropertyName: 'username'
    }];
}
```

Here, `ComponentBase` will automatically read the value from `props.username` and use this as the subscription key on `TodosStore`. If `props.username` is ever modified, the old subscription will be unregistered and a new one will be formed with the new key.

#### Autosubscriptions using `@key`:

Key-based subscriptions are very powerful, but they can be even more powerful and can reduce more boilerplate code when combined with autosubscriptions. Let’s update our `TodosStore` to add the `@key` decorator:

```javascript
class TodosStore extends StoreBase {
    ...

    @autoSubscribe
    getTodosForUser(@key username: string) {
        return this._todosByUser[username];
    }
}
```

Now, we can establish the autosubscription for this user in `_buildState`:

```javascript
class TodoList extends ComponentBase<TodoListProps, TodoListState> {
    ...

    protected _buildState(props: {}, initialBuild: boolean): TodoListState {
        return {
            todos: TodosStore.getTodosForUser(this.props.username)
        }
    }
}
```

`_buildState` will be called when `TodoStore` triggers any changes for the specified username, but not for any other usernames. This eliminates the need completely for any manual subscriptions to be made in `_initStoreSubscriptions`.

#### Compound-key subscriptions/triggering

Sometimes, either when a single store contains hierarchical data, or when you have more than one parameter to a function that you'd like to have key-based subscriptions to (i.e. a user and a name of an object that the user has), the single @key mechanism isn't good enough.  We've added the ability to put @key on multiple parameters to a function, and ReSub concatenates them with the `formCompoundKey` function (also exported by ReSub) to form the actual subscription key.  You can also combine this with @autoSubscribeWithKey to have even more hierarchy on your data.  Note that the @autoSubscribeWithKey value always goes on the _end_ of the compound key, since it should be the most selective part of your hierarchy.

To trigger these compound keys, you execute `this.trigger(ReSub.formCompoundKey('key1val', 'key2val', 'autoSubscribeWithKeyval'))` and it will trigger the key to match the autosubscription of your function.

*NOTE:* Compound keys themselves don't actually support any sort of hierarchy.  If you don't trigger EXACTLY the correct key, your subscriptions will not update.  If you have a key of `['a', 'b', 'c']`, and you trigger `['a', 'b']`, you will be disappointed to find that none of your subscribed components update.  Compound keys are designed to help you provide discrete updates within a hierarchy of data, but are not designed to allow for updating wide swaths of that hierarchy.

Example of correct usage:

```typescript
enum TriggerKeys {
    BoxA = 'a',
    BoxB = 'b',
}
class UserStuffStore extends StoreBase {
    private _stuffByUser: {[userCategory: string]: {[username: string]: {boxA: string; boxB: string;}}}

    @autoSubscribeWithKey(TriggerKeys.BoxA)
    getBoxAForUser(@key userCategory: string, @key username: string) {
        return this._stuffByUser[userCategory][username].boxA;
    }

    @disableWarnings
    setBoxAForUser(userCategory: string, username: string, boxAValue: string): void {
        this._stuffByUser[userCategory][username].boxA = boxAValue;
        this.trigger(ReSub.formCompoundKey(userCategory, username, TriggerKeys.BoxA));
    }
}

class UserBoxADisplay extends ComponentBase<SomeProps, SomeState> {
    ...

    protected _buildState(props: SomeProps, initialBuild: boolean): TodoListState {
        return {
            boxA: UserStuffStore.getBoxAForUser(props.userCategory, props.username),
        };
    }
}
```

#### Custom subscription callbacks:

`StoreSubscriptions` created inside of `_initStoreSubscriptions` will call `_buildState` by default when they trigger. Instead, developers can specify a custom callback in `StoreSubscription` definitions using either `callbackBuildState` (with autosubscription support just like using `_buildState`) or `callback` (no autosubscription support):

```javascript
protected _initStoreSubscriptions(): StoreSubscription<TodoListState>[] {
    return [{
        store: TodosStore,
        keyPropertyName: 'username',
        callbackBuildState: this._userUpdated.bind(this)
    }];
}
```

Custom callbacks are usually unnecessary, but they do give components the opportunity to do delta state management and other performance tuning.

### ComponentBase

To get the most out of ReSub, your components should inherit `ComponentBase` and should implement some or all of the methods below.

#### Callable methods:

##### `isComponentMounted(): boolean`

Returns true if the component is currently mounted, false otherwise. Subclasses should not override this method.

##### `shouldComponentUpdate(nextProps: P, nextState: S): boolean`

ReSub’s implementation of this method always returns true, which is inline with React's guidance.  If you wish to apply optimizations using `shouldComponentUpdate` we provide a few different methods to do this:

1) Provide a `shouldComponentUpdateComparator` to the ReSub `Options` payload. This is the default comparator that is used in `shouldComponentUpdate` for components that extend `ComponentBase`. This is a good way to apply custom `shouldComponentUpdate` logic to all your components.
1) Override `shouldComponentUpdate` in specific components and *don't* call super
1) Apply a decorator to specific component classes to apply default or custom shouldComponentUpdate comparators:
    * `@DeepEqualityShouldComponentUpdate` - This will do a deep equality check (`_.isEqual`) on Props, State & Context and return `true` from `shouldComponentUpdate` if any of the values have changed
    * `@CustomEqualityShouldComponentUpdate(myComparatorFunction)` - This will call your custom comparator function (for Props, State and Context), returning `true` from `shouldComponentUpdate` if your comparator returns false.

*Note: `_.isEqual` is a deep comparison operator, and hence can cause performance issues with deep data structures.*

#### Subclassing:

Subclasses should implement some or all of the following methods:

##### `protected _buildState(props: P, initialBuild: boolean): S`

This method is called to rebuild the module’s state. All but the simplest of components should implement this method. It is called on three occurrences:

1. During initial component construction, `initialBuild` will be true. This is where you should set all initial state for your component. This case rarely needs special treatment because the component always rebuilds all of its state from its props, whether it's an initial build or a new props received event.
2. In the React lifecycle, during a `componentWillReceiveProps`, if the props change (determined by a `_.isEqual`), this is called so that the component can rebuild its state from the new props.
3. When this component subscribes to any stores, this will be called whenever the subscription is triggered. This is the most common usage of subscriptions, and the usage created by autosubscriptions.

Any calls from this method to store methods decorated with `@autoSubscribe` will establish an autosubscription.

React’s `setState` method should not be called directly in this function. Instead, the new state should be returned and `ComponentBase` will call `setState`.

##### `protected _initStoreSubscriptions(): StoreSubscription<S>[]`

This method is called during component construction and should return a list of all `StoreSubscriptions`. These subscriptions will be registered and will work in addition to any autosubscriptions formed later.

##### `protected _componentDidRender()`

This method is automatically called from `componentDidMount` and  `componentDidUpdate`, as both of these methods typically do the same work.

##### `React lifecycle methods`

Methods include:
- `constructor(props: P)`
- `componentWillMount()`
- `componentDidMount()`
- `componentWillUnmount()`
- `componentWillUpdate(nextProps: P, nextState: S)`
- `componentDidUpdate(prevProps: P, prevState: S)`
- `componentWillReceiveProps(nextProps: P)`

Many of these methods are unnecessary in simple components thanks to `_componentDidRender` and `_buildState`, but may be overridden if needed. Implementations in subclasses **must** call super.

### StoreBase

ReSub’s true power is realized when creating subclasses of `StoreBase`. Several features are exposed as public methods on  `StoreBase`, and subclasses should also implement some or all of the virtual methods below.

In addition to providing useful patterns for store creation, `StoreBase` also provides features to squeeze out additional performance through heavy data traffic.

#### Trigger throttling:

By default, a store will instantly (and synchronously) notify all of its subscriptions when `trigger` is called. For stores that have heavy data traffic, this may cause components to re-render far more often than needed.

To solve this issue, stores may specify a throttle time limit by specifying `throttleMs = X` (X being a number of milliseconds) during construction. Any triggers within the time limit will be collected, de-duped, and callbacks will be called after the time is elapsed.

#### Trigger blocks:

In applications with heavy data traffic, especially on mobile browsers, frequent component re-rendering can cause major performance bottlenecks. Trigger throttling (see above) helps this problem, but sometimes this isn’t enough. For example, if the developer wants to show an animation at full 60-fps, it is important that there is little to no other work happening at the same time.

`StoreBase` allows developers to block all subscription triggers on all stores until the block is lifted. All calls to `trigger` in this time will be queued and will be released once the block is lifted.

Because certain stores may be critical to the app, `StoreBase` allows stores to opt out of (and completely ignore) trigger blocks by passing `bypassTriggerBlocks = true` to the constructor.

Multiple stores or components might want to block triggers simultaneously, but for different durations, so `StoreBase` counts the number of blocks in effect and only releases triggers once the block count reaches 0.

#### Callable methods:

##### `subscribe(callback: SubscriptionCallbackFunction, key = StoreBase.Key_All): number`

Manually subscribe to this store. By default, the `callback` method will be called when the store calls `trigger` with any key, but this can be reduced by passing a specific `key`. For more information, see the “Subscriptions and Triggering” section.

`subscribe` returns a token that can be passed to `unsubscribe`.

##### `unsubscribe(subToken: number)`

Removes a subscription from the store.

##### `trigger(keyOrKeys?: string|string[])`

Trigger all subscriptions that match the provided `keyOrKeys` to be called back. If no key is specified, `StoreBase.Key_All` will be used and all subscriptions will be triggered. For more information, see the “Subscriptions and Triggering” section.

##### `protected _getSubscriptionKeys(): string[]`

This method returns a de-duped list of all `keys` on which subscribers have subscribed.

##### `protected _isTrackingKey(key: string)`

Returns true if a subscription has been made on the specified `key`, or false otherwise.

##### `static pushTriggerBlock()`

Calling `StoreBase.pushTriggerBlock()` will halt all triggers on all stores until the trigger block is lifted by a subsequent call to `StoreBase.popTriggerBlock()`. For more information, see the “Trigger blocks” section.

##### `static popTriggerBlock()`

Lifts the trigger block on all stores and releases any queued triggers. If more than one trigger block is in effect (because more than one store or component wants to block triggers simultaneously), `popTriggerBlock` will decrement the block count but not release the triggers. For more information, see the “Trigger blocks” section.

#### Subclassing:

##### `constructor(throttleMs: number = 0, bypassTriggerBlocks = false)`

Subclass constructors should call super. `throttleMs` refers to the throttle time (see “Trigger throttling” section). `bypassTriggerBlocks` refers to the trigger blocking system (see “Trigger blocks” section).

##### `_startedTrackingKey(key: string)`

`StoreBase` uses reference counting on subscription keys. This method is called whenever a subscription is created using a new `key`.

In certain applications, a store will be passed data that it chooses to ignore until it knows that a subscriber is interested in it. This method will notify the store to begin collecting that data.

Subclasses do not need to call super.

##### `_stoppedTrackingKey(key: string)`

`StoreBase` uses reference counting on subscription keys. This method is called when the last occurrence of this `key` is unsubscribed.

In certain applications, a store will be passed data that it chooses to ignore until it knows that a subscriber is interested in it. When there are no longer any interested subscribers for a given `key`, this method gives the store the opportunity to flush this data.

Subclasses do not need to call super.

## Data Flow

ReSub avoids taking a strong opinion on data flow in your project.

While it’s not encouraged, it’s fine for components to make calls to modify store data, for components and stores to make AJAX and other asynchronous calls, and for stores to subscribe to one another. Action creators may be used to organize data flow, but they’re not required and often not necessary.

Whether using ReSub or not, your app will likely scale best if it follows these guidelines:

1. Components should remain pure, and as such, should only get data from props and stores.
2. Store data should never be modified on the same cycle as component data fetching and rendering. Race conditions and update cycles can form when a component modifies store data while building its state.

## Performance Analysis

To assist with performance analysis of your store and component state-building/-triggering, there is a performance module built into ReSub that marks durations for buildState functions and store trigger callbacks.  If you want to enable it, call the `setPerformanceMarkingEnabled(true)` function available on the root ReSub module export.

## Using ReSub Without TypeScript

It is fine to use ReSub without TypeScript, but without access to TypeScript’s method decorators, stores and components cannot leverage autosubscriptions, and as such, lose a lot of their value.

At the very least, developers can still leverage the organizational patterns of `ComponentBase` and `StoreBase`, and any virtual functions that subclasses implement will still be called.

## Using ReSub with Babel
ReSub relies heavily on typescript decorators, which are not supported out of the box when transpiling typescript via babel. If you choose to transpile your project with Babel, be sure to add the following to your babel config:

```json
  plugins: [
    ["@babel/plugin-proposal-decorators", { legacy: true }],
    "babel-plugin-parameter-decorator"
  ],
```

You'll also need to install `babel-plugin-parameter-decorator@^1.0.8` and `@babel/plugin-proposal-decorators`

## TSLint rules

We have couple of tslint rules to automate search of common problems in ReSub usage.
They are located at the `./dist/tslint` folder of the package.
add following rules to your tslint.json in order to use them.

incorrect-state-access rule doesn't check abstract methods called from componentWillMount, but you could enforce check of your methods by passing them to the rule as an argument.

```
"incorrect-state-access": [
    true
],

"override-calls-super": [
    true,
    "_buildInitialState",
    "componentWillMount",
    "componentDidMount",
    "componentWillReceiveProps",
    "componentWillUpdate",
    "componentDidUpdate",
    "componentWillUnmount"
],
```

## ESLint rules

> [TSLint will be deprecated some time in 2019](https://github.com/palantir/tslint)

If you plan to migrate your projects from TSLint to ESlint and want to continue using the _rules_ to automate search common problems in *ReSub* usage, you can use [eslint-plugin-resub](https://github.com/a-tarasyuk/eslint-plugin-resub).
