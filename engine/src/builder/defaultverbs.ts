import { phaseActionBuilder } from "../script/phaseaction";
import { captureModifier, captureObject, captureIndirectObject, matchAttribute, matchBuilder, attributeMatchBuilder, matchVerb } from "../commandmatcher";
import { mkResult, mkThunk } from "../script/thunk";
import * as Entities from "./entities";
import * as Locations from "./locations";
import * as Player from "./player";
import { Env } from "tift-types/src/env";
import { formatString } from "../util/mustacheUtils";
import { VerbBuilder } from "./verbbuilder";
import { Obj } from "tift-types/src/util/objects";
import { getName, getFullName, Nameable } from "../nameable";
import * as Output from "./output";
import { IMPLICIT_FUNCTION } from "./functionbuilder";
import * as Property from "../properties";
import * as Tags from "./tags";

export const LOOK_FN = (env : Env) => {
    const location = Player.getLocationEntity(env);

    const canSee = Locations.canSeeAtLocation(env, location);

    const items = Locations.findEntities(env, location)
                           .filter(Entities.isEntity)
                           .filter(entity => Entities.isEntityVisible(env, canSee, entity))
                           .filter(obj => Entities.isEntityMovable(obj) || Entities.isEntityNPC(obj))
                           .filter(obj => !Locations.isAtLocation(env, Player.PLAYER, obj));
                    
    const isDark = Entities.entityHasTag(location, Tags.DARK) && !Locations.isLightSourceAtLocation(env, location);

    const getItemDescription = (item : Obj) => {
        const itemLocation = Locations.getLocation(item);
        const locationObj = (itemLocation !== location.id) 
                ? { location : getName(Entities.getEntity(env, itemLocation) as Nameable)}
                : {};
        return { name : getName(item as Nameable), ...locationObj };
    }

    // Desc should have any moustache expressions expanded
    const view = {
        "hasItems" : Boolean(items.length),
        "items" : items.map(getItemDescription),
        "isDark" : isDark
    }

    const scope = env.newChild(view).newChild(location);
    const mainTemplate = Property.getPropertyString(env, "look.templates.main");
    const itemsTemplate = Property.getPropertyString(env, "look.templates.items");
    const partials = Property.getProperty(env, "look.templates.partials") as Record<string,string>

    const mainOutput = formatString(scope, mainTemplate, undefined, partials);
    const itemsOutput = formatString(scope, itemsTemplate, undefined, partials);

    // Tag the output
    Output.write(env, mainOutput, Output.MAIN_DESC_TAB);
    Output.write(env, itemsOutput, Output.ITEMS_DESC_TAB);

    return mkResult(true);
}

export const EXAMINE_CONTAINER_FN = (env : Env) => {
    const container = env.get("container");
    const items = Locations.findEntities(env, container)
                           .filter(Entities.isEntity)
                           .filter(entity => Entities.isEntityVisible(env, true, entity));
                    
    const template = Property.getPropertyString(env, "examine.templates.container");
    const partials = Property.getProperty(env, "examine.templates.partials") as Record<string,string>;

    const view = {
        container : getFullName(container as Nameable),
        items : items.map((item, index, array) => ({ 
                        name : getFullName(item as Nameable),
                        isPenultimate : index === array.length - 2,
                        isLast : index === array.length - 1 }))
    }
    const scope = env.newChild(view);
    const output = formatString(scope, template, undefined, partials);
    Output.write(env, output);
    return mkResult(true);
}

export const GET_FROM_CONTAINER_FN = (env : Env) => {
    const item = env.get("item");
    const container = env.get("container");
    let canGet = true;
    if(Entities.entityHasTag(container, Tags.OPENABLE) || Entities.entityHasTag(container, Tags.CLOSABLE)) {
        if (!container.is_open) {
            const template = Property.getPropertyString(env, "get.templates.container.closed");
            const partials = Property.getProperty(env, "get.templates.partials", {}) as Record<string,string>;
            const view = {
                container : getFullName(container as Nameable),
                item : getFullName(item as Nameable)
            }
            const scope = env.newChild(view);
            const output = formatString(scope, template, undefined, partials);
            Output.write(env, output);
            canGet = false;
        }
    }
    return mkResult(!canGet)
}

