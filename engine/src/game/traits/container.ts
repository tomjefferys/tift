import { attributeMatchBuilder, captureIndirectObject, captureObject, matchAttribute, matchBuilder, matchVerb } from "../../commandmatcher";
import { EnvFn, Thunk, mkResult, mkThunk } from "../../script/thunk";
import * as Tags from "../tags";
import { TraitProcessor } from "./trait";
import * as Locations from "../locations";
import * as Entities from "../entities";
import * as Property from "../../properties";
import { Nameable, getFullName } from "../../nameable";
import { formatString } from "../../util/mustacheUtils";
import * as Output from "../output";
import * as VERB_NAMES from "../verbnames";
import { Obj } from "tift-types/src/util/objects";
import { Env } from "tift-types/src/env";
import { createMatcher, createAction, createThisMatcher } from "./traitutils";
import { SPATIAL_PREPOSITIONS } from "../defaultverbs";
import { getLogger } from "../../util/logger";

const CLOSED_CONTAINER_MESSAGE = "put.templates.container.closed";
const CONTAINER_IN_ITEM_MESSAGE = "put.templates.container.inItem";
const PUT_PARTIAL_TEMPLATES = "put.templates.partials"
const GET_PARTIAL_TEMPLATES = "get.templates.partials"

const PARAM_CONTAINER = "container";
const PARAM_ITEM = "item";

const ADPOSITION_PROP = "adposition";
const PUT_ATTR_PROP = "putAttribute";

const logger = getLogger("game.traits.container");

export const CONTAINER : TraitProcessor = (obj, tags, builder) => {
    if (!tags.includes(Tags.CONTAINER)) {
        return;
    }

    const adposition = obj[ADPOSITION_PROP] as string ?? "in";

    let putAttribute = adposition;
    if (!SPATIAL_PREPOSITIONS.includes(adposition)) {
        if (obj[PUT_ATTR_PROP] && SPATIAL_PREPOSITIONS.includes(obj[PUT_ATTR_PROP] as string)) {
            putAttribute = obj[PUT_ATTR_PROP] as string;
        } else {
            logger.warn(() => `Invalid or missing adposition [${adposition}] for container [${obj["id"]}]. Defaulting to 'in'`);
            putAttribute = "in";
        }
    }

    builder.withAttributedVerb(VERB_NAMES.PUT, putAttribute)

    builder.withAfter(createAction(createThisMatcher(VERB_NAMES.EXAMINE),
                      createThunk(getExamineContainerFn(adposition)), "after"));

    // Get from container
    builder.withBefore(createAction(createMatcher(VERB_NAMES.GET, PARAM_ITEM), 
                        createThunk(getFromContainerFn(adposition)), "before"));

    // Put in container
    // FIXME: When putting a container inside another container, the before action will be called twice
    //        it matches both the container and the item. The item first as it's the direct object, then
    //        the container as it's the indirect object.
    //        We can check for this in the put function, but it would be better if we could avoid this.
    const putMatcher = matchBuilder()
        .withVerb(matchVerb(VERB_NAMES.PUT))
        .withObject(captureObject(PARAM_ITEM))
        .withAttribute(attributeMatchBuilder()
                        .withAttribute(matchAttribute(adposition))
                        .withObject(captureIndirectObject("container")))
        .build();
    builder.withBefore(createAction(putMatcher, mkThunk(getPutInContainerFn(adposition)), "before"));
}

function createThunk(fn : EnvFn) : Thunk {
    return mkThunk(env => {
        const childEnv = env.newChild({[PARAM_CONTAINER] : env.get("this")});
        return fn(childEnv);
    });
}

function getExamineContainerFn(adposition : string) : EnvFn {

    return (env) => {
        const container = env.get(PARAM_CONTAINER);
        if(isClosable(container) && !(container.is_open || Entities.entityHasTag(container, Tags.TRANSPARENT))) {
            return mkResult(false);
        }

        const items = Locations.findEntities(env, container)
                            .filter(Entities.isEntity)
                            .filter(entity => Entities.isEntityVisible(env, true, entity));
 
        if (items.length === 0) {
            return mkResult(false);
        }

        const template = Property.getPropertyString(env, `examine.templates.container`);
        const partials = Property.getProperty(env, "examine.templates.partials") as Record<string,string>;

        const view = {
            adposition,
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
}

function getFromContainerFn(adposition : string) : EnvFn {
    return (env) => {
        const item = env.get(PARAM_ITEM);
        const container = env.get(PARAM_CONTAINER);
        let canGet = true;
        if(Locations.isAtLocation(env, container.id, item) && isClosable(container)) {
            if (!container.is_open) {
                writeError(env, `${CLOSED_CONTAINER_MESSAGE}`, GET_PARTIAL_TEMPLATES, container, item, adposition);
                canGet = false;
            }
        }
        return mkResult(!canGet)
    }
}


function getPutInContainerFn(adposition : string) : EnvFn {
    return (env) => {
        const item = env.get(PARAM_ITEM);
        const container = env.get(PARAM_CONTAINER);
        const activeItem = env.get("id");
        if (container.id !== activeItem) { // Only execute if the container is the active item
            return mkResult(false);
        }
        const containerInsideItem = Locations.isAtLocation(env, item.id, container);
        if(containerInsideItem) {
            writeError(env, `${CONTAINER_IN_ITEM_MESSAGE}`, PUT_PARTIAL_TEMPLATES, container, item, adposition);
        }
        let canPut = !containerInsideItem;
        if(canPut && isClosable(container)) {
            if (!container.is_open) {
                writeError(env, `${CLOSED_CONTAINER_MESSAGE}`, PUT_PARTIAL_TEMPLATES, container, item, adposition);
                canPut = false;
            }
        }
        return mkResult(!canPut)
    }
}

function writeError(env : Env, property : string, partialsProperty : string, container : Obj, item : Obj, adposition : string) {
    const template = Property.getPropertyString(env, property);
    const partials = Property.getProperty(env, partialsProperty, {}) as Record<string,string>;
    const view = {
        adposition,
        container : getFullName(container as Nameable),
        item : getFullName(item as Nameable)
    }
    const scope = env.newChild(view);
    const output = formatString(scope, template, undefined, partials);
    Output.write(env, output);
}


function isClosable(entity : Obj) : boolean {
    return Entities.entityHasTag(entity, Tags.CLOSABLE) || Entities.entityHasTag(entity, Tags.OPENABLE);
}