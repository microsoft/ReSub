import * as React from 'react';
import { ReactElement } from 'react';
import ComponentBase from '../src/ComponentBase';
import { shallow } from 'enzyme';
import { SimpleStore } from './SimpleStore';

const WARN_IN_BUILD_STATE = 'build';
const WARNING_MESSAGE = `[resub] Only Store methods with the @autoSubscribe decorator \
can be called right now (e.g. in _buildState): "setStoreData"`;

describe('AutoSubscribeWarnings', () => {
    it('Auto-subscribe warns if setter is called in _buildState', () => {
        const store = new SimpleStore();
        class Component extends ComponentBase<{}, {}> {
            protected _buildState(): any {
                // Test implementation detail: makes sure to use a method that will cause a warning (e.g. a setter).
                expect(() => store.setStoreData(WARN_IN_BUILD_STATE, WARN_IN_BUILD_STATE, 1)).toThrowError(WARNING_MESSAGE);
                return {};
            }

            render(): ReactElement<any> {
                return (
                    <div>...</div>
                );
            }
        }

        shallow(<Component />);
    });
});
