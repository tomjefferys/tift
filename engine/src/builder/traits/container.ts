import { Matcher, attributeMatchBuilder, captureIndirectObject, captureObject, matchAttribute, matchBuilder, matchVerb } from "../../commandmatcher";
import { Phase, PhaseActionBuilder, PhaseActionType } from "../../script/phaseaction";
import { EnvFn, Thunk, mkResult, mkThunk } from "../../script/thunk";
import * as Tags from "../tags";
import { TraitProcessor } from "./trait";
import * as Locations from "../locations";
import * as Entities from "../entities";
import * as Property from "../../properties";
import { Nameable, getFullName } from "../../nameable";
import { formatString } from "../../util/mustacheUtils";
import * as Output from "../output";
import { VERB_NAMES } from "../defaultverbs";
import { Obj } from "tift-types/src/util/objects";
import { Env } from "tift-types/src/env";

const CLOSED_CONTAINER_MESSAGE = "put.templates.container.closed";
const CONTAINER_IN_ITEM_MESSAGE = "put.templates.container.inItem";
const PUT_PARTIAL_TEMPLATES = "put.templates.partials"
const GET_PARTIAL_TEMPLATES = "get.templates.partials"

const PARAM_CONTAINER = "container";
const PARAM_ITEM = "item";

export const CONTAINER : TraitProcessor = (_obj, tags, builder) => {
    if (!tags.includes(Tags.CONTAINER)) {
        return;
    }
    builder.withAttributedVerb(VERB_NAMES.PUT, "in");

    builder.withAfter(createAction(createMatcher(VERB_NAMES.EXAMINE, "this"),
                      createThunk(EXAMINE_CONTAINER_FN), "after"));

    // Get from container
    builder.withBefore(createAction(createMatcher(VERB_NAMES.GET, PARAM_ITEM), 
                        createThunk(GET_FROM_CONTAINER_FN), "before"));

    // Put in container
    // FIXME: When putting a container inside another container, the before action will be called twice
    //        it matches both the container and the item. The item first as it's the direct object, then
    //        the container as it's the indirect object.
    //        We can check for this in the put function, but it would be better if we could avoid this.
    const putMatcher = matchBuilder()
        .withVerb(matchVerb(VERB_NAMES.PUT))
        .withObject(captureObject(PARAM_ITEM))
        .withAttribute(attributeMatchBuilder()
                        .withAttribute(matchAttribute("in"))
                        .withObject(captureIndirectObject("container")))
        .build();
    builder.withBefore(createAction(putMatcher, mkThunk(PUT_IN_CONTAINER_FN), "before"));
}

function createMatcher(verb : string, obj : string) : Matcher {
    return matchBuilder()
                .withVerb(matchVerb(verb))
                .withObject(captureObject(obj))
                .build();
}

function createThunk(fn : EnvFn) : Thunk {
    return mkThunk(env => {
        const childEnv = env.newChild({[PARAM_CONTAINER] : env.get("this")});
        return fn(childEnv);
    });
}

function createAction<T extends Phase>(matcher : Matcher, thunk : Thunk, phase : T) : PhaseActionType<T> {
    const phaseAction = 
        new PhaseActionBuilder()
                        .withPhase(phase)
                        .withMatcherOnMatch(matcher, thunk);
    return phaseAction as unknown as PhaseActionType<T>;  // FIXME get this to work without the cast
}


const EXAMINE_CONTAINER_FN : EnvFn = (env) => {
    const container = env.get(PARAM_CONTAINER);
    if(isClosable(container) && !(container.is_open || Entities.entityHasTag(container, Tags.TRANSPARENT))) {
        return mkResult(false);
    }

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

const GET_FROM_CONTAINER_FN : EnvFn = (env) => {
    const item = env.get(PARAM_ITEM);
    const container = env.get(PARAM_CONTAINER);
    let canGet = true;
    if(Locations.isAtLocation(env, container.id, item) && isClosable(container)) {
        if (!container.is_open) {
            writeError(env, CLOSED_CONTAINER_MESSAGE, GET_PARTIAL_TEMPLATES, container, item);
            canGet = false;
        }
    }
    return mkResult(!canGet)
}


const PUT_IN_CONTAINER_FN : EnvFn = (env) => {
    const item = env.get(PARAM_ITEM);
    const container = env.get(PARAM_CONTAINER);
    const activeItem = env.get("id");
    if (container.id !== activeItem) { // Only execute if the container is the active item
        return mkResult(false);
    }
    const containerInsideItem = Locations.isAtLocation(env, item.id, container);
    if(containerInsideItem) {
        writeError(env, CONTAINER_IN_ITEM_MESSAGE, PUT_PARTIAL_TEMPLATES, container, item);
    }
    let canPut = !containerInsideItem;
    if(canPut && isClosable(container)) {
        if (!container.is_open) {
            writeError(env, CLOSED_CONTAINER_MESSAGE, PUT_PARTIAL_TEMPLATES, container, item);
            canPut = false;
        }
    }
    return mkResult(!canPut)
}

function writeError(env : Env, property : string, partialsProperty : string, container : Obj, item : Obj) {
    const template = Property.getPropertyString(env, property);
    const partials = Property.getProperty(env, partialsProperty, {}) as Record<string,string>;
    const view = {
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