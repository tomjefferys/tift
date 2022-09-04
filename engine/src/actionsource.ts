import { AfterAction, BeforeAction, MainAction } from "./script/phaseaction";

/**
 * A supplier for the three types of action.
 * 
 * before - run before the main action, if they return true it means the action has been handled, and the main actions won't run
 * actions - the main action
 * after - runs after the main action, can override any output from the main action
 */
export interface ActionSource {
    before : BeforeAction[],
    actions : MainAction[],
    after : AfterAction[]
}

export const emptyActionSource = () : ActionSource  => ({ before : [], actions : [], after : []});