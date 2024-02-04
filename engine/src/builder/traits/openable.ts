import { parseToThunk } from "../../script/parser";
import { EntityBuilder } from "../entitybuilder";
import { TraitProcessor } from "./trait";
import * as Tags from "../tags";
import * as Entities from "../entities";
import * as VERB_NAMES from "../verbnames";
import { Obj } from "tift-types/src/util/objects";

export const OPENABLE : TraitProcessor = (_obj, tags, builder) => {
    if (tags.includes(Tags.OPENABLE)) {
        addOpenClose(builder, false);
    } else if (tags.includes(Tags.CLOSABLE)) {
        addOpenClose(builder, true);
    }
}

function addOpenClose(builder : EntityBuilder, isOpen : boolean) {
    builder.withVerbMatcher({ verb : VERB_NAMES.OPEN, condition : parseToThunk("is_open == false") });
    builder.withVerbMatcher({ verb : VERB_NAMES.CLOSE, condition : parseToThunk("is_open == true") });
    builder.withProp("is_open", isOpen);
}

export function isClosable(entity : Obj) : boolean {
    return Entities.entityHasTag(entity, Tags.CLOSABLE) || Entities.entityHasTag(entity, Tags.OPENABLE);
}

export function isOpen(entity : Obj) : boolean {
    return entity.is_open;
}
