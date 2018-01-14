import * as React from 'react';
import { ReactElement } from 'react';
import { ComponentBase, withStoreSubscription } from 'resub';
import CounterStore from './Counter.store';

type ICounterSFCProps = React.Props<any> & {
  counter: number;
};

const CounterSFC = ({ counter }: ICounterSFCProps) => (
  <>
    <h1>{ counter }</h1>
    <p>(using CounterWithStoreSubscription)</p>

    <div>
      <button onClick={() => CounterStore.increment()}>+</button>
      <button onClick={() => CounterStore.decrement()}>-</button>
      <button onClick={() => CounterStore.reset()}>Reset</button>
    </div>
  </>
);

export default withStoreSubscription<{}, {}>(() => ({
    counter: CounterStore.getCounter(),
}))(CounterSFC);
