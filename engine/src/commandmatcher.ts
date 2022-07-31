import { ContextEntities, SearchState } from "./commandsearch";
import { Verb } from "./verb";
import { Entity } from "./entity"
import { IdValue } from "./shared"
import * as multidict from "./util/multidict"
import { VerbMap } from "./types"
import * as Tree from "./util/tree"
import { states } from "moo";

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

type MatchFunction = (state : SearchState) => MatchResult;


interface MatchResult {
    isMatch : boolean,
    captures? : {[key:string]:string}
}

const FAILED_MATCH : MatchResult = { isMatch : false };

interface Matcher {
    match : (state : SearchState) => MatchResult
}

const ALWAYS_MATCH : Matcher = {
    match : (_state) => ({ isMatch : true})
}

function failIfProvided(stateField : keyof SearchState) : Matcher {
    return {
        match : state => ({ isMatch : state[stateField] === undefined})
    }
}

interface VerbMatch extends Matcher {
    verb : string,
    obj? : ObjectMatch,
    attribute? : AttributeMatch,
    modifiers : ModifierMatch[]
}

interface AttributeMatch extends Matcher {
    attribute : string;
    obj? : ObjectMatch,
    modifiers : ModifierMatch[]
}

type ObjectMatch = ObjectExact | ObjectCapture

interface ObjectExact extends Matcher {
    isCapture : false,
    id : string
}

interface ObjectCapture extends Matcher {
    isCapture : true,
    name : string
}

type ModifierMatch = ModifierExact | ModifierCapture;

interface ModifierExact extends Matcher {
    isCapture : false,
    type : string,
    modifier : string
}

interface ModifierCapture extends Matcher {
    isCapture : true,
    type : string,
    name : string
}

class MatchBuilder {
    verb? : string;
    obj? : ObjectMatch;
    attributeBuilder? : AttributeMatchBuilder;
    modifiers : ModifierMatch[] = [];

    withVerb(verb : string) : MatchBuilder {
        this.verb = verb
        return this;
    }

    withObject(obj : ObjectMatch) : MatchBuilder {
        this.obj = obj;
        return this;
    }
    
    withAttribute(attributeBuilder : AttributeMatchBuilder) : MatchBuilder {
        this.attributeBuilder = attributeBuilder;
        return this;
    }

    withModifier(modifier : ModifierMatch) : MatchBuilder {
        this.modifiers.push(modifier);
        return this;
    }

    build() : VerbMatch {
        if (!this.verb) {
            throw new Error("A verb mus be supplied to a match builder");
        }

        const attributeMatcher = this?.attributeBuilder?.build() ?? failIfProvided("attribute");
        const objMatcher = this?.obj ?? failIfProvided("directObject");
        const verbMatcher : Matcher = buildMatcher(state => state.verb?.id === this.verb);
        const matchers : Matcher[] = [verbMatcher, objMatcher, attributeMatcher, ...this.modifiers];

        return {
            verb : this.verb,
            obj : this.obj,
            attribute : this.attributeBuilder?.build(),
            modifiers : this.modifiers,
            match : state => matchAll(state, ...matchers)
        }
    }
}

class AttributeMatchBuilder {
    attribute : string;
    obj? : ObjectMatch;
    modifiers : ModifierMatch[] = [];

    constructor(attribute : string) {
        this.attribute = attribute;
    }

    withObject(obj : ObjectMatch) : AttributeMatchBuilder {
        this.obj = obj;
        return this;
    }

    withModifier(modifier : ModifierMatch) : AttributeMatchBuilder {
        this.modifiers.push(modifier);
        return this;
    }

    build() : AttributeMatch {
        const attributeMatcher = buildMatcher(state => state.attribute === this.attribute);
        return {
            attribute : this.attribute,
            obj : this.obj,
            modifiers : this.modifiers,
            match : state => FAILED_MATCH
        }
    }
}

export function verbMatchBuilder() {
    return new MatchBuilder();
}

export function matchObject(objectId : string) : ObjectMatch {
    return { 
        isCapture : false, 
        id : objectId,
        match : state => ({
            isMatch : state.directObject?.id === objectId,
        })
    }
}

export function captureObject(captureName : string) : ObjectMatch {
    return {
        isCapture : true,
        name : captureName,
        match : state => (state.directObject !== undefined)
                            ? { isMatch : true, captures : { [captureName] : state.directObject?.id}}
                            : FAILED_MATCH
    }
}

const matchAll : (state : SearchState, ...matchers : Matcher[]) => MatchResult = 
    (state, ...matchers) => combineMatches(...matchers.map(matcher => matcher.match(state)));


const combineMatches : (...matches : MatchResult[]) => MatchResult =
    (...matches) => matches.reduce((result1, result2) => ({
        isMatch : result1.isMatch && result2.isMatch,
        captures : {
            ...(result1?.captures ?? {}),
            ...(result2?.captures ?? {})
        } 
    }));

const buildMatcher : (matchFunction : (state : SearchState) => boolean) => Matcher
        = matchFunction => ({ match : state => ({ isMatch : matchFunction(state) })});