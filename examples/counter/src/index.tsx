import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Counter } from './Counter';
import CounterWithStoreSubscription from './CounterWithStoreSubscription';

ReactDOM.render(
  <>
    <Counter />
    <CounterWithStoreSubscription />
  </>,
  document.getElementById('root'),
);
