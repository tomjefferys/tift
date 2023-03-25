import { PluginAction, PluginActionContext, CommandContext } from "../../engine";
import { Optional } from "tift-types/src/util/optional";
import { Entity } from "../../entity";
import * as MultiDict from "../../util/multidict";
import { getPlayer, LOOK_FN, write } from "../enginedefault";
import { bold } from "../../markdown";
import { getName } from "../../nameable";
import _ from "lodash";

/**
 * Plugin that provides automatic looking when visiting a location for the first time
 * @param context 
 */
export const AUTOLOOK : PluginAction = (context : PluginActionContext) => {
  const oldLocation = (context.start) ? getLocationFromContext(context.start) : undefined;
  const newLocation = getLocationFromContext(context.end);
  if (newLocation && oldLocation?.id !== newLocation.id) {
    const player = getPlayer(context.env);
    write(context.env, bold(getName(newLocation)));

    const visititedLocations = player["visitedLocations"] as string[];

    if (!visititedLocations.includes(newLocation.id)) {
      visititedLocations.push(newLocation.id);
      LOOK_FN(context.env);
    }
  } 
}

function getLocationFromContext(context : CommandContext) : Optional<Entity> {
  return _.head(MultiDict.get(context.entities, "location"));
}