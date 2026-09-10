import { CallExpression, Expression, Identifier, MemberExpression } from "jsep"
import { matchBuilder, matchVerb, matchObject, captureObject,
            matchAttribute, matchIndirectObject, captureIndirectObject,
            Matcher, ALWAYS_FAIL, attributeMatchBuilder,
            matchAnyModifier,
            captureModifier,
            subCommandMatchBuilder, matchSubVerb, captureSubVerb,
            matchSubObject, captureSubObject,
            matchAnySubModifier, captureSubModifier,
            subAttributeMatchBuilder, matchSubAttribute,
            matchSubIndirectObject, captureSubIndirectObject} from "../commandmatcher";
import { isTransitive, isClausal } from "../verb";
import { Command } from "../command";

export const COMMAND = Symbol("__COMMAND__");

interface UnitMatch {
    isCapture : boolean,
    name : string,
}

// match name(args1, arg2).memberMatch(...)
interface CompoundMatch {
    nameMatch : UnitMatch,
    argMatches : ArgMatch[],
    member? : CompoundMatch
}

// An argument is either a simple value (UnitMatch) or, for a clausal verb's attribute,
// a whole nested command (CompoundMatch) - eg the "go(north)" in "tell(this).to(go(north))".
type ArgMatch = UnitMatch | CompoundMatch;

function isCompoundMatch(arg : ArgMatch) : arg is CompoundMatch {
    return "nameMatch" in arg;
}

// Promotes a bare UnitMatch to the equivalent zero-arg CompoundMatch, eg "wait" is
// equivalent to "wait()" when used as a clausal verb's sub-command.
function toCompoundMatch(arg : ArgMatch) : CompoundMatch {
    return isCompoundMatch(arg) ? arg : { nameMatch : arg, argMatches : [] };
}

function asUnitMatch(arg : ArgMatch) : UnitMatch {
    if (isCompoundMatch(arg)) {
        throw new Error("Expected a simple value here, but found a nested command: " + getCompoundMatchString(arg));
    }
    return arg;
}

export function evaluateMatchExpression(matchExpr : Expression) : Matcher {
    return createMatcher(parseCompoundMatch(matchExpr));
}

function parseCompoundMatch(expr : Expression) : CompoundMatch {
    switch(expr.type) {
        case "CallExpression":
            return getCompoundMatcher(expr as CallExpression);
        case "Identifier":
            return { nameMatch : getMatcher((expr as Identifier).name), argMatches : [] };
        case "ThisExpression":
            return { nameMatch : getMatcher("this"), argMatches : [] };
        default:
            throw new Error("Invalid match expression: " + expr);
    }
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
        // Check the verb actually named by this pattern matches the command's verb before doing
        // anything else - isTransitive/isClausal below need the pattern's own verb (eg "tell"),
        // not whatever verb the currently-tested command happens to have (eg "look"), which would
        // otherwise misinterpret this pattern's arguments/member using the wrong verb's shape.
        const verbMatcher = matchVerb(compoundMatch.nameMatch.name);
        const verbResult = verbMatcher(command, objId);
        if (!verbResult.isMatch) {
            return verbResult;
        }
        builder.withVerb(verbMatcher)

        const args = compoundMatch.argMatches.slice().reverse(); // Reverse list so we can use pop
        if (isTransitive(verb)) {
            // First match will be the direct object
            const directObject = args.pop();
            builder.withObject(directObject ? getObjectMatcher(asUnitMatch(directObject)) : ALWAYS_FAIL);
        }

        // Treat any remaining args as modifiers
        args.forEach(arg => builder.withModifier(getModifierMatcher(asUnitMatch(arg))));


        if (compoundMatch.member) {
            if (isClausal(verb)) {
                builder.withSubCommand(getSubCommandMatcher(compoundMatch.member, command));
            } else {
                const attrBuilder = attributeMatchBuilder();
                attrBuilder.withAttribute(matchAttribute(compoundMatch.member.nameMatch.name));
                if (compoundMatch.member.argMatches.length) {
                    attrBuilder.withObject(getIndirectObjectMatcher(asUnitMatch(compoundMatch.member.argMatches[0])))
                } else {
                    attrBuilder.withObject(ALWAYS_FAIL);
                }
                builder.withAttribute(attrBuilder);
            }
        }
        const matcher = builder.build();
        return matcher(command, objId);
    }
    // Create a toString based on the compound match
    matcher.toString = () => getCompoundMatchString(compoundMatch);
    return matcher;
}

