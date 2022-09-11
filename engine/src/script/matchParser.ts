import { CallExpression, Expression, Identifier, MemberExpression } from "jsep"
import { matchBuilder, matchVerb, matchObject, captureObject, 
            matchAttribute, matchIndirectObject, captureIndirectObject,
            Matcher, ALWAYS_FAIL, attributeMatchBuilder,
            matchAnyModifier} from "../commandmatcher";
import { isTransitive } from "../verb";

export const COMMAND = Symbol("__COMMAND__");

interface UnitMatch {
    isCapture : boolean,
    name : string,
}

// match name(args1, arg2).memberMatch(...)
interface CompoundMatch {
    nameMatch : UnitMatch,
    argMatches : UnitMatch[],
    member? : CompoundMatch
}

export function evalutateMatchExpression(matchExpr : Expression) : Matcher {
    let compoundMatch : CompoundMatch;
    switch(matchExpr.type) {
        case "CallExpression":
            compoundMatch = getCompoundMatcher(matchExpr as CallExpression);
            break;
        case "Identifier": 
            compoundMatch = { 
                nameMatch : getMatcher((matchExpr as Identifier).name),
                argMatches : []};
            break;
        case "ThisExpression":
            compoundMatch = { 
                nameMatch : getMatcher("this"),
                argMatches : []};
            break;
        default:
            throw new Error("Invalid match expression: " + matchExpr);
    }

    return createMatcher(compoundMatch);
}

function createMatcher(compoundMatch : CompoundMatch) : Matcher {
    // We build a matcher here, using the provided state
    // The state helps define what the match possbilities are, eg
    //    a transitive verb should always have a direct object
    // We could possibly not bother with the intermediate data structure here
    //    but this makes the code a bit clearer, and handled captures in a nicer way
    const matcher : Matcher = (command, objId) =>  {
        // Builder dynamically created depending on verb type being matched
        // ie need to distinguish between push(gently) and push(box, gently)
        const builder = matchBuilder();
        const verb = command.getPoS("verb")?.verb;
        if (!verb) {
            throw new Error("No verb");
        }
        builder.withVerb(matchVerb(compoundMatch.nameMatch.name))

        const args = compoundMatch.argMatches.slice().reverse(); // Reverse list so we can use pop 
        if (isTransitive(verb)) {
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
        return matcher(command, objId);
    }
    // Create a toString based on the compound match
    matcher.toString = () => getCompoundMatchString(compoundMatch);
    return matcher;
}

function getCompoundMatchString(compoundMatch : CompoundMatch) : string {
    return getUnitMatchString(compoundMatch.nameMatch) 
                    + "(" + compoundMatch.argMatches.map(match => getUnitMatchString(match)).join(", ") + ")"
                    + ((compoundMatch.member != undefined)? "." + getCompoundMatchString(compoundMatch.member) : "");
}

function getUnitMatchString(unitMatch : UnitMatch) : string {
    return (unitMatch.isCapture ? "$" : "") + unitMatch.name;
}

function getMatcher(identifier : string) : UnitMatch {
    return isCapture(identifier) 
                ? { isCapture : true, name : identifier.slice(1) }
                : { isCapture : false, name : identifier }
}

/**
 * gets a matcher for (paremnt).name(args...)
 * @param callExpression
 * @returns 
 */
function getCompoundMatcher(callExpression : CallExpression) : CompoundMatch {
    let name : UnitMatch;
    let parent : CompoundMatch | undefined;
    switch(callExpression.callee.type) {
        case "Identifier":
            name = getMatcher((callExpression.callee as Identifier).name);
            break;
        case "ThisExpression":
            name = getMatcher("this");
            break;
        case "MemberExpression":
            [name, parent] = getParentMatcher(callExpression.callee as MemberExpression);
            break;
        default:
            throw new Error("Invalid match expression: " + callExpression);
    }
    const argMatchers = callExpression.arguments.map(expr => getArgumentMatcher(expr));
    const compoundMatcher = {nameMatch : name, argMatches : argMatchers};
    if (parent !== undefined) {
        parent.member = compoundMatcher;
    }
    return parent ?? compoundMatcher;
}

function getArgumentMatcher(expression : Expression) : UnitMatch {
    let matcher : UnitMatch;
    switch(expression.type) {
        case "Identifier":
            matcher = getMatcher((expression as Identifier).name);
            break;
        case "ThisExpression":
            matcher = getMatcher("this");
            break;
        default:
            throw new Error("Invalid argument matcher: " + expression);
    }
    return matcher;
}

function getParentMatcher(expression : MemberExpression) : [UnitMatch, CompoundMatch] {
    if (expression.property.type !== "Identifier") {
        throw new Error("Invalid attribute match: " + JSON.stringify(expression.property));
    }
    if (expression.object.type !== "CallExpression") {
        throw new Error("Invalid attributed expression match: " + JSON.stringify(expression.object));
    }
    return [getMatcher((expression.property as Identifier).name), 
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
            matchData => matchAnyModifier(matchData.name);
