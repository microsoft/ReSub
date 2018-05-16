import * as React from 'react';
import { ReactElement } from 'react';
import { ComponentBase } from 'resub';
import { Answer } from './Answer';
import GameStore from './Game.store';

export interface GameProps {}

interface GameState {
    isLoading: boolean;
    answer: string;
    error: string;
    image: string;
}

export class Game extends ComponentBase<GameProps, GameState> {
    /**
     * _buildState
     *
     * @return IGameState
     */
    protected _buildState() {
        return {
            isLoading: GameStore.isLoading(),
            answer: GameStore.getAnswer(),
            error: GameStore.getError(),
            image: GameStore.getImage(),
        };
    }

    public render(): ReactElement<any> {
        const {
            isLoading,
            answer,
            error,
            image,
        } = this.state;

        return (
            <div>
                <h1>YES or NO</h1>
                <button
                    disabled={isLoading}
                    onClick={() => GameStore.guess()}
                >
                    { isLoading ? 'Loading...' : 'Guess' }
                </button>

                <Answer
                    disabled={isLoading}
                    answer={answer}
                    image={image}
                    error={error}
                />
            </div>
        );
    }
}
