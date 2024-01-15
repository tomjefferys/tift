import { captureObject, matchBuilder, matchVerb } from "../../commandmatcher";
import { PhaseActionBuilder } from "../../script/phaseaction";
import { mkResult, mkThunk } from "../../script/thunk";
import * as Tags from "../tags";
import { TraitProcessor } from "./trait";
import * as Locations from "../locations";
import * as Entities from "../entities";
import * as Property from "../../properties";
import { Nameable, getFullName } from "../../nameable";
import { formatString } from "../../util/mustacheUtils";
import * as Output from "../output";
import { Env } from "tift-types/src/env";
import { VERB_NAMES } from "../defaultverbs";

const PARAM_CONTAINER = "container";
const PARAM_ITEM = "item";

export const CONTAINER : TraitProcessor = (_obj, tags, builder) => {
    if (!tags.includes(Tags.CONTAINER)) {
        return;
    }
    builder.withAttributedVerb(VERB_NAMES.PUT, "in");

    const matcher = matchBuilder()
                        .withVerb(matchVerb(VERB_NAMES.EXAMINE))
                        .withObject(captureObject("this"))
                        .build();

    const thunk = mkThunk(env => {
        const childEnv = env.newChild({[PARAM_CONTAINER] : env.get("this")})
        return EXAMINE_CONTAINER_FN(childEnv);
    })
    const phaseAction = 
        new PhaseActionBuilder()
                        .withPhase("after")
                        .withMatcherOnMatch(matcher, thunk);
    builder.withAfter(phaseAction);
    const isOpenable = tags.includes(Tags.OPENABLE) || tags.includes(Tags.CLOSABLE);
    if (isOpenable) {
        const matcher = matchBuilder()
                            .withVerb(matchVerb("get"))
                            .withObject(captureObject(PARAM_ITEM))
                            .build();

        const thunk = mkThunk(env => {
            const childEnv = env.newChild({[PARAM_CONTAINER] : env.get("this")})
            return GET_FROM_CONTAINER_FN(childEnv);
        });
        const phaseAction = 
            new PhaseActionBuilder()
                        .withPhase("before")
                        .withMatcherOnMatch(matcher, thunk);   
        builder.withBefore(phaseAction);
    }
}

const EXAMINE_CONTAINER_FN = (env : Env) => {
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

const GET_FROM_CONTAINER_FN = (env : Env) => {
    const item = env.get(PARAM_ITEM);
    const container = env.get(PARAM_CONTAINER);
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