const LOOK = phaseActionBuilder("look")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("look")).build(),
            mkThunk(LOOK_FN));

const INVENTORY_ACTION = phaseActionBuilder("inventory")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("inventory")).build(),    
            mkThunk(env => {
                    env.findObjs(obj => obj?.location === Player.INVENTORY && Entities.isEntity(obj))
                       .forEach(entity => Output.write(env, getName(entity as Nameable)));
    
                    env.findObjs(obj => obj?.location === Player.WEARING && Entities.isEntity(obj))
                       .forEach(entity => Output.write(env, ` ${getName(entity as Nameable)} (wearing)` ));
                    return mkResult(true);
                })
        )

const WAIT = phaseActionBuilder("wait")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("wait")).build(),
            mkThunk(env => {
                const message = Property.getPropertyString(env, "wait.message")
                Output.write(env, message);
                return mkResult(true);
    }));
        

const GO = phaseActionBuilder("go")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("go")).withModifier(captureModifier("direction")).build(),
            mkThunk(env => {
                const location = Player.getLocationEntity(env);
                const destination = location?.exits[env.get("direction")];
                if (destination) {
                    env.execute("moveTo", {"dest" : destination});
                }
                return mkResult(true);
            })
        );

const GET = phaseActionBuilder("get")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("get")).withObject(captureObject("item")).build(),
            mkThunk(env => {
                const item = env.get("item");
                Locations.setLocation(env, item, Player.INVENTORY);
                return mkResult(true);
            }));

const DROP = phaseActionBuilder("drop")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("drop")).withObject(captureObject("item")).build(), 
            mkThunk(env => {
                const item = env.get("item");
                const location = Player.getLocation(env);
                Locations.setLocation(env, item, location);
                return mkResult(true);
            }));

const PUT_IN = phaseActionBuilder("put")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("put"))
                          .withObject(captureObject("item"))
                          .withAttribute(attributeMatchBuilder().withAttribute(matchAttribute("in"))
                                                                .withObject(captureIndirectObject("container")))
                          .build(),
            mkThunk(env => {
                const item = env.get("item");
                const container = env.get("container");
                Locations.setLocation(env, item, container);
                return mkResult(true);
            }));

const PUT_ON = phaseActionBuilder("put")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("put"))
                          .withObject(captureObject("item"))
                          .withAttribute(attributeMatchBuilder().withAttribute(matchAttribute("on"))
                                                                .withObject(captureIndirectObject("container")))
                          .build(),
            mkThunk(env => {
                const item = env.get("item");
                const container = env.get("container");
                Locations.setLocation(env, item, container);
                return mkResult(true);
            }));

const EXAMINE = phaseActionBuilder("examine")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("examine")).withObject(captureObject("item")).build(),
            mkThunk(env => {
                const item = env.get("item");
                const output = item["desc"] ?? item["name"] ?? item["id"];
                Output.write(env, output[IMPLICIT_FUNCTION]? output(env).getValue() : output);
                return mkResult(true);
            }));

const WEAR = phaseActionBuilder("wear")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("wear")).withObject(captureObject("wearable")).build(),
            mkThunk(env => {
                const item = env.get("wearable");
                Locations.setLocation(env, item, Player.WEARING);
                return mkResult(true);
            }));

const TAKE_OFF = phaseActionBuilder("remove")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("remove")).withObject(captureObject("wearable")).build(),
            mkThunk(env => {
                const item = env.get("wearable");
                Locations.setLocation(env, item, Player.INVENTORY);
                return mkResult(true);
            }));

