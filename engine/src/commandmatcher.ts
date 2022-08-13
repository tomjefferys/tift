import { SearchState } from "./commandsearch";

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


export type Matcher = (state : SearchState) => MatchResult;

export interface MatchResult {
    isMatch : boolean,
    captures? : {[key:string]:string}
}

const FAILED_MATCH : MatchResult = { isMatch : false };

export const ALWAYS_FAIL : Matcher = (_state) => FAILED_MATCH;

function failIfProvided(stateField : keyof SearchState) : Matcher {
    return state => ({ isMatch : state[stateField] === undefined})
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

        const attributeMatcher = this?.attributeBuilder?.build() ?? failIfProvided("attribute");
        const objMatcher = this?.obj ?? failIfProvided("directObject");
        const verbMatcher = this?.verb ?? failIfProvided("verb");
        const modMatchers = this.modifiers.length ? this.modifiers : [matchNoModifiers()];
        const matchers : Matcher[] = [verbMatcher, objMatcher, attributeMatcher, ...modMatchers];

        return state => matchAll(state, ...matchers);
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
                        state => ({ isMatch : state.verb?.id === verbId });

export const matchObject = (objectId : string) : Matcher => 
                    state => ({ isMatch : state.directObject?.id === objectId });

export const matchIndirectObject = (objectId : string) : Matcher => 
                    state => ({ isMatch : state.indirectObject?.id === objectId });

export const matchAttribute = (attribute : string) : Matcher =>
                    state => ({ isMatch : state.attribute === attribute});

export const matchModifier = (modifier : string) : Matcher =>
                    state => ({ isMatch : Object.values(state.modifiers).indexOf(modifier) !== -1})

export const matchNoModifiers = () : Matcher => 
                    state => ({ isMatch : Object.keys(state.modifiers).length === 0})

export const captureObject = (captureName : string) : Matcher => 
        state => (state.directObject !== undefined)
                            ? { isMatch : true, captures : { [captureName] : state.directObject?.id}}
                            : FAILED_MATCH;

export const captureIndirectObject = (captureName : string) : Matcher => 
        state => (state.indirectObject !== undefined)
                            ? { isMatch : true, captures : { [captureName] : state.indirectObject?.id}}
                            : FAILED_MATCH;

const matchAll : (state : SearchState, ...matchers : Matcher[]) => MatchResult = 
    (state, ...matchers) => combineMatches(...matchers.map(matcher => matcher(state)));


const combineMatches : (...matches : MatchResult[]) => MatchResult =
    (...matches) => matches.reduce((result1, result2) => ({
        isMatch : result1.isMatch && result2.isMatch,
        captures : {
            ...(result1?.captures ?? {}),
            ...(result2?.captures ?? {})
        } 
    }));