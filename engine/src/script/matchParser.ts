import { CallExpression, Expression, Identifier, MemberExpression } from "jsep"
import { SearchState } from "../commandsearch";
import { verbMatchBuilder, matchVerb, matchObject, captureObject, 
            matchAttribute, matchIndirectObject, captureIndirectObject,
            Matcher, ALWAYS_FAIL, attributeMatchBuilder,
            matchModifier } from "../commandmatcher";
import { mkThunk, Thunk, EnvFn } from "./thunk"
import { mkResult } from "./parser"

interface UnitMatch {
    isCapture : boolean,
    name : string
}

// match name(args1, arg2).memberMatch(...)
interface CompoundMatch {
    nameMatch : UnitMatch,
    argMatches : UnitMatch[],
    member? : CompoundMatch
}

export function evaluateMatch(matchExpr : Expression, onMatch : Thunk) : Thunk {
    let compoundMatch : CompoundMatch;
    switch(matchExpr.type) {
        case "CallExpression":
            compoundMatch = getCompoundMatcher(matchExpr as CallExpression);
            break;
        case "Identifier": 
            compoundMatch = { 
                nameMatch : getMatcher(matchExpr as Identifier),
                argMatches : []};
            break;
        default:
            throw new Error("Invalid match expression: " + matchExpr);
    }
    
    //const compoundMatch = getCompoundMatcher(matchExpr);

    const matcher = createMatcher(compoundMatch);


    // This is going to return a thunk, so how should it work?
    // 1. put state in the env
    // 2. call the matcher, based on the state
    // 3. put captures into th env
    // 4. execute onMatch

    const envfn : EnvFn = env => {
        const searchState = env.get("SEARCHSTATE") as SearchState;
        const matchResult = matcher(searchState);
        return matchResult.isMatch
                    ? onMatch.resolve(env.newChild(matchResult.captures))
                    : mkResult(undefined, {});
    }

    return mkThunk(matchExpr, envfn);
}

function createMatcher(compoundMatch : CompoundMatch) : Matcher {
    // We build a matcher here, using the provided state
    // The state helps define what the match possbilities are, eg
    //    a transitive verb should always have a direct object
    // We could possibly not bother with the intermediate data structure here
    //    but this makes the code a bit clearer, and handled captures in a nicer way
    return (state : SearchState) =>  {
        const builder = verbMatchBuilder();
        if (!state.verb) {
            throw new Error("No verb");
        }
        builder.withVerb(matchVerb(compoundMatch.nameMatch.name))

        const args = compoundMatch.argMatches.slice().reverse(); // Reverse list so we can use pop 
        if (state.verb.isTransitive()) {
            // First match will be the direct object
            const directObject = args.pop();
            builder.withObject(directObject ? getObjectMatcher(directObject) : ALWAYS_FAIL);
        } 

        // Treat any remaining args as modifiers
        args.forEach(arg => builder.withModifier(getModifierMatcher(arg)));


        if (compoundMatch.member) {
            const attrBuilder = attributeMatchBuilder();
            attrBuilder.withAttribute(matchAttribute(compoundMatch.member.nameMatch.name));
            if (compoundMatch.member.argMatches.length) {
                attrBuilder.withObject(getIndirectObjectMatcher(compoundMatch.member.argMatches[0]))
            } else {
                attrBuilder.withObject(ALWAYS_FAIL);
            }
            builder.withAttribute(attrBuilder);
        }
        const matcher = builder.build();
    
        return matcher(state);
    }
}

function getMatcher(identifier : Identifier) : UnitMatch {
    return isCapture(identifier.name) 
                ? { isCapture : true, name : identifier.name.slice(1) }
                : { isCapture : false, name : identifier.name }
}

function getCompoundMatcher(callExpression : CallExpression) : CompoundMatch {
    let name : UnitMatch;
    let parent : CompoundMatch | undefined;
    switch(callExpression.callee.type) {
        case "Identifier":
            name = getMatcher(callExpression.callee as Identifier);
            break;
        case "MemberExpression":
            [name, parent] = getParentMatcher(callExpression.callee as MemberExpression);
            break;
        default:
            throw new Error("Invalid match expression: " + callExpression);
    }
    const argMatchers = callExpression.arguments.map(expr => getMatcher(expr as Identifier));  // FIXME, might not be identifier
    const compoundMatcher = {nameMatch : name, argMatches : argMatchers};
    if (parent !== undefined) {
        parent.member = compoundMatcher;
    }
    return parent ?? compoundMatcher;
}

function getParentMatcher(expression : MemberExpression) : [UnitMatch, CompoundMatch] {
    if (expression.property.type !== "Identifier") {
        throw new Error("Invalid attribute match: " + JSON.stringify(expression.property));
    }
    if (expression.object.type !== "CallExpression") {
        throw new Error("Invalid attributed expression match: " + JSON.stringify(expression.object));
    }
    return [getMatcher(expression.property as Identifier), 
            getCompoundMatcher(expression.object as CallExpression)];
}

const isCapture : (str : string) => boolean = str => str.startsWith("$");

const  getObjectMatcher : (matchData : UnitMatch) => Matcher = 
            matchData => matchData.isCapture 
                                ? captureObject(matchData.name)
                                : matchObject(matchData.name);

const  getIndirectObjectMatcher : (matchData : UnitMatch) => Matcher = 
            matchData => matchData.isCapture 
                                ? captureIndirectObject(matchData.name)
                                : matchIndirectObject(matchData.name);

const getModifierMatcher : (match : UnitMatch) => Matcher = 
            matchData => matchModifier(matchData.name);
