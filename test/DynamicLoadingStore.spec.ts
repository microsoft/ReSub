import {EntityHandler} from '../src/Entity/EntityHandler';
import {createDynamicLoadingStore} from '../src/ReSub';

const testValues = new Map<string, string>([['1', 'eins'], ['2', 'zwei'], ['3', 'drei']]);

describe('DynamicLoadingStore', () => {
    describe('can return the correct ids', () => {
        it('while setting new entities', () => {
            const eh = new EntityHandler<number>((entity: number) => entity);

            eh.addAll([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

            expect(eh.getAll().length).toEqual(10);

            const newEntities = [0, 2, 4, 6, 8, 9];
            const removedEntities = eh.setEntities(newEntities);
            expect(removedEntities).toEqual([1, 3, 5, 7]);
            expect(eh.getAll()).toEqual(newEntities);
        });
    });

    it('can handle strings as ids', () => {
        const eh = new EntityHandler<string, string>((entity: string) => entity);

        eh.addAll(['a', 'b', 'c', 'd', 'e']);

        expect(eh.getAll().length).toEqual(5);

        const newEntities = ['a', 'e'];
        const removedEntities = eh.setEntities(newEntities);
        expect(removedEntities).toEqual(['b', 'c', 'd']);
        expect(eh.getAll()).toEqual(newEntities);
    });

    it('can load values dynamically', (done: any) => {
        // create store, that gets its value from our testValues
        const dynamicLoadingStore =
            createDynamicLoadingStore<string, string>({
                selectId: entity => entity,
                loadFunction: id => Promise.resolve(testValues.get(id) || 'undefined'),
            });
        expect(dynamicLoadingStore.getAll().length).toEqual(0);

        // dynamically get one
        const one = dynamicLoadingStore.loadOne('1');
        one.then(value => {
            expect(value).toEqual('eins');
            expect(dynamicLoadingStore.getAll().length).toEqual(1);
        }, error => fail(error));

        // dynamically get two
        const two = dynamicLoadingStore.loadOne('2');
        two.then(two => {
            expect(two).toEqual('zwei');
            expect(dynamicLoadingStore.getAll().length).toEqual(2);
        }, error => fail(error));

        // dynamically get three
        const three = dynamicLoadingStore.loadOne('3');
        three.then(three => {
            expect(three).toEqual('drei');
            expect(dynamicLoadingStore.getAll().length).toEqual(3);
        }, error => fail(error));

        Promise.all([one, two, three]).then(value => done());
    });
});
