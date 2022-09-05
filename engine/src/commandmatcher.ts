import { Command, PoSType } from "./command";

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


export type Matcher = (command : Command) => MatchResult;

export interface MatchResult {
    isMatch : boolean,
    score : number,
    captures? : {[key:string]:string}
}

const FAILED_MATCH : MatchResult = { isMatch : false, ...SCORE_NO_MATCH };

export const ALWAYS_FAIL : Matcher = (_state) => FAILED_MATCH;

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

        return command => matchAll(command, ...matchers);
    }
}


class AttributeMatchBuilder {
    attribute? : Matcher;
    obj? : Matcher;
    modifiers : Matcher[] = [];

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
        return state => matchAll(state, attrMatcher, objMatcher);
    }
}

export const matchBuilder = () : MatchBuilder => new MatchBuilder();

export const attributeMatchBuilder = () => new AttributeMatchBuilder();

export const matchVerb = (verbId : string) : Matcher => 
                        command => {
                            const match = Boolean(command.getVerb(verbId)); 
                            return match ? { isMatch : true, ...SCORE_EXACT } : FAILED_MATCH;
                        };

export const matchObject = (objectId : string) : Matcher => 
                    command => {
                        const match = Boolean(command.getDirectObject(objectId)); 
                        return match ? { isMatch : true, ...SCORE_OBJ_EXACT } : FAILED_MATCH;
                    };

export const matchIndirectObject = (objectId : string) : Matcher => 
                    command => {
                        const match = Boolean(command.getIndirectObject(objectId));
                        return match ? { isMatch : true, ...SCORE_OBJ_EXACT } : FAILED_MATCH;
                    }

export const matchAttribute = (attribute : string) : Matcher =>
                    command => {
                        const match = Boolean(command.getPreposition(attribute));
                        return match ? { isMatch : true, ...SCORE_EXACT } : FAILED_MATCH;
                    }

export const matchModifier = (modType : string, modifier : string) : Matcher =>
                    command => {
                        const match = Boolean(command.getModifier(modType, modifier));
                        return match ? { isMatch : true, ...SCORE_EXACT } : FAILED_MATCH;
                    }

export const matchAnyModifier = (modValue : string) : Matcher => 
                    command => {
                        const match = Boolean(command.find(part => part.type === "modifier" && part.value === modValue));
                        return match ? { isMatch : true, ...SCORE_EXACT } : FAILED_MATCH;
                    }

export const matchNoModifiers = () : Matcher => 
                    command => {
                        const match = command.getModifiers().length === 0;
                        return match ? { isMatch : true, ...SCORE_NO_MATCH } : FAILED_MATCH;
                    }

export const captureObject = (captureName : string) : Matcher => 
        command => {
            const directObject = command.getPoS("directObject");
            return (directObject !== undefined)
                            ? { isMatch : true, captures : { [captureName] : directObject.entity.id }, ...SCORE_WILDCARD}
                            : FAILED_MATCH;
        }

export const captureIndirectObject = (captureName : string) : Matcher =>
        command => {
            const indirectObject = command.getPoS("indirectObject");
            return (indirectObject !== undefined )
                            ? { isMatch : true, captures : { [captureName] : indirectObject.entity.id }, ...SCORE_WILDCARD}
                            : FAILED_MATCH;
        }

export const captureModifier = (modType : string) : Matcher => 
        command => {
            const modifiers = command.getModifiers()
                                    .filter(modifier => modifier.modType == modType);
            return (modifiers.length)
                        ? { isMatch : true, captures : { [modType] : modifiers[0].value }, ...SCORE_WILDCARD} // TODO what if >1 modifiers?
                        : FAILED_MATCH;
        }

const matchAll : (command : Command, ...matchers : Matcher[]) => MatchResult = 
    (state, ...matchers) => combineMatches(...matchers.map(matcher => matcher(state)));


const combineMatches : (...matches : MatchResult[]) => MatchResult =
    (...matches) => matches.reduce((result1, result2) => ({
        isMatch : result1.isMatch && result2.isMatch,
        captures : {
            ...(result1?.captures ?? {}),
            ...(result2?.captures ?? {})
        },
        score : result1.score + result2.score
    }));