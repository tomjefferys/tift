import { Command } from "./command";
import { PoSType } from "tift-types/src/messages/word";
import { Obj } from "tift-types/src/util/objects"

// verb                                -- intranitive verb
// verb object                         -- transitive verb
// verb object (with) object           -- transitive verb with attribute
// verb direction                      -- intransitive verb with qualifier
// verb object (to) direction          -- tranistive verb with qualifier
// verb object direction (with) object -- transitive verb with qual and attr
// verb object (to) subVerb                    -- clausal verb (sub-command), eg "tell robot to go"
// verb object (to) subVerb direction          -- clausal verb, sub-command with modifier
// verb object (to) subVerb subObject          -- clausal verb, sub-command with direct object
// verb object (to) subVerb (with) subObject   -- clausal verb, sub-command with attribute

// verb(directObj).attribute(indirectObj).modifier().modifier()
// why not just [verb, directObj, attribute, indirectObj, modifier, modifier]
//  because it doesn't make sense to capture verbs, and verb attributes.  We probably do want to capture modifiers
// verb(directObj, modifiers...).attribute(indirectObj, modifiers...)
// verb(directObj, modifiers...).attribute(subVerb(subObjOrModifiers...).subAttribute(subIndirectObj))
//  -- for clausal verbs, the attribute's single argument is itself a sub-command
//  (SubCommandMatchBuilder), matched the same way as the top-level verb/object/modifiers,
//  one level down - including its own optional attribute (SubAttributeMatchBuilder), eg the
//  nested "stir(soup).with(spoon)" in "tell(this).to(stir(soup).with(spoon))".

// So what is the data structure

const SCORE_NO_MATCH = { score : 0 };
const SCORE_WILDCARD = { score : 1 };
const SCORE_EXACT = { score : 2  };
const SCORE_OBJ_EXACT = { score : 10 };


export type Matcher = (command : Command, objId : string) => MatchResult;

export interface MatchResult {
    isMatch : boolean,
    score : number,
    captures? : Obj
}

const FAILED_MATCH : MatchResult = { isMatch : false, ...SCORE_NO_MATCH };

export const ALWAYS_FAIL : Matcher = (_state, _objId) => FAILED_MATCH;

function failIfProvided(part : PoSType) : Matcher {
    return command => ({ isMatch : !command.getPoS(part), ...SCORE_NO_MATCH })
}

class MatchBuilder {
    verb? : Matcher;
    obj? : Matcher;
    attributeBuilder? : AttributeMatchBuilder;
    subCommandBuilder? : SubCommandMatchBuilder;
    modifiers : Matcher[] = [];

    withVerb(verb : Matcher) : MatchBuilder {
        this.verb = verb
        return this;
    }

    withObject(obj : Matcher) : MatchBuilder {
        this.obj = obj;
        return this;
    }

    withAttribute(attributeBuilder : AttributeMatchBuilder) : MatchBuilder {
        this.attributeBuilder = attributeBuilder;
        return this;
    }

    withSubCommand(subCommandBuilder : SubCommandMatchBuilder) : MatchBuilder {
        this.subCommandBuilder = subCommandBuilder;
        return this;
    }

    withModifier(modifier : Matcher) : MatchBuilder {
        this.modifiers.push(modifier);
        return this;
    }

    build() : Matcher {
        if (!this.verb) {
            throw new Error("A verb must be supplied to a match builder");
        }

        const attributeMatcher = this?.subCommandBuilder?.build() ?? this?.attributeBuilder?.build() ?? failIfProvided("preposition");
        const objMatcher = this?.obj ?? failIfProvided("directObject");
        const verbMatcher = this?.verb ?? failIfProvided("verb");
        const modMatchers = this.modifiers.length ? this.modifiers : [matchNoModifiers()];
        const matchers : Matcher[] = [verbMatcher, objMatcher, attributeMatcher, ...modMatchers];

        const matcher : Matcher = (command, objId) => matchAll(command, objId, ...matchers);
        matcher.toString = () => "[" + matchers.map(matcher => matcher.toString()).join(",") + "]";
        return matcher;
    }
}


class AttributeMatchBuilder {
    attribute? : Matcher;
    obj? : Matcher;
    modifiers : Matcher[] = []; // FIXME this isn't getting used

    withAttribute(attribute : Matcher) : AttributeMatchBuilder {
        this.attribute = attribute;
        return this;
    }

    withObject(obj : Matcher) : AttributeMatchBuilder {
        this.obj = obj;
        return this;
    }

    withModifier(modifier : Matcher) : AttributeMatchBuilder {
        this.modifiers.push(modifier);
        return this;
    }

