import * as objects from "./objects";

type PropType = objects.PropType;
type Obj = objects.Obj;

export type Action = Set | Del;

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Set {
    type : "Set",
    property : PropType[],
    newValue : any,
    replace? : boolean
}

export interface Del {
    type : "Del",
    property : PropType[]
}

export interface ProxyManager {

    getHistory() : Action[];

    /**
     * Clear the proxy history
     */
    clearHistory() : void;

    /**
     * Enable recording for the proxy manager
     */
    startRecording() : void;

    /**
     * Disable recording for the proxy manager
     */
    stopRecording() : void;

    replayHistory(obj : Obj, history : Action[]) : void;
}
    
