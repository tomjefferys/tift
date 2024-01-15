import { Obj } from "../../util/objects";
import { VERB_NAMES } from "../defaultverbs";
import { EntityBuilder } from "../entitybuilder";
import * as Tags from "../tags";
import _ from "lodash";
import * as Location from "../locations";
import * as Entities from "../entities";

/**
 * A trait processor is a function which takes an object, its tags and an entity builder and adds
 * verbs, properties and behaviour to the entity builder.
 */
export type TraitProcessor = (obj : Obj, tags : string[], entityBuilder : EntityBuilder) => void;

export const CARRYABLE : TraitProcessor = (obj, tags, builder) => {
    if (tags.includes(Tags.CARRYABLE)) {
        builder.withVerb(VERB_NAMES.GET);
        builder.withVerb(VERB_NAMES.DROP);
        builder.withVerb(VERB_NAMES.PUT);
    }
}

export const WEARABLE : TraitProcessor = (obj, tags, builder) => {
    if (tags.includes(Tags.WEARABLE)) {
        builder.withVerb(VERB_NAMES.WEAR);
        builder.withVerb(VERB_NAMES.REMOVE);
    }
}

export const PUSHABLE : TraitProcessor = (obj, tags, builder) => {
    if (tags.includes(Tags.PUSHABLE)) {
        builder.withVerb(VERB_NAMES.PUSH);
    }
}

export const EXAMINABLE : TraitProcessor = (obj, tags, builder) => {
    if (_.has(obj, "desc")) {
        builder.withVerb("examine");
    }
}

export const NPC : TraitProcessor = (obj, tags, builder) => {
    if (tags.includes("NPC")) {
        if (!obj["onMove(newLoc)"]) {
            builder.withProp("onMove(newLoc)", Location.makeOnMove());
        }
    }
}

export const VISIBLE_WHEN_DARK : TraitProcessor = (obj, tags, builder) => {
    if (tags.includes("visibleWhenDark")) {
        if (!obj["visibleWhen()"]) {
            builder.withProp("visibleWhen()", Entities.makeVisibleWhenDarkFn());
        }
    }
}