/**
 * Builds a matcher for the sub-command of a clausal verb (eg "tell"), from the single
 * nested command that is its attribute's argument - eg the "go(north)" in
 * "tell(this).to(go(north))", or "stir(soup).with(spoon)" in "tell(this).to(stir(soup).with(spoon))".
 * The nested command is matched exactly like a top-level command would be by createMatcher
 * above (verb/object/modifiers/attribute), just one level down - a bare identifier with no
 * args (eg "wait") is equivalent to an empty call ("wait()"), the same as at the top level.
 * @param member the parsed ".attribute(subCommand)" member match, eg "to(go(north))"
 * @param command the command being matched against
 * @returns
 */
function getSubCommandMatcher(member : CompoundMatch, command : Command) {
    if (member.argMatches.length !== 1) {
        throw new Error(`Clausal verb attribute "${member.nameMatch.name}" must take a single sub-command, `
            + `eg ${member.nameMatch.name}(go(north))`);
    }
    const subCompoundMatch = toCompoundMatch(member.argMatches[0]);

    const subCommandBuilder = subCommandMatchBuilder();
    subCommandBuilder.withAttribute(matchAttribute(member.nameMatch.name));
    subCommandBuilder.withSubVerb(getSubVerbMatcher(subCompoundMatch.nameMatch));

    const subArgs = subCompoundMatch.argMatches.slice().reverse(); // Reverse list so we can use pop
    const subVerb = command.getPoS("subVerb")?.verb;
    if (subVerb && isTransitive(subVerb)) {
        // First match will be the sub-command's direct object
        const subObjectArg = subArgs.pop();
        subCommandBuilder.withSubObject(subObjectArg ? getSubObjectMatcher(asUnitMatch(subObjectArg)) : ALWAYS_FAIL);
    }

    // Treat any remaining args as sub-command modifiers
    subArgs.forEach(arg => subCommandBuilder.withSubModifier(getSubModifierMatcher(asUnitMatch(arg))));

    // A member on the nested command is its own attribute, eg the ".with(spoon)" in
    // "stir(soup).with(spoon)"
    if (subCompoundMatch.member) {
        const subAttrBuilder = subAttributeMatchBuilder();
        subAttrBuilder.withAttribute(matchSubAttribute(subCompoundMatch.member.nameMatch.name));
        if (subCompoundMatch.member.argMatches.length) {
            subAttrBuilder.withObject(getSubIndirectObjectMatcher(asUnitMatch(subCompoundMatch.member.argMatches[0])))
        } else {
            subAttrBuilder.withObject(ALWAYS_FAIL);
        }
        subCommandBuilder.withSubAttribute(subAttrBuilder);
    }

    return subCommandBuilder;
}

function getCompoundMatchString(compoundMatch : CompoundMatch) : string {
    return getUnitMatchString(compoundMatch.nameMatch)
                    + "(" + compoundMatch.argMatches.map(getArgMatchString).join(", ") + ")"
                    + ((compoundMatch.member != undefined)? "." + getCompoundMatchString(compoundMatch.member) : "");
}

function getArgMatchString(arg : ArgMatch) : string {
    return isCompoundMatch(arg) ? getCompoundMatchString(arg) : getUnitMatchString(arg);
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

function getArgumentMatcher(expression : Expression) : ArgMatch {
    switch(expression.type) {
        case "Identifier":
            return getMatcher((expression as Identifier).name);
        case "ThisExpression":
            return getMatcher("this");
        case "CallExpression":
            // A nested command, eg the "go(north)" in "tell(this).to(go(north))"
            return getCompoundMatcher(expression as CallExpression);
        default:
            throw new Error("Invalid argument matcher: " + expression);
    }
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
            matchData => matchData.isCapture
                            ? captureModifier(matchData.name)
                            : matchAnyModifier(matchData.name);

const getSubVerbMatcher : (matchData : UnitMatch) => Matcher =
            matchData => matchData.isCapture
                                ? captureSubVerb(matchData.name)
                                : matchSubVerb(matchData.name);

const getSubObjectMatcher : (matchData : UnitMatch) => Matcher =
            matchData => matchData.isCapture
                                ? captureSubObject(matchData.name)
                                : matchSubObject(matchData.name);

const getSubModifierMatcher : (match : UnitMatch) => Matcher =
            matchData => matchData.isCapture
                            ? captureSubModifier(matchData.name)
                            : matchAnySubModifier(matchData.name);

const getSubIndirectObjectMatcher : (matchData : UnitMatch) => Matcher =
            matchData => matchData.isCapture
                                ? captureSubIndirectObject(matchData.name)
                                : matchSubIndirectObject(matchData.name);
