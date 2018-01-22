import {
    AutoSubscribeStore,
    autoSubscribe,
    StoreBase,
} from 'resub';

@AutoSubscribeStore
class CounterStore extends StoreBase {
    private _counter: number = 0;

    /**
     * increment
     * @return void
     */
    public increment(): void {
        this._counter = this._counter + 1;
        this.trigger();
    }

    /**
     * decrement
     * @return void
     */
    public decrement(): void {
        this._counter = this._counter - 1;
        this.trigger();
    }

    /**
     * reset
     * @return void
     */
    public reset(): void {
        this._counter = 0;
        this.trigger();
    }

    /**
     * getCounter
     * @return number
     */
    @autoSubscribe
    public getCounter(): number {
        return this._counter;
    }
}

export default new CounterStore();
