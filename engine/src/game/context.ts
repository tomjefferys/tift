import { Env } from "tift-types/src/env";
import * as Entity from "../entity";
import * as Verb from "../verb";
import * as Player from "./player";
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
 * Compute the entities and verbs currently in scope (in context) for the given env:
 * the player's location, its contents, inventory, worn items and containers, plus
 * every verb defined in the game.
 */
export function getContext(env : Env) : CommandContext {

    const contextEntities : EntityDict = {};

    // Entity for the current location
    const locationEntity = Player.getLocationEntity(env);

    let searchContext = false;
    if (locationEntity) {
        MultiDict.add(contextEntities, "location", locationEntity);
        searchContext = !Entities.entityHasTag(locationEntity, Tags.PSEUDO_ROOM);
    }

    if (searchContext) {
        // Get any other entities that are here
        const localEntities = Locations.findEntities(env, locationEntity);
        const nonCarriedEntities = localEntities.filter(entity => !Locations.isAtLocation(env, Player.PLAYER, entity));
        const carriedEntities = localEntities.filter(entity => Locations.isAtLocation(env, Player.PLAYER, entity));

        // Get environment entities
        nonCarriedEntities.forEach(entity => MultiDict.add(contextEntities, "environment", entity));

        // Get inventory entities
        const inventoryEntities = carriedEntities.filter(entity => Locations.getLocation(entity) === "__INVENTORY__");
        inventoryEntities.forEach(entity => MultiDict.add(contextEntities, "inventory", entity));

        // Get worn entities
        const wornEntities = carriedEntities.filter(entity => Locations.getLocation(entity) === "__WEARING__");
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
