import { Obj } from "../../util/objects";
import * as VERB_NAMES from "../verbnames";
import { EntityBuilder } from "../entitybuilder";
import * as Tags from "../tags";
import _ from "lodash";
import * as Location from "../locations";
import * as Entities from "../entities";
import { CONTAINER } from "./container";
import { OPENABLE } from "./openable";
import { LOCKABLE } from "./lockable";
import * as Player from "../player";

/**
 * A trait processor is a function which takes an object, its tags and an entity builder and adds
 * verbs, properties and behaviour to the entity builder.
 */
export type TraitProcessor = (obj : Obj, tags : string[], entityBuilder : EntityBuilder) => void;

const CARRYABLE : TraitProcessor = (_obj, tags, builder) => {
    if (tags.includes(Tags.CARRYABLE) || tags.includes(Tags.CARRIED)) {
        builder.withVerb(VERB_NAMES.GET);
        builder.withVerb(VERB_NAMES.DROP);
        builder.withVerb(VERB_NAMES.PUT);
    }
    if (tags.includes(Tags.CARRIED)) {
        builder.withProp(Location.LOCATION, Player.INVENTORY);
    }
}


const WEARABLE : TraitProcessor = (_obj, tags, builder) => {
    if (tags.includes(Tags.WEARABLE) || tags.includes(Tags.WORN)) {
        builder.withVerb(VERB_NAMES.WEAR);
        builder.withVerb(VERB_NAMES.REMOVE);
    }
    if (tags.includes(Tags.WORN)) {
        builder.withProp(Location.LOCATION, Player.WEARING);
    }
}

const PUSHABLE : TraitProcessor = (_obj, tags, builder) => {
    if (tags.includes(Tags.PUSHABLE)) {
        builder.withVerb(VERB_NAMES.PUSH);
    }
}

const EXAMINABLE : TraitProcessor = (obj, _tags, builder) => {
    if (_.has(obj, "description")) {
        builder.withVerb("examine");
    }
}

const NPC : TraitProcessor = (obj, tags, builder) => {
    if (tags.includes("NPC")) {
        if (!obj["onMove(newLoc)"]) {
            builder.withProp("onMove(newLoc)", Location.makeOnMove());
        }
    }
}

const VISIBLE_WHEN_DARK : TraitProcessor = (obj, tags, builder) => {
    if (tags.includes("visibleWhenDark")) {
        if (!obj["visibleWhen()"]) {
            builder.withProp("visibleWhen()", Entities.makeVisibleWhenDarkFn());
        }
    }
}

export const TRAITS : TraitProcessor[] = [
    CARRYABLE,
    WEARABLE,
    PUSHABLE,
    EXAMINABLE,
    NPC,
    VISIBLE_WHEN_DARK,
    CONTAINER,
    OPENABLE,
    LOCKABLE
];