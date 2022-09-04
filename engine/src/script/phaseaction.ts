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
    perform : (env : Env, command : Command) => Result,
    score : (command : Command) => number,
    isMatch : (command : Command) => boolean
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
    perform? : (env : Env, command : Command) => Result;
    score? : (command : Command) => number;
    isMatch? : (command : Command) => boolean

    withPhase<T extends Phase>(phase : T) : this & Pick<ObjectType<T>, 'type'> {
        return Object.assign(this, { type : phase});
    }

    withExpression(str : string) : this & Pick<PhaseAction, 'perform' | 'score' | 'isMatch'>{
        const expression = parseToTree(str);
        const [matcher, onMatch] = getMatcherCommand(expression, {phase : this.type, expression : str});
        return this.withMatcherOnMatch(matcher, onMatch);
    }

    withMatcherOnMatch(matcher : Matcher, onMatch : Thunk) : this & Pick<PhaseAction, 'perform' | 'score' | 'isMatch'> {
        return Object.assign(this,{
                perform : (env : Env, command : Command) => {
                    const result = matcher(command);
                    return result.isMatch? onMatch.resolve(env.newChild(result.captures)) :  mkResult(undefined, {});
                },
                score : (command : Command) => matcher(command).score,
                isMatch : (command : Command) => matcher(command).isMatch
        });
    }
}

export function phaseActionBuilder() {
    return new PhaseActionBuilder();
}


export function getBestMatchAction(actions : PhaseAction[], command : Command) : Optional<PhaseAction> {
    let score = 0;
    let bestMatch = undefined;
    for(const action of actions) {
      const actionScore = action.score(command);
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