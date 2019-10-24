import {SelectEntityStore} from './SelectEntityStore';
import {EntityHandler} from './EntityHandler';
import {EntityStoreProperties} from './EntityStore';

/**
 * This is the time in seconds, the cache should be valid for one item.
 */
const CACHE_INVALIDATION_TIME = 30;

/**
 * The DynamicLoadingStore tries to retrieve the object from the Backend, if not available.
 * This is only possible, if the id contains the link to the entity.
 */
export class DynamicLoadingStore<entity, id extends string> extends SelectEntityStore<entity, id> {
    private loadFunction: (id: id) => Promise<entity>;
    private currentlyLoading: Set<id> = new Set<id>();
    private cacheTimer: Map<id, Date> = new Map<id, Date>();

    constructor(throttleMs: number | undefined,
            bypassTriggerBlocks: boolean,
            entityHandler: EntityHandler<entity, id>,
            loadFunction: (id: id) => Promise<entity>) {
        super(throttleMs, bypassTriggerBlocks, entityHandler);
        this.loadFunction = loadFunction;
    }

    getOne(ref: id): Readonly<entity> | undefined {
        const value = super.getOne(ref);
        const currentTimestamp = new Date(Date.now());
        const cachedTimestamp = this.cacheTimer.get(ref);
        if ((!value || !cachedTimestamp || cachedTimestamp.getSeconds() + CACHE_INVALIDATION_TIME < currentTimestamp.getSeconds())
            && !this.currentlyLoading.has(ref)) {
            this.loadOne(ref, currentTimestamp);
        }
        return value;
    }

    /**
     * Force load a object, useful for reloading.
     * @param ref
     * @param _currTimestamp
     */
    loadOne(ref: id, _currTimestamp?: Date): Promise<entity> {
        const currentTimestamp = _currTimestamp || new Date(Date.now());
        this.currentlyLoading.add(ref);
        this.cacheTimer.set(ref, currentTimestamp);
        const result = this.loadFunction(ref);
        result.then((e: entity) => {
            this.addOrUpdateOne(e);
            this.currentlyLoading.delete(ref);
        }, error => this.currentlyLoading.delete(ref));
        return result;
    }

    invalidateCache(ref: id): void {
        this.cacheTimer.delete(ref);
    }
}

export interface DynamicLoadingStoreProperties<entity, id extends string> extends EntityStoreProperties<entity, id> {
    loadFunction: (id: id) => Promise<entity>;
}

export function createDynamicLoadingStore<entity, id extends string>(props: DynamicLoadingStoreProperties<entity, id>):
DynamicLoadingStore<entity, id> {
    return new DynamicLoadingStore<entity, id>(props.throttleMs || undefined,
        props.bypassTriggerBlocks || false,
        new EntityHandler<entity, id>(props.selectId),
        props.loadFunction);
}
