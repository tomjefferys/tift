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

export interface UndoEntry {
    undo : Action,
    redo : Action
}

export interface History {
    baseHistory : Action[];
    undoStack : UndoEntry[][];
    redoStack : UndoEntry[][];
}

export interface ProxyManager {

    getHistory() : History;

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

    replayHistory(history : History) : void;

    /**
     * Undo the last move
     * @param obj an oject to replay the history into
     */
    undo() : void;

    /**
     * Redo a previously undone move
     * @param obj an oject to replay the history into
     */
    redo() : void;

    /**
     * Push the latest accumulated actions into the undo queue
     */
    pushHistory(): void;

    /**
     * Set the maximum undo level
     */
    setUndoLevels(undoLevels : number) : void;
}
    