    build() : Matcher {
        if (!this.attribute) {
            throw new Error("Attribute matcher must have an attribute");
        }
        if (!this.obj) { 
            throw new Error("Attribute matcher must have an object");
        }
        const attrMatcher = this.attribute;
        const objMatcher = this.obj;
        const matcher : Matcher = (command, objId) => matchAll(command, objId, attrMatcher, objMatcher);
        matcher.toString = () => "[" + attrMatcher.toString() + "," + objMatcher.toString() + "]";
        return matcher;
    }
}

/**
 * Matches the sub-command of a "clausal" verb, eg the "go north" in "tell robot to go north".
 * Mirrors MatchBuilder, one level down: attribute (eg "to") + sub-verb + sub-object/modifiers
 * + the sub-command's own attribute (eg "with" in "tell robot to stir soup with spoon").
 */
class SubCommandMatchBuilder {
    attribute? : Matcher;
    subVerb? : Matcher;
    subObj? : Matcher;
    subAttributeBuilder? : SubAttributeMatchBuilder;
    subModifiers : Matcher[] = [];

    withAttribute(attribute : Matcher) : SubCommandMatchBuilder {
        this.attribute = attribute;
        return this;
    }

    withSubVerb(subVerb : Matcher) : SubCommandMatchBuilder {
        this.subVerb = subVerb;
        return this;
    }

    withSubObject(obj : Matcher) : SubCommandMatchBuilder {
        this.subObj = obj;
        return this;
    }

    withSubAttribute(subAttributeBuilder : SubAttributeMatchBuilder) : SubCommandMatchBuilder {
        this.subAttributeBuilder = subAttributeBuilder;
        return this;
    }

    withSubModifier(modifier : Matcher) : SubCommandMatchBuilder {
        this.subModifiers.push(modifier);
        return this;
    }

    build() : Matcher {
        if (!this.attribute) {
            throw new Error("Sub-command matcher must have an attribute");
        }
        if (!this.subVerb) {
            throw new Error("Sub-command matcher must have a sub-verb");
        }
        const attrMatcher = this.attribute;
        const subVerbMatcher = this.subVerb;
        const subObjMatcher = this.subObj ?? failIfProvided("subObject");
        const subAttrMatcher = this.subAttributeBuilder?.build() ?? failIfProvided("subPreposition");
        const subModMatchers = this.subModifiers.length ? this.subModifiers : [matchNoSubModifiers()];
        const matchers : Matcher[] = [attrMatcher, subVerbMatcher, subObjMatcher, subAttrMatcher, ...subModMatchers];

        const matcher : Matcher = (command, objId) => matchAll(command, objId, ...matchers);
        matcher.toString = () => "[" + matchers.map(matcher => matcher.toString()).join(",") + "]";
        return matcher;
    }
}

/**
 * Matches the sub-command's own attribute, eg the "with spoon" in
 * "tell robot to stir soup with spoon". Mirrors AttributeMatchBuilder, one level down.
 */
class SubAttributeMatchBuilder {
    attribute? : Matcher;
    obj? : Matcher;

    withAttribute(attribute : Matcher) : SubAttributeMatchBuilder {
        this.attribute = attribute;
        return this;
    }

    withObject(obj : Matcher) : SubAttributeMatchBuilder {
        this.obj = obj;
        return this;
    }

    build() : Matcher {
        if (!this.attribute) {
            throw new Error("Sub-attribute matcher must have an attribute");
        }
        if (!this.obj) {
            throw new Error("Sub-attribute matcher must have an object");
        }
        const attrMatcher = this.attribute;
        const objMatcher = this.obj;
        const matcher : Matcher = (command, objId) => matchAll(command, objId, attrMatcher, objMatcher);
        matcher.toString = () => "[" + attrMatcher.toString() + "," + objMatcher.toString() + "]";
        return matcher;
    }
}

export const matchBuilder = () : MatchBuilder => new MatchBuilder();

export const attributeMatchBuilder = () => new AttributeMatchBuilder();

export const subCommandMatchBuilder = () => new SubCommandMatchBuilder();

export const subAttributeMatchBuilder = () => new SubAttributeMatchBuilder();

export const matchVerb = (matchStr : string) : Matcher => {
                        const matcher : Matcher = (command, objId) => {
                            const match = Boolean(command.getVerb(getId(matchStr, objId))); 
                            return match ? { isMatch : true, ...SCORE_EXACT } : FAILED_MATCH;
                        };
                        matcher.toString = () => "Verb: " + matchStr;
                        return matcher;
}

