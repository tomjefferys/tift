import * as objects from "./objects";

type PropType = objects.PropType;

export type Action = Set | Del;

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Set {
    readonly type : "Set",
    readonly property : PropType[],
    readonly newValue : any,
    readonly replace? : boolean
}

export interface Del {
    readonly type : "Del",
    readonly property : PropType[]
}

export interface UndoEntry {
    readonly undo : Action,
    readonly redo : Action
}

export interface History {
    baseHistory : Action[];
    undoStack : UndoEntry[][];
    redoStack : UndoEntry[][];
}

export interface ProxyManager {

    getHistory(compress? : boolean) : History;

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

    isUndoable() : boolean;

    isRedoable() : boolean;

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
     * returns true if there was anything to push
     */
    pushHistory() : boolean;

    /**
     * Set the maximum undo level
     */
    setUndoLevels(undoLevels : number) : void;
}
    
