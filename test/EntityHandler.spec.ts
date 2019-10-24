import {EntityHandler} from '../src/Entity/EntityHandler';

describe('EntityHandler', () => {
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

    describe('can handle strings as ids', () => {
        it('while setting new entities', () => {
            const eh = new EntityHandler<string, string>((entity: string) => entity);

            eh.addAll(['a', 'b', 'c', 'd', 'e']);

            expect(eh.getAll().length).toEqual(5);

            const newEntities = ['a', 'e'];
            const removedEntities = eh.setEntities(newEntities);
            expect(removedEntities).toEqual(['b', 'c', 'd']);
            expect(eh.getAll()).toEqual(newEntities);
        },
        );
    });
});
