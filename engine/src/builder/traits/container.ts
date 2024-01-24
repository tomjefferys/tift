import { Matcher, attributeMatchBuilder, captureIndirectObject, captureObject, matchAttribute, matchBuilder, matchVerb } from "../../commandmatcher";
import { Phase, PhaseActionBuilder, PhaseActionType } from "../../script/phaseaction";
import { EnvFn, mkResult, mkThunk } from "../../script/thunk";
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

const PARAM_CONTAINER = "container";
const PARAM_ITEM = "item";

export const CONTAINER : TraitProcessor = (_obj, tags, builder) => {
    if (!tags.includes(Tags.CONTAINER)) {
        return;
    }
    builder.withAttributedVerb(VERB_NAMES.PUT, "in");

    builder.withAfter(createAction(createMatcher(VERB_NAMES.EXAMINE, "this"), "after", EXAMINE_CONTAINER_FN));

    const isOpenable = tags.includes(Tags.OPENABLE) || tags.includes(Tags.CLOSABLE);
    if (isOpenable) {
        // Get from container
        builder.withBefore(createAction(createMatcher(VERB_NAMES.GET, PARAM_ITEM), "before", GET_FROM_CONTAINER_FN));

        // Put in container
        const putMatcher = matchBuilder()
            .withVerb(matchVerb(VERB_NAMES.PUT))
            .withObject(captureObject(PARAM_ITEM))
            .withAttribute(attributeMatchBuilder()
                            .withAttribute(matchAttribute("in"))
                            .withObject(captureIndirectObject("this")))
            .build();
        builder.withBefore(createAction(putMatcher, "before", PUT_IN_CONTAINER_FN));
    }
}

function createMatcher(verb : string, obj : string) : Matcher {
    return matchBuilder()
                .withVerb(matchVerb(verb))
                .withObject(captureObject(obj))
                .build();
}

function createAction<T extends Phase>(matcher : Matcher, phase : T, fn : EnvFn) : PhaseActionType<T> {
    const thunk = mkThunk(env => {
        const childEnv = env.newChild({[PARAM_CONTAINER] : env.get("this")});
        return fn(childEnv);
    });

    const phaseAction = 
        new PhaseActionBuilder()
                        .withPhase(phase)
                        .withMatcherOnMatch(matcher, thunk);
    return phaseAction as unknown as PhaseActionType<T>;  // FIXME get this to work without the cast
}


const EXAMINE_CONTAINER_FN : EnvFn = (env) => {
    const container = env.get(PARAM_CONTAINER);
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


const PUT_IN_CONTAINER_FN : EnvFn = (env) => {
    const item = env.get(PARAM_ITEM);
    const container = env.get(PARAM_CONTAINER);
    let canPut = true;
    if(isClosable(container)) {
        if (!container.is_open) {
            const template = Property.getPropertyString(env, "put.templates.container.closed");
            const partials = Property.getProperty(env, "put.templates.partials", {}) as Record<string,string>;
            const view = {
                container : getFullName(container as Nameable),
                item : getFullName(item as Nameable)
            }
            const scope = env.newChild(view);
            const output = formatString(scope, template, undefined, partials);
            Output.write(env, output);
            canPut = false;
        }
    }
    return mkResult(!canPut)
}

function isClosable(entity : Obj) : boolean {
    return Entities.entityHasTag(entity, Tags.CLOSABLE) || Entities.entityHasTag(entity, Tags.OPENABLE);
}