const OPEN = phaseActionBuilder("open")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("open")).withObject(captureObject("openable")).build(),
            mkThunk(env => {
                const item = env.get("openable");
                item.is_open = true;
                const message = Property.getPropertyString(env, "open.message");
                const messageEnv = env.newChild(item);
                Output.write(env, formatString(messageEnv, message));
                return mkResult(true);
            }));

const CLOSE = phaseActionBuilder("close")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("close")).withObject(captureObject("openable")).build(),
            mkThunk(env => {
                const item = env.get("openable");
                item.is_open = false;
                const message = Property.getPropertyString(env, "close.message");
                const messageEnv = env.newChild(item);
                Output.write(env, formatString(messageEnv, message));
                return mkResult(true);
            }));

const PUSH = phaseActionBuilder("push")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("push")).withObject(captureObject("pushable")).withModifier(captureModifier("direction")).build(),
            mkThunk(env => {
                const item =  env.get("pushable");
                const direction = env.get("direction");
                const location = Entities.getEntity(env, Locations.getLocation(item));
                const exits = location["exits"] ?? {};
                const destination = exits[direction];
                if (destination) {
                    Locations.setLocation(env, item, destination);
                    Output.write(env, `Pushed ${getName(item as Nameable)} ${direction}`);
                }
                return mkResult(true);
            }));

export function getDefaultVerbs(env : Env) : Obj[] {
    return DEFAULT_VERBS.map(verb => ({
        ...verb,
        name :  Property.getPropertyString(env, `${verb["id"]}.name`, verb["id"])
    }));
}

// TODO we should load this from a data file
const DEFAULT_VERBS = [
      new VerbBuilder({"id":"go"})
                  .withTrait("intransitive")
                  .withAction(GO)
                  .withModifier("direction")
                  .build(),
      new VerbBuilder({"id":"look"})
                  .withTrait("intransitive")
                  .withTrait("instant")
                  .withAction(LOOK)
                  .build(),
      new VerbBuilder({"id":"inventory"})
                  .withTrait("intransitive")
                  .withTrait("instant")
                  .withAction(INVENTORY_ACTION)
                  .build(),
      new VerbBuilder({"id":"wait"})
                  .withTrait("intransitive")
                  .withAction(WAIT)
                  .build(),
      new VerbBuilder({"id":"get"})
                  .withTrait("transitive")
                  .withAction(GET)
                  .withContext("environment")
                  .build(),
      new VerbBuilder({"id":"drop"})
                  .withTrait("transitive")
                  .withAction(DROP)
                  .withContext("inventory")
                  .withContext("holding")
                  .build(),
      new VerbBuilder({"id":"put"})
                  .withTrait("transitive")
                  .withAction(PUT_IN)
                  .withAction(PUT_ON)
                  .withAttribute("in")
                  .withAttribute("on")
                  .withContext("inventory")
                  .withContext("holding")
                  .withContext("environment", "indirect")
                  .build(),
      new VerbBuilder({"id":"examine"})
                  .withTrait("transitive")
                  .withTrait("instant")
                  .withAction(EXAMINE)
                  .build(),
      new VerbBuilder({"id":"wear"})
                  .withTrait("transitive")
                  .withAction(WEAR)
                  .withContext("inventory")
                  .build(),
      new VerbBuilder({"id":"remove"})
                  .withTrait("transitive")
                  .withAction(TAKE_OFF)
                  .withContext("wearing")
                  .build(),
      new VerbBuilder({"id":"open"})
                  .withTrait("transitive")
                  .withAction(OPEN)
                  .build(),
      new VerbBuilder({"id":"close"})
                  .withTrait("transitive")
                  .withAction(CLOSE)
                  .build(),
      new VerbBuilder({"id":"push"})
                  .withTrait("transitive")
                  .withAction(PUSH)
                  .withContext("environment")
                  .withContext("location")
                  .withModifier("direction")
                  .build()
];