import * as React from 'react';
import { ReactElement } from 'react';
import { ComponentBase } from 'resub';
import CounterStore from './Counter.store';

export interface CounterProps {}

interface CounterState {
    counter: number;
}

export class Counter extends ComponentBase<CounterProps, CounterState> {
    protected _buildState() {
        return {
            counter: CounterStore.getCounter(),
        };
    }

    public render(): ReactElement<any> {
        return (
            <>
                <div>
                    <h1>{ this.state.counter }</h1>
                </div>

                <div>
                    <button onClick={() => CounterStore.increment()}>+</button>
                    <button onClick={() => CounterStore.decrement()}>-</button>
                    <button onClick={() => CounterStore.reset()}>Reset</button>
                </div>
            </>
        );
    }
}
