// Represents a before/main/after action

import { BinaryExpression, Expression } from "jsep";
import _ from "lodash";
import { Command } from "../command";
import { Matcher } from "../commandmatcher";
import { Env } from "tift-types/src/env";
import { evaluateMatchExpression } from "./matchParser";
import { evaluate, parseToTree } from "./parser";
import { mkResult, Result, Thunk } from "./thunk";
import { Obj } from "../util/objects"
import * as RuleBuilder from "../game/rulebuilder";
import * as Path from "../path";
import * as Errors from "../util/errors";

export type Phase = "before" | "main" | "after";

export interface PhaseAction {
    type : Phase,
    perform : (env : Env, obj : Obj, command : Command) => Result,
    score : (command : Command, objId : string) => number,
    isMatch : (command : Command, objId : string) => boolean
}

export interface BeforeAction extends PhaseAction {
    type : "before"
}

export interface MainAction extends PhaseAction {
    type : "main"
}

export interface AfterAction extends PhaseAction {
    type : "after"
}

export interface PhaseActionInfo {
    phase? : Phase,
    expression? : string
}

export type PhaseActionType<T> =
    T extends "before" ? BeforeAction :
    T extends "main" ? MainAction :
    T extends "after" ? AfterAction : 
    never;

export class PhaseActionBuilder implements Partial<PhaseAction> {

    objPath? : Path.Type; // Used to hold error context

    type? : Phase;
    perform? : (env : Env, obj : Obj, command : Command) => Result;
    score? : (command : Command, objId : string) => number;
    isMatch? : (command : Command, objId : string) => boolean

    constructor(objPath? : Path.Type) {
        this.objPath = objPath;
    }

    withPhase<T extends Phase>(phase : T) : this & Pick<PhaseActionType<T>, 'type'> {
        return Object.assign(this, { type : phase});
    }

    withExpression(str : string) : this & Pick<PhaseAction, 'perform' | 'score' | 'isMatch'>{
        const expression = parseToTree(str, this.objPath);
        const [matcher, onMatch] = getMatcherCommand(expression, {phase : this.type, expression : str});
        return this.withMatcherOnMatch(matcher, onMatch);
    }

    withMatcherAndCommand(matcherExpr : string, commandExpr : unknown) : this & Pick<PhaseAction, 'perform' | 'score' | 'isMatch'> {
        const matcher = evaluateMatchExpression(parseToTree(matcherExpr, this.objPath));
        const command = RuleBuilder.evaluateRule(commandExpr, this.objPath);
        return this.withMatcherOnMatch(matcher, command);
    }

    withMatcherOnMatch(matcher : Matcher, onMatch : Thunk) : this & Pick<PhaseAction, 'perform' | 'score' | 'isMatch'> {
        const phaseAction =  Object.assign(this,{
                perform : (env : Env, obj : Obj,  command : Command) => {
                    try {
                        const result = matcher(command, obj.id);
                        if (result.isMatch) {
                            const entitiesEnv = env.newChild(env.createNamespaceReferences(["entities"]));
                            const resolverEnv = entitiesEnv.newChild(result.captures ?? {})
                                                           .newChild({"this" : obj})
                                                           .newChild(obj);
                            return onMatch.resolve(resolverEnv);
                        } else {
                            return mkResult(undefined, {});
                        }
                    } catch (e) {
                        Errors.rethrowExecutionError(`Error executing ${this.type} action`, e, this.objPath);
                    }
                },
                score : (command : Command, objId : string) => matcher(command, objId).score,
                isMatch : (command : Command, objId : string) => matcher(command, objId).isMatch,
                toString : () => matcher.toString() + " => " + onMatch
        });
        return phaseAction;
    }
}

export function phaseActionBuilder(objPath? : Path.PossiblePath) {
    return new PhaseActionBuilder(objPath ? Path.of(objPath) : undefined);
}

function getMatcherCommand(expression : Expression, info : PhaseActionInfo) : [Matcher, Thunk] {
    const [matchExpr, commandExpr] =  getActionPhaseExpression(expression, info);
    return [evaluateMatchExpression(matchExpr), evaluate(commandExpr)];
}

function getActionPhaseExpression(expression : Expression, info : PhaseActionInfo) : [Expression, Expression] {
    if (expression.type !== "BinaryExpression" || (expression as BinaryExpression).operator != "=>") {
        throw new Error(info.phase + " is not of the correct format (Matcher => Command):  " + info.expression);
    }
    const binExpr = expression as BinaryExpression;
    return [binExpr.left, binExpr.right];

}