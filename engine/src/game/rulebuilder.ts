import { isFound } from "../env";
import { Env } from "tift-types/src/env";
import { parseToThunk } from "../script/parser";
import { Optional } from "tift-types/src/util/optional";
import _ from "lodash";
import { mkResult, mkThunk, Thunk } from "../script/thunk";
import * as Path from "../path";
import * as Errors from "../util/errors";
import { formatString } from "../util/mustacheUtils";

const INDEX_NAME = "index";
const COUNT_NAME = "count";

const STRING_PREFIX = "$";

// Different types of method in a component rule
type RuleMethodType = "condition" | "action" | "otherwise";

// A function that can evaluate a rule to a thunk
type RuleEvaluator = (rule : unknown, path? : Path.PossiblePath) => Thunk;

/**
 * Parse a rule.  This could be a single string, an array of rules, 
 * or a component rule.
 * @param rule 
 * @param path 
 * @returns 
 */
export const evaluateRule : RuleEvaluator = (rule, path) => {
    let ruleFn : Optional<Thunk> = undefined;
    if (_.isString(rule)) {
        const isPrefixedString = rule.trimStart().startsWith(STRING_PREFIX);
        ruleFn = isPrefixedString
                    ? handlePrefixedString(rule)
                    : parseToThunk(rule, path);
    } else if (_.isPlainObject(rule)) {
        ruleFn = evaluateComponentRule(rule as object, path);
    } else if (_.isArray(rule)) {
        ruleFn = buildAll(rule, path);
    }
    if (ruleFn === undefined) {
        Errors.throwError("Rule: " + JSON.stringify(rule) + " could not be parsed", path);
    }
    return ruleFn;
}

// Handle $-prefixed strings.  These should be treated as raw strings, and not parsed as expressions
function handlePrefixedString(str : string) : Thunk {
    const trimmed = str.trimStart();
    const prefixRemoved = trimmed.substring(1).trimStart();
    const finalString = prefixRemoved.trim();
    return mkThunk((env : Env) => {
        const str= formatString(env, finalString);
        return mkResult(env.execute("write", { "value": str } ));
    });
}

/**
 * Parse a component rule.  This is a rule, that might have separate 'when' and 'repeat' clauses
 * @param rule
 * @param path 
 * @returns 
 */
function evaluateComponentRule(rule : object, path? : Path.PossiblePath) : Thunk {
    const rules : {[key in RuleMethodType]?:Thunk} = {};
    for(const [key,value] of Object.entries(rule)) {
        const componentBuilder = components[key];
        if (componentBuilder) {
            const [type, builder] = componentBuilder;
            if (_.has(rules, type)) {
                Errors.throwError(`Duplicate ${type} declared}`, path);
            }
            rules[type] = builder(value, Path.concat(path ?? [], key));
        }
    }
    // TODO warn if no action

    const envFn = (env : Env) => {
        const scope = env.newChild();

        const performAction = rules["condition"]
                            ? rules["condition"].resolve(scope).getValue()
                            : true;

        const action = performAction ? rules["action"] : rules["otherwise"]
        return mkResult(action?.resolve(scope).getValue());
    }
    return mkThunk(envFn);
}


function evaluateRuleList(ruleList : unknown, path? : Path.PossiblePath) : Thunk[] {
    const rules = _.isArray(ruleList)? ruleList : [ruleList];
    return rules.map((rule, index) => evaluateRule(rule, Path.concat(path ?? [], index)));
}

/**
 * Basic rule evaluator
 */
const evaluator : RuleEvaluator = (rule, path) => {
    const expr = evaluateRule(rule, path);
    const envFn = (env : Env) => {
        return expr.resolve(env.newChild());
    }
    return mkThunk(envFn);
}

/**
 * Performs a logical not on an evaluatioin result
 */
const buildUnless : RuleEvaluator = (rule, path) => {
    const thunk = evaluator(rule, path);
    return mkThunk(env => mkResult(!thunk.resolve(env).getValue()));
}


/**
 * Builds an evaluator that executes every item in a list
 */
const buildAll : RuleEvaluator = (rules, path) => {
    const thunks = evaluateRuleList(rules, path);
    const envFn = (env : Env) => {
        const scope = env.newChild();
        return thunks.reduce((_acc, fn) => fn.resolve(scope), mkResult(null));
    }
    return mkThunk(envFn);
}

/**
 * Builds an evaluator which loop through a list of rules, stopping as soon as
 * one of them returns true 
 */
const buildSwitch : RuleEvaluator = (rules, path) => {
    const thunks = evaluateRuleList(rules, path);
    const envFn = (env : Env) => {
        const scope = env.newChild();
        return mkResult(thunks.reduce((acc, fn) => (acc)? acc : fn.resolve(scope).getValue(), false as unknown));
    }
    return mkThunk(envFn);
}

/**
 * Builds an evaluator that executes each item in turn.
 * Adds an 'index' variable to the path, to store the current index
 */
const buildRepeat : RuleEvaluator = (rules, path) => {
    const thunks = evaluateRuleList(rules, path);
    const indexPath = Path.concat(path ?? [], INDEX_NAME);
    const ruleFn = (env : Env) => {
        let index = env.get(indexPath);
        if (!isFound(index)) {
            index = 0;
        }
        const result = thunks[index++].resolve(env.newChild());
        if (index >= thunks.length) {
            index = 0;
        }
        env.set(indexPath, index);
        return result;
    };
    return mkThunk(ruleFn);
}

const buildOnce : RuleEvaluator = (rules, path) => {
    const thunk = evaluateRule(rules, path);
    const countPath = Path.concat(path ?? [], COUNT_NAME);
    const ruleFn = (env : Env) => {
        let count = env.get(countPath);
        if (!isFound(count)) {
            count = 0;
        }
        const result = (count === 0)
                            ? thunk.resolve(env.newChild())
                            : mkResult(false);
        env.set(countPath, count + 1);
        return result;
    };
    return mkThunk(ruleFn);
}

/**
 * Builds an evaluator that will execute an item at random
 */
const buildRandom : RuleEvaluator = (rules, path) => {
    const thunks = evaluateRuleList(rules, path);
    const ruleFn = (env : Env) => {
        const index = _.random(thunks.length - 1);
        const result = thunks[index].resolve(env.newChild());
        return result;
    }
    return mkThunk(ruleFn);
}

/**
 * Compound rule components, and their types
 */
const components : {[key:string]:[RuleMethodType, RuleEvaluator]} = {
    when :      ["condition", evaluator],
    if :        ["condition", evaluator],
    unless :    ["condition", buildUnless],
    all :       ["action",    buildAll],
    do :        ["action",    buildAll],
    then :      ["action",    buildAll],
    switch :    ["action",    buildSwitch],
    repeat :    ["action",    buildRepeat],
    random :    ["action",    buildRandom],
    once :      ["action",    buildOnce],
    otherwise : ["otherwise", evaluator],
    else :      ["otherwise", evaluator]
}
