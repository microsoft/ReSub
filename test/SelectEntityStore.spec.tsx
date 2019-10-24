import React from 'react';
import {ComponentBase, createSelectEntityStore, SelectEntityStore} from '../src/ReSub';
import {mount} from 'enzyme';

interface TestParameters<P> {
    testStore: SelectEntityStore<P>;
}

interface TestState<S> {
    testObject: S;
}

interface TestObject {
    key: number;
    value: number;
}

class TestSelectComponent extends ComponentBase<TestParameters<TestObject>, TestState<TestObject>> {
    render(): React.ReactElement<any, string | React.JSXElementConstructor<any>> |
    string | number | {} | React.ReactNodeArray | React.ReactPortal | boolean | null | undefined {
        if (!this.state.testObject) {
            return null;
        }
        return this.state.testObject.value;
    }

    protected _buildState(props: TestParameters<TestObject>, initialBuild: boolean): Partial<TestState<TestObject>> | undefined {
        return {
            testObject: this.props.testStore.getSelected(),
        };
    }
}

describe('Subscription', () => {
    it('should hold the correct selected value', () => {
        let entityTestStore = createSelectEntityStore<TestObject>({selectId: (entity => entity.key)});

        entityTestStore.addOrUpdateAll([{key: 0, value: 0}, {key: 1, value: 1}, {key: 2, value: 2}]);

        const testComponent1 = mount(
            <TestSelectComponent testStore={ entityTestStore }/>,
        );
        expect(testComponent1.contains('1')).toEqual(false);

        entityTestStore.setSelected(1);
        testComponent1.update();
        expect(testComponent1.contains('1')).toEqual(true);

        entityTestStore.setSelected(2);
        testComponent1.update();
        expect(testComponent1.contains('2')).toEqual(true);

        entityTestStore.addOrUpdateOne({key: 2, value: 1});
        testComponent1.update();
        expect(testComponent1.contains('1')).toEqual(true);
    });
});
