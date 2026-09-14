import { Env } from "tift-types/src/env";
import * as Entity from "../entity";
import * as Verb from "../verb";
import * as Agent from "./agent";
import * as Entities from "./entities";
import * as Locations from "./locations";
import * as MultiDict from "../util/multidict";
import * as Tags from "./tags";
import * as Verbs from "./verbs";
import * as Logger from "../util/logger";
import type { CommandContext } from "../engine";

const logger = Logger.getLogger("context");

type Entity = Entity.Entity;
type EntityDict = MultiDict.MultiDict<Entity>;
type Verb = Verb.Verb;

/**
 * Compute the entities and verbs currently in scope (in context) for the given
 * actor (the player by default): the actor's location, its contents, the
 * actor's inventory, worn items and containers, plus every verb defined in the
 * game.
 */
export function getContext(env : Env, actorId : string = Agent.getActorId(env)) : CommandContext {

    const contextEntities : EntityDict = {};

    // Entity for the actor's current location
    const locationEntity = Agent.getLocationEntity(env, actorId);

    let searchContext = false;
    if (locationEntity) {
        MultiDict.add(contextEntities, "location", locationEntity);
        searchContext = !Entities.entityHasTag(locationEntity, Tags.PSEUDO_ROOM);
    }

    if (searchContext) {
        // Get any other entities that are here
        const localEntities = Locations.findEntities(env, locationEntity);
        const nonCarriedEntities = localEntities.filter(entity => !Locations.isAtLocation(env, actorId, entity));
        const carriedEntities = localEntities.filter(entity => Locations.isAtLocation(env, actorId, entity));

        // Get environment entities
        nonCarriedEntities.forEach(entity => MultiDict.add(contextEntities, "environment", entity));

        // Get inventory entities
        const inventoryId = Agent.getInventoryId(env, actorId);
        const inventoryEntities = carriedEntities.filter(entity => Locations.getLocation(entity) === inventoryId);
        inventoryEntities.forEach(entity => MultiDict.add(contextEntities, "inventory", entity));

        // Get worn entities
        const wearingId = Agent.getWearingId(env, actorId);
        const wornEntities = carriedEntities.filter(entity => Locations.getLocation(entity) === wearingId);
        wornEntities.forEach(entity => MultiDict.add(contextEntities, "wearing", entity));

        // Get entities in a container
        const containers = localEntities.filter(entity => Locations.isInContainer(env, entity));
        containers.forEach(entity => MultiDict.add(contextEntities, "container", entity));
    }

    const verbs = env.findObjs(obj => Verbs.isVerb(obj)) as Verb[];

    logger.debug(() => MultiDict.values(contextEntities).map(entity => entity.id).join(","));

    return {
        entities: contextEntities,
        verbs: verbs
    }
}
