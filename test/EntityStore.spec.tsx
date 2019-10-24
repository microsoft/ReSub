import React from 'react';
import {createEntityStore, EntityStore} from '../src/Entity/EntityStore';
import {ComponentBase} from '../src/ReSub';
import {mount} from 'enzyme';

interface TestParameters<P> {
    uniqueId: string;
    testStore: EntityStore<P>;
    propertyKey: number;
}

interface TestState<S> {
    testObject: S;
}

interface TestObject {
    key: number;
    value: number;
}

class TestComponent extends ComponentBase<TestParameters<TestObject>, TestState<TestObject>> {
    render(): React.ReactElement<any, string | React.JSXElementConstructor<any>> |
    string | number | {} | React.ReactNodeArray | React.ReactPortal | boolean | null | undefined {
        if (!this.state.testObject) {
            return null;
        }
        return this.state.testObject.value;
    }

    protected _buildState(props: TestParameters<TestObject>, initialBuild: boolean): Partial<TestState<TestObject>> | undefined {
        return {
            testObject: this.props.testStore.getOne(this.props.propertyKey),
        };
    }
}

describe('EntityStore', () => {
    describe('should trigger with correct keys', () => {
        it('while setting new Entities', () => {
            const entityTestStore = createEntityStore<TestObject>({selectId: (entity => entity.key)});

            entityTestStore.addOrUpdateAll([{key: 0, value: 0}, {key: 1, value: 1}, {key: 2, value: 2}, {key: 3, value: 3}]);
            const testComponent = mount(
                <TestComponent propertyKey={ 1 } testStore={ entityTestStore } uniqueId={ new Date().getTime() + 'X' }/>,
            );

            expect(testComponent.contains('1')).toEqual(true);

            entityTestStore.setEntities([{key: 1, value: 2}]);
            testComponent.update();
            expect(testComponent.contains('2')).toEqual(true);

            entityTestStore.setEntities([{key: 2, value: 2}]);
            testComponent.update();
            expect(testComponent.contains('2')).toEqual(false);
        });
    });

    describe('Subscription', () => {
        it('should hold the correct value', async () => {
            const entityTestStore = createEntityStore<TestObject>({selectId: (entity => entity.key)});

            entityTestStore.addOrUpdateAll([{key: 0, value: 0}, {key: 1, value: 1}, {key: 2, value: 2}]);

            const testComponent1 = mount(
                <TestComponent propertyKey={ 1 } testStore={ entityTestStore } uniqueId={ new Date().getTime() + '1' }/>,
            );

            const testComponent2 = mount(
                <TestComponent propertyKey={ 2 } testStore={ entityTestStore } uniqueId={ new Date().getTime() + '2' }/>,
            );

            expect(testComponent1.contains('1')).toEqual(true);
            expect(testComponent2.contains('2')).toEqual(true);

            entityTestStore.addOrUpdateOne({key: 1, value: 2});

            testComponent1.update();
            testComponent2.update();

            expect(testComponent1.contains('1')).toEqual(false);
            expect(testComponent1.contains('2')).toEqual(true);
            expect(testComponent2.contains('2')).toEqual(true);

            entityTestStore.addOrUpdateOne({key: 2, value: 1});

            testComponent1.update();
            testComponent2.update();
            expect(testComponent1.contains('2')).toEqual(true);
            expect(testComponent2.contains('1')).toEqual(true);
        });
    });
});
