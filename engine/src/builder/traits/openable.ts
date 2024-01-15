import { parseToThunk } from "../../script/parser";
import { EntityBuilder } from "../entitybuilder";
import { TraitProcessor } from "./trait";
import * as Tags from "../tags";
import { VERB_NAMES } from "../defaultverbs";

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