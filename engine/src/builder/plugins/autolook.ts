import { PluginAction, PluginActionContext, CommandContext } from "../../engine";
import { Optional } from "tift-types/src/util/optional";
import { Entity } from "../../entity";
import * as MultiDict from "../../util/multidict";
import * as Player from "../player";
import * as Output from "../output";
import * as Hash from "../../util/hash";
import { bold } from "../../markdown";
import { getName } from "../../nameable";
import _ from "lodash";
import { Print } from "tift-types/src/messages/output";

type LocationDescriptionHashes = {[key: string]: string};

/**
 * Plugin that provides automatic looking when visiting a location for the first time
 * @param context 
 */
export const AUTOLOOK : PluginAction = (context : PluginActionContext) => {
  const oldLocation = (context.start) ? getLocationFromContext(context.start) : undefined;
  const newLocation = getLocationFromContext(context.end);
  if (newLocation && oldLocation?.id !== newLocation.id) {
    const player = Player.getPlayer(context.env);
    Output.write(context.env, bold(getName(newLocation)));

    const visitedLocations = player["visitedLocations"] as LocationDescriptionHashes;

    // Set up a new environment with it's own output
    const childEnv = Output.pushOutputProxy(context.env);

    // Run the look function and take a hash
    context.executor(childEnv, context.end, ["look"]);

    // Hash the main description
    const messages = Output.getMessages(childEnv);
    const mainDesc = messages.filter((message) : message is Print => message.type === "Print")
                             .filter(message => message.tag === Output.MAIN_DESC_TAB)
                             .map(message => message.value)
                             .join();
    const descHash = Hash.cyrb53a(mainDesc);

    // Check if it's changes
    const oldHash = visitedLocations[newLocation.id];
    if(descHash !== oldHash) {
      visitedLocations[newLocation.id] = descHash;
      Output.flush(childEnv);
    }

    Output.flush(context.env);
  } 
}

function getLocationFromContext(context : CommandContext) : Optional<Entity> {
  return _.head(MultiDict.get(context.entities, "location"));
}