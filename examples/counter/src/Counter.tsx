import * as React from 'react';
import { ReactElement } from 'react';
import { ComponentBase } from 'resub';
import CounterStore from './Counter.store';

export interface ICounterProps {};

interface ICounterState {
  counter: number;
};

export class Counter extends ComponentBase<ICounterProps, ICounterState> {
  protected _buildState() {
    return {
      counter: CounterStore.getCounter(),
    };
  }

  public render(): ReactElement<any> {
    return (
      <>
        <h1>{ this.state.counter }</h1>
        <p>(using Counter)</p>

        <div>
          <button onClick={() => CounterStore.increment()}>+</button>
          <button onClick={() => CounterStore.decrement()}>-</button>
          <button onClick={() => CounterStore.reset()}>Reset</button>
        </div>
      </>
    );
  }
}
