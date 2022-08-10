import { CallExpression, Expression, Identifier, MemberExpression } from "jsep"
import { SearchState } from "../commandsearch";
import { verbMatchBuilder, matchVerb, matchObject, captureObject, 
            matchAttribute, matchIndirectObject, captureIndirectObject,
            MatchResult, Matcher, ALWAYS_FAIL, attributeMatchBuilder } from "../commandmatcher";
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
            let unitMatch = getMatcher(matchExpr as Identifier);
            compoundMatch = { nameMatch : unitMatch, argMatches : []};
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
    // The state helps define what the match possibilities are, eg
    //    a transitive verb should always have a direct object
    // We could possibly not bother with the intermediate data structure here
    //    but this makes the code a bit clearer, and handled captures in a nicer way
    return (state : SearchState) =>  {
        const builder = verbMatchBuilder();
        if (!state.verb) {
            throw new Error("No verb");
        }
        builder.withVerb(matchVerb(compoundMatch.nameMatch.name))
        if (state.verb.isTransitive()) {
            // First match will be the direct object
            if (compoundMatch.argMatches.length) {
                builder.withObject(getObjectMatcher(compoundMatch.argMatches[0]));
            } else {
                // Transitive verb without object will always fail
                builder.withObject(ALWAYS_FAIL);
            }
            // Could just chomp the head of the list, then process everything else as modifiers
        } else {
            // Match modifiers
            if (compoundMatch.argMatches.length) {
                throw new Error("Modifier matching not implelemented yet"); // TODO
            }
        }
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
    // Callee here could be the member expression
    let name : UnitMatch;
    let parent : CompoundMatch | undefined;
    switch(callExpression.callee.type) {
        case "Identifier":
            name = getMatcher(callExpression.callee as Identifier);
            break;
        case "MemberExpression":
            const memberExpr = callExpression.callee as MemberExpression;
            name = getMatcher(memberExpr.property as Identifier); // FIXME check type
            parent = getCompoundMatcher(memberExpr.object as CallExpression); // FIXME check type
            break;
        default:
            throw new Error("Invalid match expression: " + callExpression);
    }
    //const verb = getMatcher(callExpression.callee as Identifier);
    const argMatchers = callExpression.arguments.map(expr => getMatcher(expr as Identifier));  // FIXME, might not be identifier
    const compoundMatcher = {nameMatch : name, argMatches : argMatchers};
    if (parent !== undefined) {
        parent.member = compoundMatcher;
    }

    return parent ? parent : compoundMatcher;
    //return {nameMatch: name, argMatches : argMatchers};
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
