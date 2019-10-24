export class EntityHandler<entity, id extends number | string = number> {
    private _ids: Set<id> = new Set<id>();
    private _entities: Map<id, Readonly<entity>> = new Map();

    private readonly _selectId: (entity: Readonly<entity>) => id;

    constructor(selectId: (entity: Readonly<entity>) => id) {
        this._selectId = selectId;
    }

    /**
     * This is only for performance optimization. AddOrUpdate should be the one, you're normally using.
     * @param entity
     */
    addOne(entity: Readonly<entity>): void {
        const id = this._selectId(entity);
        this._ids.add(id);
        this._entities.set(id, entity);
    }

    addOrUpdateOne(entity: Readonly<entity>): Readonly<entity> | undefined {
        let result: Readonly<entity> | undefined = undefined;
        const id = this._selectId(entity);
        if (this._ids.has(id)) {
            // id is already there, so we update the old one
            result = this._entities.get(id);
        } else {
            this._ids.add(id);
        }
        this._entities.set(id, entity);
        return result;
    }

    removeOne(entity: Readonly<entity>): id | undefined {
        const id = this._selectId(entity);
        const result = this._entities.delete(id);
        if (result) {
            return id;
        } else {
            return undefined;
        }
    }

    get(ids: Set<id>): Set<entity> {
        const result: Set<entity> = new Set<entity>();
        ids.forEach(value => {
            let e = this._entities.get(value);
            if (e) {
                result.add(e);
            }
        });
        return result;
    }

    addAll(entities: readonly entity[]): void {
        for (let i = 0; i < entities.length; i++) {
            this.addOne(entities[i]);
        }
    }

    /**
     * @param entities the new entities
     * @return the id's of the removed ones
     */
    setEntities(entities: readonly entity[]): readonly id[] {
        if (entities.length === 0) {
            // shortcut for clearing the entities
            const result = Array.from(this._ids);
            this._ids.clear();
            this._entities.clear();
            return result;
        }
        // create id-set of new entities
        const newIds = entities.map<id>((value, index, array) => this._selectId(value));
        // the ids, that are removed are needed in order to trigger the updates correctly
        const idsToRemove = Array.from(this._ids).filter(value => !newIds.includes(value));

        this._ids.clear();
        this._entities.clear();

        this.addAll(entities);

        return idsToRemove;
    }

    getOne(id: id): Readonly<entity> | undefined {
        return this._entities.get(id);
    }

    getAll(): readonly entity[] {
        return Array.from(this._entities, ([id, entity]) => entity).sort(this._sortFn);
    }

    getId(entity: Readonly<entity>): id {
        return this._selectId(entity);
    }

    private _sortFn = (entity1: entity, entity2: entity): number => {
        let id1 = this._selectId(entity1);
        let id2 = this._selectId(entity2);
        if (typeof id1 === 'string' && typeof id2 === 'string') {
            return id1.localeCompare(id2);
        } else if (typeof id1 === 'number' && typeof id2 === 'number') {
            return id1 - id2;
        } else {
            // TODO: sort function
            return 0;
        }
    };
}
