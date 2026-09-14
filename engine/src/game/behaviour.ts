import { Env } from "tift-types/src/env";
import { Obj } from "tift-types/src/util/objects";
import { OutputConsumer, Properties } from "tift-types/src/messages/output";
import { makeDefaultFunctions } from "./enginedefault";
import * as Output from "./output";
import * as Player from "./player";
import * as Agent from "./agent";
import * as Entities from "./entities";
import * as Locations from "./locations";
import * as Entity from "../entity";
import { Nameable, getName } from "../nameable";
import { CommandContext } from "../engine";
import * as Tags from "./tags";
import { makeWord } from "../command";
import * as Context from "./context";


// Define some default behaviour
export interface Behaviour {
    reset(env : Env, output : OutputConsumer) : void;
    start(env : Env) : void;
    getStatus(env : Env) : string;
    getStatusProperties(env : Env) : Properties;
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
        Locations.makeGameEnd(env);

        // Every agent (the player included - see the "agent" tag it's given in
        // makePlayer - plus eg any NPC) needs its own inventory/wearing containers.
        env.findObjs(obj => Entities.isEntity(obj) && Entities.isEntityAgent(obj))
           .forEach(agent => Agent.makeAgentContainers(env, agent.id));
    }

    getContext(env : Env) : CommandContext {
        return Context.getContext(env);
    }

    getStatus(env : Env): string {
        const playerLocation = Player.getPlayer(env).location
        const locations = env.findObjs(obj => obj?.id === playerLocation) as Nameable[];
        if (!locations.length) {
        throw new Error("Could not find player location");
        }
        return getName(locations[0]);
    }

    getStatusProperties(env : Env): Properties {
        const inventoryItems = env.findObjs(obj => Locations.isAtLocation(env, Player.PLAYER, obj))
                                  .filter(entity => entity.type !== Entities.Types.SPECIAL);
        // Convert to part of speech
        const inventory = inventoryItems.map(item => makeWord(item.id, getName(item as Nameable), "directObject", 2))
                                        .map(word => ({...word, tags: [...(word.tags ?? []), "inventory"]}));
        return { inventory };
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
