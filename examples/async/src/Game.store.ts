import {
    AutoSubscribeStore,
    autoSubscribe,
    StoreBase,
} from 'resub';

interface Answer {
    answer: string;
    image: string;
}

@AutoSubscribeStore
class GameStore extends StoreBase {
    private _isLoading: boolean = false;
    private _answer: string = '';
    private _image: string = '';
    private _error: string = '';

    /**
     * guess
     * @return void
     */
    public guess(): void {
        this._guessStart();

        fetch('https://yesno.wtf/api')
            .then(response => response.json())
            .then(this.onSuccess)
            .catch(this.onError);
    }

    /**
     * getAnswer
     * @return string
     */
    @autoSubscribe
    public getAnswer(): string {
        return this._answer;
    }

    /**
     * getImage
     * @return string
     */
    @autoSubscribe
    public getImage(): string {
        return this._image;
    }

    /**
     * getError
     * @return string
     */
    @autoSubscribe
    public getError(): string {
        return this._error;
    }

    /**
     * isLoading
     * @return boolean
     */
    @autoSubscribe
    public isLoading(): boolean {
        return this._isLoading;
    }

    /**
     * _guessStart
     * @return void
     */
    private _guessStart = () => {
        this._isLoading = true;
        this._answer = '';
        this._error = '';
        this._image = '';
        this.trigger();
    }

    /**
     * onSuccess
     * @param {Answer} response
     * @return void
     */
    private onSuccess = ({ answer, image }: Answer) => {
        this._isLoading = false;
        this._answer = answer;
        this._image = image;
        this._error = '';
        this.trigger();
    }

    /**
     * onError
     * @param {Error} errors
     * @return void
     */
    private onError = ({ message }: Error) => {
        this._isLoading = false;
        this._error = message;
        this.trigger();
    }
}

export default new GameStore();
