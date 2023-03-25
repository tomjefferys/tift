import { Env } from "tift-types/src/env";
import { Obj } from "tift-types/src/util/objects";
import { OutputConsumer } from "tift-types/src/messages/output";
import { makeDefaultFunctions, makeOutputConsumer, getOutput, getLocationEntity } from "./enginedefault";
import * as Player from "./player";
import * as Entities from "./entities";
import * as Locations from "./locations";
import { addLibraryFunctions } from "./library";
import * as Entity from "../entity";
import * as Verb from "../verb";
import { Nameable, getName } from "../nameable";
import { CommandContext } from "../engine";
import * as MultiDict from "../util/multidict";
import * as Logger from "../util/logger";

const logger = Logger.getLogger("behaviour");

type Entity = Entity.Entity;
type EntityDict = MultiDict.MultiDict<Entity>;
type Verb = Verb.Verb;

// TODO put these somewhere better
const ROOM = "room";
const START = "start"


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
        makeOutputConsumer(rootProps, output);
        addLibraryFunctions(rootProps);
    }

    start(env : Env) {
        const rootProps = env.properties;
        const start = this.findStartingLocation(env);
        Player.makePlayer(rootProps, start);
    }

    getContext(env : Env) : CommandContext {

        const contextEntities : EntityDict = {};

        // Entity for the current location
        const locationEntity = getLocationEntity(env);

        if (locationEntity) {
            MultiDict.add(contextEntities, "location", locationEntity);
        }

        // Get any other entities that are here
        Locations.findEntites(env, locationEntity)
            .filter(entity => !Locations.isAtLocation(env, Player.PLAYER, entity))
            .forEach(entity => MultiDict.add(contextEntities, "environment", entity));

        // Get inventory entities
        env.findObjs(obj => obj?.location === "__INVENTORY__" && Entities.isEntity(obj))
                .forEach(entity => MultiDict.add(contextEntities, "inventory", entity));

        // Get worn entities
        env.findObjs(obj => obj?.location === "__WEARING__" && Entities.isEntity(obj))
                .forEach(entity => MultiDict.add(contextEntities, "wearing", entity));

        const verbs  = env.findObjs(obj => obj?.type === "verb") as Verb[];

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
        return getOutput(env);
    }

    makeOutputConsumer(obj : Obj, outputConsumer : OutputConsumer) {
        return makeOutputConsumer(obj, outputConsumer);
    }
        
    private findStartingLocation(env : Env) : string {
        const startingLocs = env.findObjs(obj => obj["type"] === ROOM && Entity.hasTag(obj, START));
        if (startingLocs.length == 0) {
            throw new Error("No starting location defined");
        }
        if (startingLocs.length > 1) {
            throw new Error("Multiple starting locations found");
        }
        return startingLocs[0].id;
    }
}
