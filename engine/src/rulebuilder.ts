import { Env, isFound } from "./env";
import { parseToThunk } from "./script/parser";
import { Optional } from "./util/optional";
import _ from "lodash";
import { EnvFn, mkResult, mkThunk, Thunk } from "./script/thunk";

const accessors = ["all", "repeat", "random"] as const;
type RuleAccessor = typeof accessors[number];

// TODO make this return a Thunk, then it could be used by the phase action parser
// which would allow the usage of these with before/after actions
export function parseRule(rule : unknown, path? : string) : Thunk {
    let ruleFn : Optional<Thunk> = undefined;
    if (_.isString(rule)) {
        ruleFn = parseToThunk(rule, path);
    } else if (_.isPlainObject(rule)) {
        const keys = _.keys(rule);
        if (keys.length === 1) {
            const accessor = keys[0];
            const accessorPath = path + "." + accessor;
            const childFns = parseRuleList(_.get(rule, accessor), accessorPath);
            if (isAccessor(accessor)) {
                ruleFn = makeRuleListFunction(accessor, childFns, path);
            } else {
                throw new Error(accessor + " is not a valid rule accessor.")
            }
        } else {
            throw new Error("Must have exactly 1 rule command. Found [" + JSON.stringify(keys) + "]" );
        }
    } else if (_.isArray(rule)) {
        const childFns = parseRuleList(rule, path);
        ruleFn = makeRuleListFunction("all", childFns, path);
    }
    if (ruleFn === undefined) {
        throw new Error("Rule: " + JSON.stringify(rule) + " at " + path + " could not be parsed");
    }
    return ruleFn;
}

function makeRuleListFunction(accessor : RuleAccessor, childFns : Thunk[], path? : string ) : Thunk {
    let ruleFn : EnvFn;
    switch(accessor) {
        case "all":
            ruleFn = env => {
                return childFns.reduce((_acc, fn) => fn.resolve(env), mkResult(null));
            }
            break;
        case "repeat": {
                const indexPath = (path + ".index");
                ruleFn = (env : Env) => {
                    let index = env.get(indexPath);
                    if (!isFound(index)) {
                        index = 0;
                    }
                    const result = childFns[index++].resolve(env);
                    if (index >= childFns.length) {
                        index = 0;
                    }
                    env.set(indexPath, index);
                    return result;
                };
            }
            break;
        case "random":
            ruleFn = env => {
                const index = _.random(childFns.length - 1);
                const result = childFns[index].resolve(env);
                return result;
            }
            break;
    }
    return mkThunk(ruleFn);
}

function isAccessor(str : string) : str is RuleAccessor {
    return accessors.includes(str as RuleAccessor);
}

function parseRuleList(ruleList : unknown, path? : string) : Thunk[] {
    const rules = _.isArray(ruleList)? ruleList : [ruleList];
    return rules.map((rule, index) => parseRule(rule, path + "[" + index + "]"));
}