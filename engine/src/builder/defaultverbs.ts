import { phaseActionBuilder } from "../script/phaseaction";
import { captureModifier, captureObject, captureIndirectObject, matchAttribute, matchBuilder, attributeMatchBuilder, matchVerb } from "../commandmatcher";
import { mkResult, mkThunk } from "../script/thunk";
import { getLocationEntity, findEntites, isEntity, isEntityVisible, isAtLocation, isEntityMovable, isEntityNPC, entityHasTag, 
         DARK, isLightSourceAtLocation, PLAYER, LOCATION, getEntity, write, INVENTORY, WEARING, getLocation } from "./enginedefault";
import { Env } from "tift-types/src/env";
import { formatEntityString } from "../util/mustacheUtils";
import { VerbBuilder } from "./verbbuilder";
import { Obj } from "tift-types/src/util/objects";
import { getName, Nameable } from "../nameable";
import * as Mustache from "mustache"
import { Optional } from "tift-types/src/util/optional";

const LOOK_TEMPLATE = 
`{{#isDark}}
  It is dark, you cannot see a thing.
{{/isDark}}

{{^isDark}}
{{desc}}

{{#hasItems}}
You can see:
{{/hasItems}}
{{#items}}
- {{> item}}
{{/items}}
{{/isDark}}`;

const LOOK_ITEM_TEMPLATE = `{{name}}{{#location}} ( in {{.}} ){{/location}}`;

export const LOOK_COUNT = "__LOOK_COUNT__";

export const LOOK_FN = (env : Env) => {
    const location = getLocationEntity(env);

    const desc = (location["desc"] && formatEntityString(env, location, "desc")) 
                        ?? location["name"]
                        ?? location["id"];

    const items = findEntites(env, location)
                     .filter(isEntity)
                     .filter(isEntityVisible)
                     .filter(obj => isEntityMovable(obj) || isEntityNPC(obj))
                     .filter(obj => !isAtLocation(env, PLAYER, obj));
                    
    const isDark = entityHasTag(location, DARK) && !isLightSourceAtLocation(env, location);

    const getItemDescription = (item : Obj) => {
        const itemLocation = item[LOCATION];
        const locationObj = (itemLocation !== location.id) 
                ? { location : getName(getEntity(env, itemLocation) as Nameable)}
                : {};
        return { name : getName(item as Nameable), ...locationObj };
    }

    // Desc should have any moustache expressions expanded
    const view = {
        "desc" : desc,
        "hasItems" : Boolean(items.length),
        "items" : items.map(getItemDescription),
        "isDark" : isDark
    }

    const output = Mustache.render(LOOK_TEMPLATE, view, { item : LOOK_ITEM_TEMPLATE });

    // Update look count if it exists. It should only have been created if needed by one of the mustache functions
    // FIXME related code is split between here and mustacheUtils. Should try to move it to one place.
    const lookCount : Optional<number> = location[LOOK_COUNT];
    if (lookCount !== undefined) {
        location[LOOK_COUNT] = lookCount + 1;
    }
    write(env, output);

    return mkResult(true);
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
                    env.findObjs(obj => obj?.location === INVENTORY && isEntity(obj))
                       .forEach(entity => write(env, getName(entity as Nameable)));
    
                    env.findObjs(obj => obj?.location === WEARING && isEntity(obj))
                       .forEach(entity => write(env, ` ${getName(entity as Nameable)} (wearing)` ));
                    return mkResult(true);
                })
        )

const WAIT = phaseActionBuilder("wait")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("wait")).build(),
            mkThunk(env => {
                write(env,  "Time passes");
                return mkResult(true);
    }));
        

const GO = phaseActionBuilder("go")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("go")).withModifier(captureModifier("direction")).build(),
            mkThunk(env => {
                const location = getLocationEntity(env);
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
                item.location = INVENTORY;
                return mkResult(true);
            }));

const DROP = phaseActionBuilder("drop")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("drop")).withObject(captureObject("item")).build(), 
            mkThunk(env => {
                const item = env.get("item");
                const location = getLocation(env);
                item.location = location;
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
                item[LOCATION] = container.id;
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
                item[LOCATION] = container.id;
                return mkResult(true);
            }));

const EXAMINE = phaseActionBuilder("examine")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("examine")).withObject(captureObject("item")).build(),
            mkThunk(env => {
                const item = env.get("item");
                const output = formatEntityString(env, item, "desc");
                write(env, output);
                return mkResult(true);
            }));

const WEAR = phaseActionBuilder("wear")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("wear")).withObject(captureObject("wearable")).build(),
            mkThunk(env => {
                const item = env.get("wearable");
                item[LOCATION] = WEARING;
                return mkResult(true);
            }));

const TAKE_OFF = phaseActionBuilder("remove")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("remove")).withObject(captureObject("wearable")).build(),
            mkThunk(env => {
                const item = env.get("wearable");
                item[LOCATION] = INVENTORY;
                return mkResult(true);
            }));

const PUSH = phaseActionBuilder("push")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("push")).withObject(captureObject("pushable")).withModifier(captureModifier("direction")).build(),
            mkThunk(env => {
                const item =  env.get("pushable");
                const direction = env.get("direction");
                const location = getEntity(env, item[LOCATION]);
                const exits = location["exits"] ?? {};
                const destination = exits[direction];
                if (destination) {
                    item[LOCATION] = destination;
                    write(env, `Pushed ${getName(item as Nameable)} ${direction}`);
                }
                return mkResult(true);
            }));

// TODO we should load this from a data file
export const DEFAULT_VERBS = [
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
      new VerbBuilder({"id":"push"})
                  .withTrait("transitive")
                  .withAction(PUSH)
                  .withContext("environment")
                  .withContext("location")
                  .withModifier("direction")
                  .build()
];