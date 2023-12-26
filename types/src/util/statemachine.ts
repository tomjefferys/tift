
export type StateName = string;

export interface MachineOps {
    setState(state : StateName) : void;
    setStatus(status : Status) : void;
}

/**
 * The current status of the state machine
 * Machine should move from NOT_STARTED -> RUNNING -> FINISHED
 * It can then be restarted
 */
export type Status = "NOT_STARTED" | "RUNNING" | "FINISHED";

/**
 * A state machine
 */
export interface StateMachine<TIn,TObj> {
    start : (obj : TObj) => void;
    send : (input : TIn, obj : TObj) => Promise<void>;
    getStatus : () => Status;
}