import { Optional } from "tift-types/src/util/optional";
import { Status, StateMachine, StateName, MachineOps } from "tift-types/src/util/statemachine"

export const TERMINATE : StateName = "__TERMINATE__";

type StateFn<T> = (obj : T, machine : MachineOps) => void;
type InputFn<M,T> = (input : M, obj : T) => Promise<Optional<StateName>>;

/** 
 * A state for a state machine
 */
export interface State<TIn,TObj> {
    onEnter? : StateFn<TObj>;
    onAction : InputFn<TIn,TObj>;
    onLeave? : StateFn<TObj>;
}

type StateMap<TIn,TObj> = {[key:StateName]:State<TIn,TObj>};
type StateTuple<TIn,TObj> = [StateName, State<TIn,TObj>];


export function buildStateMachine<TIn,TObj>(initialState : StateName, ...states : [StateName, State<TIn,TObj>][]) : StateMachine<TIn, TObj> {

    // The current state of the state machine, is undefined until started
    let currentState : Optional<StateName> = undefined;

    // Map of names -> states
    const stateMap = states.reduce(
        (map : StateMap<TIn,TObj>, [name, state] : StateTuple<TIn,TObj>) => ({...map, [name] : state}), {});

    // Current status of the state machien
    let status : Status = "NOT_STARTED";

    // get a state, throw error if not found
    const getState = (stateName : StateName) => {
        const state = stateMap[stateName];
        if (!state) { 
            throw new Error("State machine does not contain state: [" + currentState + "]");
        }
        return state;
    }

    const switchStates = (target : Optional<StateName>, obj : TObj) => {
        if (currentState) {
            const state = getState(currentState);
            if (state.onLeave) {
                state.onLeave(obj, machine);
            }
        }
        let nextState = undefined;
        if (target) {
            nextState = target;
            const state = getState(target);
            if (state.onEnter) {
                state.onEnter(obj, machine);
            }
        }
        currentState = nextState;
    }

    const machine = {
        start : (obj : TObj) => {
            if (status === "RUNNING") {
                throw new Error("State machine is already running");
            }
            status = "RUNNING";
            switchStates(initialState, obj);
        },
        send : async (input : TIn, obj : TObj) => {
            if (status !== "RUNNING") {
                throw new Error("State machine can't recieve input it is " + status);
            }
            if (currentState === undefined) {
                throw new Error("State machine state is undefined");
            }
            const state = getState(currentState);
            const nextState = await state.onAction(input, obj);
            if (nextState === TERMINATE) {
                status = "FINISHED";
                switchStates(undefined, obj);
            } else if (nextState !== undefined && nextState !== currentState) {
                switchStates(nextState, obj);
            }
        },
        getStatus : () => status,
        setState : (newState : StateName) => {
            currentState = newState;
        },
        setStatus : (newStatus : Status) => {
            status = newStatus;
        }
    }

    return machine;
}