export const matchObject = (matchStr : string) : Matcher => {
                    const matcher : Matcher = (command, objId) => {
                        const match = Boolean(command.getDirectObject(getId(matchStr, objId))); 
                        return match ? { isMatch : true, ...SCORE_OBJ_EXACT } : FAILED_MATCH;
                    };
                    matcher.toString = () => "DirectObj: " + matchStr;
                    return matcher;
                }

export const matchIndirectObject = (matchStr : string) : Matcher =>  {
                    const matcher : Matcher = (command, objId) => {
                        const match = Boolean(command.getIndirectObject(getId(matchStr, objId)));
                        return match ? { isMatch : true, ...SCORE_OBJ_EXACT } : FAILED_MATCH;
                    }
                    matcher.toString = () => "IndirectObj: " + matchStr;
                    return matcher;
                }

export const matchAttribute = (matchStr : string) : Matcher => {
                    const matcher : Matcher = (command, _objId) => {
                        const match = Boolean(command.getPreposition(matchStr));
                        return match ? { isMatch : true, ...SCORE_EXACT } : FAILED_MATCH;
                    }
                    matcher.toString = () => "Attr: " + matchStr;
                    return matcher;
                }

export const matchModifier = (modType : string, modifier : string) : Matcher => {
                    const matcher : Matcher = (command, _objId) => {
                        const match = Boolean(command.getModifier(modType, modifier));
                        return match ? { isMatch : true, ...SCORE_EXACT } : FAILED_MATCH;
                    }
                    matcher.toString = () => "Modifier: " + modType + " = " + modifier;
                    return matcher;
                }

export const matchAnyModifier = (modValue : string) : Matcher => {
                    const matcher : Matcher = (command, _objId) => {
                        const match = Boolean(command.find(part => part.type === "modifier" && part.value === modValue));
                        return match ? { isMatch : true, ...SCORE_EXACT } : FAILED_MATCH;
                    }
                    matcher.toString = () => "Modifer: ANY = " + modValue;
                    return matcher;
                }

export const matchNoModifiers = () : Matcher => {
                    const matcher : Matcher = (command, _objId) => {
                        const match = command.getModifiers().length === 0;
                        return match ? { isMatch : true, ...SCORE_NO_MATCH } : FAILED_MATCH;
                    }
                    matcher.toString = () => "Modifiers: NONE";
                    return matcher;
                }

export const matchSubVerb = (matchStr : string) : Matcher => {
                    const matcher : Matcher = (command, objId) => {
                        const match = Boolean(command.getSubVerb(getId(matchStr, objId)));
                        return match ? { isMatch : true, ...SCORE_EXACT } : FAILED_MATCH;
                    };
                    matcher.toString = () => "SubVerb: " + matchStr;
                    return matcher;
                }

export const matchSubModifier = (modType : string, modifier : string) : Matcher => {
                    const matcher : Matcher = (command, _objId) => {
                        const match = Boolean(command.getSubModifier(modType, modifier));
                        return match ? { isMatch : true, ...SCORE_EXACT } : FAILED_MATCH;
                    }
                    matcher.toString = () => "SubModifier: " + modType + " = " + modifier;
                    return matcher;
                }

export const matchSubObject = (matchStr : string) : Matcher => {
                    const matcher : Matcher = (command, objId) => {
                        const match = Boolean(command.getSubObject(getId(matchStr, objId)));
                        return match ? { isMatch : true, ...SCORE_OBJ_EXACT } : FAILED_MATCH;
                    };
                    matcher.toString = () => "SubObj: " + matchStr;
                    return matcher;
                }

export const matchSubAttribute = (matchStr : string) : Matcher => {
                    const matcher : Matcher = (command, _objId) => {
                        const match = Boolean(command.getSubPreposition(matchStr));
                        return match ? { isMatch : true, ...SCORE_EXACT } : FAILED_MATCH;
                    }
                    matcher.toString = () => "SubAttr: " + matchStr;
                    return matcher;
                }

export const matchSubIndirectObject = (matchStr : string) : Matcher =>  {
                    const matcher : Matcher = (command, objId) => {
                        const match = Boolean(command.getSubIndirectObject(getId(matchStr, objId)));
                        return match ? { isMatch : true, ...SCORE_OBJ_EXACT } : FAILED_MATCH;
                    }
                    matcher.toString = () => "SubIndirectObj: " + matchStr;
                    return matcher;
                }

