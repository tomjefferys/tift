import { attributeMatchBuilder, captureIndirectObject, captureObject, matchAttribute, matchBuilder, matchVerb } from "../../commandmatcher";
import { phaseActionBuilder } from "../../script/phaseaction";
import { mkResult, mkThunk } from "../../script/thunk";
import * as VERB_NAMES from "../verbnames";
import { TraitProcessor } from "./trait";
import * as Property from "../../properties";
import * as Output from "../output";
import * as Tags from "../tags";
import * as Openable from "./openable";
import { formatString } from "../../util/mustacheUtils";
import { Obj } from "tift-types/src/util/objects";
import { Nameable, getFullName } from "../../nameable";
import { Env } from "tift-types/src/env";
import { createMatcher, createAction } from "./traitutils";

const IS_LOCKED = "is_locked";
const KEY = "key";

export const LOCKABLE : TraitProcessor = (obj, tags, builder) => {
    if (!tags.includes(Tags.LOCKABLE)) {
        return;
    }

    const isLocked = tags.includes(Tags.LOCKED);
    builder.withProp(IS_LOCKED, isLocked);
    builder.withVerbMatcher({
        verb : VERB_NAMES.UNLOCK,
        condition : mkThunk(env => mkResult(env.get(IS_LOCKED)))
    });
    builder.withVerbMatcher({
        verb : VERB_NAMES.LOCK,
        condition : mkThunk(env => mkResult(!env.get(IS_LOCKED)))
    });

    const openMatcher = createMatcher(VERB_NAMES.OPEN, "this");
    const closeMatcher = createMatcher(VERB_NAMES.CLOSE, "this");
    const isLockedThunk = mkThunk(env => {
        const lockable = env.get("this");
        const view = {
            item: getFullName(lockable as Nameable)
        }
        writeMessage(env, view, "open.templates.isLocked");
        return mkResult(lockable[IS_LOCKED]);
    });

    builder.withBefore(createAction(openMatcher, isLockedThunk, "before"));
    builder.withBefore(createAction(closeMatcher, isLockedThunk, "before"));
};

const LOCKABLE_PARAM = "lockable";
const KEY_PARAM = "key";

export const UNLOCK = phaseActionBuilder(VERB_NAMES.UNLOCK)
            .withPhase("main")
            .withMatcherOnMatch(
                matchBuilder().withVerb(matchVerb(VERB_NAMES.UNLOCK))
                              .withObject(captureObject(LOCKABLE_PARAM))
                              .withAttribute(
                                    attributeMatchBuilder().withAttribute(matchAttribute("with"))
                                                           .withObject(captureIndirectObject(KEY_PARAM))
                              ).build(),
                mkThunk(env => {
                    const item = env.get(LOCKABLE_PARAM);
                    const key = env.get(KEY_PARAM);

                    const view = getItemKeyView(item, key);
                    // Check if item is open
                    if (Openable.isClosable(item) && Openable.isOpen(item)) {
                        writeMessage(env, view, "unlock.templates.isOpen");
                        return mkResult(false);
                    }

                    // Check item is locked
                    if (!item[IS_LOCKED]) {
                        writeMessage(env, view, "unlock.templates.alreadyUnlocked");
                        return mkResult(false);
                    }

                    // Check correct key
                    if (key.id !== item[KEY]) {
                        writeMessage(env, view, "unlock.templates.wrongKey");
                        return mkResult(false);
                    }

                    // Unlock
                    item[IS_LOCKED] = false;
                    writeMessage(env, view, "unlock.templates.success");
                    return mkResult(true);
                }));

export const LOCK = phaseActionBuilder(VERB_NAMES.LOCK)
            .withPhase("main")
            .withMatcherOnMatch(
                matchBuilder().withVerb(matchVerb(VERB_NAMES.LOCK))
                              .withObject(captureObject(LOCKABLE_PARAM))
                              .withAttribute(
                                    attributeMatchBuilder().withAttribute(matchAttribute("with"))
                                                           .withObject(captureIndirectObject(KEY_PARAM))
                              ).build(),
                mkThunk(env => {
                    const item = env.get(LOCKABLE_PARAM);
                    const key = env.get(KEY_PARAM);
                    const view = getItemKeyView(item, key);

                    // Check not open
                    if (Openable.isClosable(item) && Openable.isOpen(item)) {
                        writeMessage(env, view, "lock.templates.isOpen");
                        return mkResult(false);
                    }

                    // Check correct key
                    if (key.id !== item[KEY]) {
                        writeMessage(env, view, "unlock.templates.wrongKey");
                        return mkResult(false);
                    }

                    // Check item is unlocked
                    if (item[IS_LOCKED]) {
                        writeMessage(env, view, "lock.templates.alreadyLocked");
                        return mkResult(false);
                    }

                    // Lock
                    item[IS_LOCKED] = true;
                    writeMessage(env, view, "lock.templates.success");
                    return mkResult(true);
                }));

function getItemKeyView(item : Obj, key : Obj) {
    return {
        item: getFullName(item as Nameable),
        key: getFullName(key as Nameable)
    }
}

function writeMessage(env : Env, view : Obj, messageProp : string) {
    const template = Property.getPropertyString(env, messageProp);
    const messageEnv = env.newChild(view);
    Output.write(env, formatString(messageEnv, template));
}
