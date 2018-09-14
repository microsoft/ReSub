import * as React from 'react';
import { SFC } from 'react';

interface AnswerProps {
    disabled: boolean;
    answer: string;
    image: string;
    error: string;
}

export const Answer: SFC<AnswerProps> = ({
    disabled,
    answer,
    image,
    error,
}) => {
    if (disabled) {
        return null;
    }

    if (error) {
        return (
            <div>Error: { error }</div>
        );
    }

    return (
        <div>
            <p>{ answer }</p>
            <img src={image} />
        </div>
    );
};