export const matchAnySubModifier = (modValue : string) : Matcher => {
                    const matcher : Matcher = (command, _objId) => {
                        const match = Boolean(command.find(part => part.type === "subModifier" && part.value === modValue));
                        return match ? { isMatch : true, ...SCORE_EXACT } : FAILED_MATCH;
                    }
                    matcher.toString = () => "SubModifier: ANY = " + modValue;
                    return matcher;
                }

export const matchNoSubModifiers = () : Matcher => {
                    const matcher : Matcher = (command, _objId) => {
                        const match = command.getSubModifiers().length === 0;
                        return match ? { isMatch : true, ...SCORE_NO_MATCH } : FAILED_MATCH;
                    }
                    matcher.toString = () => "SubModifiers: NONE";
                    return matcher;
                }

export const captureObject = (captureName : string) : Matcher => {
                    const matcher : Matcher = command => {
                        const directObject = command.getPoS("directObject");
                        return (directObject !== undefined)
                                        ? { isMatch : true, captures : { [captureName] : directObject.entity }, ...SCORE_WILDCARD}
                                        : FAILED_MATCH;
                    }
                    matcher.toString = () => "DirectObj: $" + captureName;
                    return matcher;
                }

export const captureIndirectObject = (captureName : string) : Matcher => {
                    const matcher : Matcher = command => {
                        const indirectObject = command.getPoS("indirectObject");
                        return (indirectObject !== undefined )
                                        ? { isMatch : true, captures : { [captureName] : indirectObject.entity }, ...SCORE_WILDCARD}
                                        : FAILED_MATCH;
                    }
                    matcher.toString = () => "IndirectObj: $" + captureName;
                    return matcher;
                }

export const captureModifier = (modType : string) : Matcher => {
                    const matcher : Matcher = command => {
                        const modifiers = command.getModifiers()
                                                .filter(modifier => modifier.modType == modType);
                        return (modifiers.length)
                                    ? { isMatch : true, captures : { [modType] : modifiers[0].value }, ...SCORE_WILDCARD} // TODO what if >1 modifiers?
                                    : FAILED_MATCH;
                    }
                    matcher.toString = () => "ModifierType: $" + modType
                    return matcher;
                }

export const captureSubVerb = (captureName : string) : Matcher => {
                    const matcher : Matcher = command => {
                        const subVerb = command.getPoS("subVerb");
                        return (subVerb !== undefined)
                                        ? { isMatch : true, captures : { [captureName] : subVerb.verb }, ...SCORE_WILDCARD}
                                        : FAILED_MATCH;
                    }
                    matcher.toString = () => "SubVerb: $" + captureName;
                    return matcher;
                }

export const captureSubObject = (captureName : string) : Matcher => {
                    const matcher : Matcher = command => {
                        const subObject = command.getPoS("subObject");
                        return (subObject !== undefined)
                                        ? { isMatch : true, captures : { [captureName] : subObject.entity }, ...SCORE_WILDCARD}
                                        : FAILED_MATCH;
                    }
                    matcher.toString = () => "SubObj: $" + captureName;
                    return matcher;
                }

export const captureSubIndirectObject = (captureName : string) : Matcher => {
                    const matcher : Matcher = command => {
                        const subIndirectObject = command.getPoS("subIndirectObject");
                        return (subIndirectObject !== undefined)
                                        ? { isMatch : true, captures : { [captureName] : subIndirectObject.entity }, ...SCORE_WILDCARD}
                                        : FAILED_MATCH;
                    }
                    matcher.toString = () => "SubIndirectObj: $" + captureName;
                    return matcher;
                }

export const captureSubModifier = (modType : string) : Matcher => {
                    const matcher : Matcher = command => {
                        const modifiers = command.getSubModifiers()
                                                .filter(modifier => modifier.modType == modType);
                        return (modifiers.length)
                                    ? { isMatch : true, captures : { [modType] : modifiers[0].value }, ...SCORE_WILDCARD}
                                    : FAILED_MATCH;
                    }
                    matcher.toString = () => "SubModifierType: $" + modType
                    return matcher;
                }

const matchAll : (command : Command, objId : string, ...matchers : Matcher[]) => MatchResult = 
    (command, objId, ...matchers) => combineMatches(...matchers.map(matcher => matcher(command, objId)));


const combineMatches : (...matches : MatchResult[]) => MatchResult =
    (...matches) => matches.reduce((result1, result2) => ({
        isMatch : result1.isMatch && result2.isMatch,
        captures : {
            ...(result1?.captures ?? {}),
            ...(result2?.captures ?? {})
        },
        score : result1.score + result2.score
    }));


const getId : (matchStr : string, objId : string) => string = (matchStr, objId) => matchStr === "this" ? objId : matchStr;