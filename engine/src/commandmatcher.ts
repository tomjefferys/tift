import { Command } from "./command";
import { PoSType } from "tift-types/src/messages/word";
import { Obj } from "tift-types/src/util/objects"

// verb                                -- intranitive verb
// verb object                         -- transitive verb
// verb object (with) object           -- transitive verb with attribute
// verb direction                      -- intransitive verb with qualifier
// verb object (to) direction          -- tranistive verb with qualifier
// verb object direction (with) object -- transitive verb with qual and attr

// verb(directObj).attribute(indirectObj).modifier().modifier()
// why not just [verb, directObj, attribute, indirectObj, modifier, modifier]
//  because it doesn't make sense to capture verbs, and verb attributes.  We probably do want to capture modifiers
// verb(directObj, modifiers...).attribute(indirectObj, modifiers...)

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

    withModifier(modifier : Matcher) : MatchBuilder {
        this.modifiers.push(modifier);
        return this;
    }

    build() : Matcher {
        if (!this.verb) {
            throw new Error("A verb must be supplied to a match builder");
        }

        const attributeMatcher = this?.attributeBuilder?.build() ?? failIfProvided("preposition");
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

export const matchBuilder = () : MatchBuilder => new MatchBuilder();

export const attributeMatchBuilder = () => new AttributeMatchBuilder();

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