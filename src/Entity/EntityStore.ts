import {autoSubscribe, AutoSubscribeStore, autoSubscribeWithKey, formCompoundKey, key, StoreBase} from '../ReSub';
import {EntityHandler} from './EntityHandler';

const triggerEntityKey = '!@ENTITY_TRIGGER@!';

@AutoSubscribeStore
export class EntityStore<entity, id extends number | string = number> extends StoreBase {
    protected entityHandler: EntityHandler<entity, id>;

    constructor(throttleMs: number | undefined, bypassTriggerBlocks: boolean, entityHandler: EntityHandler<entity, id>) {
        super(throttleMs, bypassTriggerBlocks);

        // reset map and ids
        this.entityHandler = entityHandler;
    }

    @autoSubscribeWithKey(triggerEntityKey)
    getAll(): readonly entity[] {
        return this.entityHandler.getAll();
    }

    @autoSubscribeWithKey(triggerEntityKey)
    getOne(id: id): Readonly<entity> | undefined {
        return this.entityHandler.getOne(id);
    }

    // TODO: subscribe with corresponding keys...
    @autoSubscribe
    getMultiple(ids: Set<id>): Readonly<Set<entity>> {
        return this.entityHandler.get(ids);
    }

    /**
     * @deprecated This is only for performance optimization. AddOrUpdate should be the one, you're normally using.
     * @param entity
     */
    addOne(entity: Readonly<entity>): Readonly<entity> | undefined {
        return this.addOrUpdateOne(entity);
    }

    addOrUpdateOne(entity: Readonly<entity>): Readonly<entity> | undefined {
        let result = this.entityHandler.addOrUpdateOne(entity);
        this.trigger(formCompoundKey(String(this.entityHandler.getId(entity)), triggerEntityKey));
        if (result) {
            // trigger for old entity
            this.trigger(formCompoundKey(String(this.entityHandler.getId(result)), triggerEntityKey));
        }
        return result;
    }

    /**
     * @param entity
     * @returns true, if the element was removed, false, if the element was not present before
     */
    removeOne(entity: Readonly<entity>): id | undefined {
        let result = this.entityHandler.removeOne(entity);
        this.trigger(formCompoundKey(String(this.entityHandler.getId(entity)), triggerEntityKey));
        return result;
    }

    addOrUpdateAll(entities: Readonly<entity[]>): void {
        StoreBase.pushTriggerBlock();
        for (const entity of entities) {
            this.entityHandler.addOne(entity);
            this.trigger(formCompoundKey(String(this.entityHandler.getId(entity)), triggerEntityKey));
        }

        this.trigger(triggerEntityKey);
        StoreBase.popTriggerBlock();
    }

    setEntities(entities: Readonly<entity[]>): void {
        if (!(entities instanceof Array)) {
            throw new Error('setEntities needs an Array');
        }

        StoreBase.pushTriggerBlock();
        const removedEntities = this.entityHandler.setEntities(entities);
        // at first, trigger the removed ones
        removedEntities.forEach(id => this.trigger(formCompoundKey(String(id), triggerEntityKey)));

        // now trigger for the newly added ones
        entities.forEach(entity => this.trigger(formCompoundKey(String(this.entityHandler.getId(entity)), triggerEntityKey)));
        this.trigger(triggerEntityKey);

        StoreBase.popTriggerBlock();
    }

    /**
     * Helper function, that returns the id of an entity
     * @param entity
     */
    getId(entity: entity): id {
        return this.entityHandler.getId(entity);
    }
}

key(EntityStore.prototype, 'getOne', 0);

export interface EntityStoreProperties<entity, id extends number | string = number> {
    throttleMs?: number | undefined;
    bypassTriggerBlocks?: boolean;
    selectId: (entity: entity) => id;
}

export function createEntityStore<entity, id extends number | string = number>(props: EntityStoreProperties<entity, id>):
EntityStore<entity, id> {
    return new EntityStore<entity, id>(props.throttleMs || 0,
        props.bypassTriggerBlocks || false,
        new EntityHandler<entity, id>(props.selectId));
}
