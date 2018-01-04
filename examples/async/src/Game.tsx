import * as React from 'react';
import { ReactElement } from 'react';
import { ComponentBase } from 'resub';
import GameStore, { IAnswer } from './Game.store';

export interface IGameProps {};

interface IGameState {
  isLoading: boolean;
  answer: string;
  image: string;
};

export class Game extends ComponentBase<IGameProps, IGameState> {
  protected _buildState() {
    return {
      isLoading: GameStore.isLoading(),
      answer: GameStore.getAnswer(),
      image: GameStore.getImage(),
    };
  }

  public render(): ReactElement<any> {
    const {
      isLoading,
      answer,
      image,
    } = this.state;

    return (
      <div>
        <button
          disabled={isLoading}
          onClick={() => GameStore.guess()}
        >
          { isLoading ? 'Loading...' : 'Guess' }
        </button>

        <div>
          <p>{ answer }</p>
          <img src={ image } />
        </div>
      </div>
    );
  }
}
