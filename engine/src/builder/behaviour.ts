import { Env } from "tift-types/src/env";
import { Obj } from "tift-types/src/util/objects";
import { OutputConsumer } from "tift-types/src/messages/output";
import { makeDefaultFunctions } from "./enginedefault";
import * as Output from "./output";
import * as Player from "./player";
import * as Entities from "./entities";
import * as Locations from "./locations";
import * as Entity from "../entity";
import * as Verb from "../verb";
import { Nameable, getName } from "../nameable";
import { CommandContext } from "../engine";
import * as MultiDict from "../util/multidict";
import * as Logger from "../util/logger";
import * as Tags from "./tags";
import * as Verbs from "./verbs";

const logger = Logger.getLogger("behaviour");

type Entity = Entity.Entity;
type EntityDict = MultiDict.MultiDict<Entity>;
type Verb = Verb.Verb;


// Define some default behaviour
export interface Behaviour {
    reset(env : Env, output : OutputConsumer) : void;
    start(env : Env) : void;
    getStatus(env : Env) : string;
    getContext(env : Env) : CommandContext;
    getOutput(env : Env) : OutputConsumer;
    makeOutputConsumer(obj : Obj, outputConsumer : OutputConsumer) : void;
}

export function getDefaultGameBehaviour() : Behaviour {
    return new DefaultBehaviour();
}

class DefaultBehaviour implements Behaviour {
    reset(env : Env, output : OutputConsumer) {
        const rootProps = env.properties;
        makeDefaultFunctions(rootProps);
        Output.makeOutputConsumer(rootProps, output);
    }

    start(env : Env) {
        const start = this.findStartingLocation(env);
        Player.makePlayer(env, start);
    }

    getContext(env : Env) : CommandContext {

        const contextEntities : EntityDict = {};

        // Entity for the current location
        const locationEntity = Player.getLocationEntity(env);

        if (locationEntity) {
            MultiDict.add(contextEntities, "location", locationEntity);
        }


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

        const verbs  = env.findObjs(obj => Verbs.isVerb(obj)) as Verb[];

        logger.debug(() => MultiDict.values(contextEntities).map(entity => entity.id).join(","));
    
        return {
            entities: contextEntities,
            verbs: verbs
        }
    }

    getStatus(env : Env): string {
        const playerLocation = Player.getPlayer(env).location
        const locations = env.findObjs(obj => obj?.id === playerLocation) as Nameable[];
        if (!locations.length) {
        throw new Error("Could not find player location");
        }
        return getName(locations[0]);
    }

    getOutput(env : Env) : OutputConsumer {
        return Output.getOutput(env);
    }

    makeOutputConsumer(obj : Obj, outputConsumer : OutputConsumer) {
        return Output.makeOutputConsumer(obj, outputConsumer);
    }
        
    private findStartingLocation(env : Env) : string {
        const startingLocs = env.findObjs(obj => Entities.isEntity(obj) && Entity.hasTag(obj, Tags.START));
        if (startingLocs.length == 0) {
            throw new Error("No starting location defined");
        }
        if (startingLocs.length > 1) {
            throw new Error("Multiple starting locations found");
        }
        return startingLocs[0].id;
    }
}
