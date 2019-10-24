import {EntityStore, EntityStoreProperties} from './EntityStore';
import {EntityHandler} from './EntityHandler';
import {autoSubscribeWithKey} from '../ReSub';

const triggerSelectedKey = '!@ENTITY_SELECT_TRIGGER@!';

export class SelectEntityStore<entity, id extends number | string = number> extends EntityStore<entity, id> {
    protected entityId?: id;

    @autoSubscribeWithKey(triggerSelectedKey)
    getSelected(): Readonly<entity> | undefined {
        if (this.entityId === undefined) {
            return undefined;
        }
        return this.getOne(this.entityId);
    }

    setSelected(id: id | undefined): void {
        if (id !== this.entityId) {
            this.entityId = id;
            this.trigger(triggerSelectedKey);
        }
    }

    addOrUpdateOne(entity: Readonly<entity>): Readonly<entity> | undefined {
        let updateOne = super.addOrUpdateOne(entity);
        if (this.entityId === this.entityHandler.getId(entity)) {
            this.trigger(triggerSelectedKey);
        }
        return updateOne;
    }
}

export interface SelectEntityStoreProperties<entity, id extends number | string = number> extends EntityStoreProperties<entity, id>{

}

export function createSelectEntityStore<entity, id extends number | string = number>(props: SelectEntityStoreProperties<entity, id>):
SelectEntityStore<entity, id> {
    return new SelectEntityStore<entity, id>(props.throttleMs || 0,
        props.bypassTriggerBlocks || false,
        new EntityHandler<entity, id>(props.selectId));
}
