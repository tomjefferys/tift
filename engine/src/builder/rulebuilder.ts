import { isFound } from "../env";
import { Env } from "tift-types/src/env";
import { parseToThunk } from "../script/parser";
import { Optional } from "tift-types/src/util/optional";
import _ from "lodash";
import { mkResult, mkThunk, Thunk } from "../script/thunk";

const INDEX_NAME = ".index";

// Diffenent types of method in a componennt rule
type RuleMethodType = "condition" | "action" | "otherwise";

// A function that can evaluate a rule to a thunk
type RuleEvaluator = (rule : unknown, path? : string) => Thunk;

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
        ruleFn = parseToThunk(rule, path);
    } else if (_.isPlainObject(rule)) {
        ruleFn = evaluateComponentRule(rule as object, path);
    } else if (_.isArray(rule)) {
        ruleFn = buildAll(rule, path);
    }
    if (ruleFn === undefined) {
        throw new Error("Rule: " + JSON.stringify(rule) + " at " + path + " could not be parsed");
    }
    return ruleFn;
}


/**
 * Parse a component rule.  This is a rule, that might have separate 'when' and 'repeat' clauses
 * @param rule
 * @param path 
 * @returns 
 */
function evaluateComponentRule(rule : object, path? : string) : Thunk {
    const rules : {[key in RuleMethodType]?:Thunk} = {};
    for(const [key,value] of Object.entries(rule)) {
        const componentBuilder = components[key];
        if (componentBuilder) {
            const [type, builder] = componentBuilder;
            if (_.has(rules, type)) {
                throw new Error(`Duplicate ${type} declared for ${path}`);
            }
            rules[type] = builder(value, path + "." + key);
        }
    }
    // TODO warn if no action

    const envFn = (env : Env) => {
        const scope = env.newChild();
        const action = (rules["condition"]?.resolve(scope).getValue() ?? true)
                            ? rules["action"]
                            : rules["otherwise"]
        return mkResult(action?.resolve(scope).getValue());
    }
    return mkThunk(envFn);
}


function evaluateRuleList(ruleList : unknown, path? : string) : Thunk[] {
    const rules = _.isArray(ruleList)? ruleList : [ruleList];
    return rules.map((rule, index) => evaluateRule(rule, path + "[" + index + "]"));
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
    const indexPath = (path + INDEX_NAME);
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
    unless :    ["condition", buildUnless],
    all :       ["action",    buildAll],
    do :        ["action",    buildAll],
    switch :    ["action",    buildSwitch],
    repeat :    ["action",    buildRepeat],
    random :    ["action",    buildRandom],
    otherwise : ["otherwise", evaluator]
}
