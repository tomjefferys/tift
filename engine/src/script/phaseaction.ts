// Represents a before/main/after action

import { BinaryExpression, Expression } from "jsep";
import _ from "lodash";
import { Command } from "../command";
import { Matcher } from "../commandmatcher";
import { Env } from "../env";
import { Optional } from "../util/optional";
import { evalutateMatchExpression } from "./matchParser";
import { evaluate, parseToTree } from "./parser";
import { mkResult, Result, Thunk } from "./thunk";

export type Phase = "before" | "main" | "after";

export interface PhaseAction {
    type : Phase,
    perform : (env : Env, objId : string, command : Command) => Result,
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

type ObjectType<T> =
    T extends "before" ? BeforeAction :
    T extends "main" ? MainAction :
    T extends "after" ? AfterAction : 
    never;

export class PhaseActionBuilder implements Partial<PhaseAction> {
    type? : Phase;
    perform? : (env : Env, objId : string, command : Command) => Result;
    score? : (command : Command, objId : string) => number;
    isMatch? : (command : Command, objId : string) => boolean

    withPhase<T extends Phase>(phase : T) : this & Pick<ObjectType<T>, 'type'> {
        return Object.assign(this, { type : phase});
    }

    withExpression(str : string) : this & Pick<PhaseAction, 'perform' | 'score' | 'isMatch'>{
        const expression = parseToTree(str);
        const [matcher, onMatch] = getMatcherCommand(expression, {phase : this.type, expression : str});
        return this.withMatcherOnMatch(matcher, onMatch);
    }

    withMatcherOnMatch(matcher : Matcher, onMatch : Thunk) : this & Pick<PhaseAction, 'perform' | 'score' | 'isMatch'> {
        const phaseAction =  Object.assign(this,{
                perform : (env : Env, objId : string,  command : Command) => {
                    const result = matcher(command, objId);
                    return result.isMatch? onMatch.resolve(env.newChild(result.captures)) :  mkResult(undefined, {});
                },
                score : (command : Command, objId : string) => matcher(command, objId).score,
                isMatch : (command : Command, objId : string) => matcher(command, objId).isMatch,
                toString : () => matcher.toString() + " => " + onMatch
        });
        return phaseAction;
    }
}

export function phaseActionBuilder() {
    return new PhaseActionBuilder();
}


export function getBestMatchAction(actions : PhaseAction[], command : Command, objId : string) : Optional<PhaseAction> {
    let score = 0;
    let bestMatch = undefined;
    for(const action of actions) {
      const actionScore = action.score(command, objId);
      if (actionScore > score) {
        score = actionScore;
        bestMatch = action;
      }
    }
    return bestMatch;
}

function getMatcherCommand(expression : Expression, info : PhaseActionInfo) : [Matcher, Thunk] {
    const [matchExpr, commandExpr] =  getActionPhaseExpression(expression, info);
    return [evalutateMatchExpression(matchExpr), evaluate(commandExpr)];
}

function getActionPhaseExpression(expression : Expression, info : PhaseActionInfo) : [Expression, Expression] {
    if (expression.type !== "BinaryExpression" || (expression as BinaryExpression).operator != "=>") {
        throw new Error(info.phase + " is not of the correct format (Matcher => Command):  " + info.expression);
    }
    const binExpr = expression as BinaryExpression;
    return [binExpr.left, binExpr.right];

}