// A proxy object that records mutations to an object

/* eslint-disable @typescript-eslint/no-explicit-any */
import _ from "lodash";
import * as Arrays from "./arrays";
import * as objects from "./objects";
import * as Type from "tift-types/src/util/historyproxy";

type UndoEntry = Type.UndoEntry;
type Action = Type.Action;
type History = Type.History;

const IS_PROXY = Symbol("isProxy");

type PropType = objects.PropType;
type Obj = objects.Obj;

/**
 * Proxy manager. Creates proxys, and track changes to them
 * Automatically proxies child objects on get
 */
export class ProxyManager implements Type.ProxyManager {

    private baseProxy : Obj;

    // The base history, this cannot be undone
    private baseHistory : Action[];

    // keep track of actions associated with and undo/redo step
    // There may be multiple actions per step
    private undoStack : UndoEntry[][];

    private redoStack : UndoEntry[][];

    // Accumulate actions in here first, before sending them to the undohistory
    private accumlator : UndoEntry[];

    private recordHistory : boolean;

    private undoLevels : number;

    constructor(baseObject = {}, recordHistory = false, history? : History, undoLevels = 0) {
        this.baseProxy = this.createProxy(baseObject);
        if (history) {
            this.baseHistory = history.baseHistory;
            this.undoStack = history.undoStack;
            this.redoStack = history.redoStack;
        } else {
            this.baseHistory = [];
            this.undoStack = [];
            this.redoStack = [];
        }
        this.recordHistory = recordHistory;
        this.undoLevels = undoLevels;
        this.accumlator = [];
    }

    setUndoLevels(undoLevels : number) : void {
        if (undoLevels < this.undoStack.length) {
            throw new Error(`Undo stack is already length: ${this.undoStack.length} can't set it to smaller value: ${undoLevels}`);
        }
        this.undoLevels = undoLevels;
    }

    getProxy() : Obj {
        return this.baseProxy;
    }

    private createProxy<T extends object>(obj : T, prefix : PropType[] = []) : T {
        return new Proxy(obj, this.createHandler(prefix));
    }

    getHistory() : History {
        return {
            baseHistory : this.baseHistory,
            undoStack : this.undoStack,
            redoStack : this.redoStack
        }
    }

    /**
     * Clear the proxy history
     */
    clearHistory() : void {
        this.baseHistory.length = 0;
    }

    /**
     * Enable recording for the proxy manager
     */
    startRecording() {
        this.recordHistory = true;
    }

    /**
     * Disable recording for the proxy manager
     */
    stopRecording() {
        this.recordHistory = false;
    }

    replayHistory(history : History) {
        const isRecording = this.recordHistory;
        try {
            history.baseHistory.forEach(action => replayAction(this.baseProxy, action));
            history.undoStack.forEach(undoTransaction => undoTransaction.forEach(undoStep => replayAction(this.baseProxy, undoStep.redo)))
            this.baseHistory = [...history.baseHistory];
            this.undoStack = [...history.undoStack];
            this.redoStack = [...history.redoStack];
        } finally {
            this.recordHistory = isRecording;
        }
    }

    /**
     * Push the latest accumultated history onto the undo queue
     * and add old entries to the base history
     */
    pushHistory() : boolean {
        const hasNewHistory = this.accumlator.length > 0;
        if (hasNewHistory) {
            // Clear the redo stack
            this.redoStack.length = 0;
            this.undoStack.push([...this.accumlator]);
            this.accumlator.length = 0;
            while(this.undoStack.length > this.undoLevels) {
                const stage = this.undoStack.shift();
                if (stage) {
                    stage.forEach(action => this.addAction(action.redo));
                }
            }
        }
        return hasNewHistory;
    }

    isUndoable() : boolean {
        return this.undoStack.length >= 1;
    }

    isRedoable() : boolean {
        return this.redoStack.length >= 1;
    }

    undo() {
        const isRecording = this.recordHistory;
        try {
            this.recordHistory = false;
            const history = this.undoStack.pop();
            if (!history) {
                return;
            }

            // Loop through the entries backwards, applying the undo actions
            for(let i = history.length - 1; i >=0; i--) {
                replayAction(this.baseProxy, history[i].undo);
            }

            this.redoStack.push(history)
        } finally {
            this.recordHistory = isRecording;
        }
    }

    redo() {
        const history = this.redoStack.pop();
        const isRecording = this.recordHistory;
        try {
            this.recordHistory = false;
            if (!history) {
                return;
            }

            // Loop through the entries, reapplying them
            history.forEach(entry => replayAction(this.baseProxy, entry.redo));

            this.undoStack.push(history);
        } finally {
            this.recordHistory = isRecording;
        }
    }

    /**
     * Record an action, overwriting any previous actions relating to this property
     * The process of overwriting enables the history to be kept as short as possible
     * @param newAction 
     */
    private recordAction(newAction : Action, previousValue : unknown, newValue? : unknown) {
        const undoAction = (previousValue !== undefined)
                                    ? createSet(newAction.property, previousValue, isReplace(newValue, previousValue))
                                    : createDel(newAction.property);
        this.accumlator.push({ redo : newAction, undo : undoAction});
    }

    /**
     * Add an action to the base history, compressing it first by removing any now irrelevent entries
     * @param newAction 
     */
    private addAction(newAction : Action) {
        const isSettingEmptyObject = (action : Action) => action.type === "Set" && !action.replace && objects.isEmptyObject(action.newValue);

        Arrays.remove(this.baseHistory, action => 
            Arrays.isPrefixOf(newAction.property, action.property) ||
            (isSettingEmptyObject(action) && Arrays.isPrefixOf(action.property, newAction.property))
        );
        this.baseHistory.push(newAction);
    }

    private createHandler(prefix : PropType[]) : object {
        return {
            get : (target : any, property : PropType) => {
                if (property === IS_PROXY) {
                    return true;
                }
                const value = Reflect.get(target, property);
                return shouldCreateProxy(target, property, value)
                        ? this.createProxy(value, [...prefix, property])
                        : value;
            },
            set : (target : object, property : PropType, newValue : any) => {
                if (this.recordHistory) {
                    const path = [...prefix, property];
                    const oldValue = Reflect.get(target, property);
                    const clonedNewValue = _.isObject(newValue)? _.cloneDeep(newValue) : newValue;
                    const action = createSet(path, clonedNewValue, isReplace(oldValue, newValue));
                    this.recordAction(action, oldValue);
                }
                return Reflect.set(target, property, newValue);
            },
            deleteProperty : (target : object, property : PropType) => {
                if (this.recordHistory) {
                    const oldValue = Reflect.get(target, property);
                    const action = createDel([...prefix, property])
                    this.recordAction(action, oldValue);
                }
                return Reflect.deleteProperty(target, property);
            }
        }
    }
}

/**
 * Are we replacing an existing value, and is it a different type?
 * Knowing this helps us stop unnecessarily storing empty objects in the history
 */
function isReplace(oldValue : unknown, newValue : unknown) : boolean {
    // TODO the type comparison is to ensure the replace property gets stored only when we need it
    // it's a bit confusing though, should consider removing this optimization (especially if save data gets compressed)
    return !_.isUndefined(oldValue) && objects.getType(oldValue) !== objects.getType(newValue);
}

export function createProxy(original : Obj = {}, recordHistory = false, history? : History, undoLevels = 0) : [Obj, ProxyManager] {
    const manager = new ProxyManager(original, recordHistory, history, undoLevels);
    return [manager.getProxy(), manager];
}

function createSet(property : PropType[], newValue : any, isReplace : boolean) : Action {
    const replace = isReplace? { replace : true } : {};
    return { type : "Set", property, newValue, ...replace};
}

function createDel(property : PropType[]) : Action {
    return { type : "Del", property }
}

/**
 * Do we need to wrap an object in a proxy
 * Must not already be wrapped, must be an object, and the property being accessed must be an own property of
 * the target object.
 * @param target 
 * @param property 
 * @param value 
 * @returns 
 */
const shouldCreateProxy = (target : any, property : PropType, value : any) =>
    !target[IS_PROXY] && _.isObject(value) && Object.prototype.hasOwnProperty.call(target, property);


/**
 * Replay history on an object
 * @param obj 
 * @param history 
 * @returns the new object, and it's ProxyManager
 */
export function replayHistory(obj : Obj, history : History) : [Obj, ProxyManager] {
    history.baseHistory.forEach(action => replayAction(obj, action));
    history.undoStack.forEach(undoTransaction => undoTransaction.forEach(undoStep => replayAction(obj, undoStep.redo)))
    const proxyManager = new ProxyManager(obj, false, history);
    return [proxyManager.getProxy(), proxyManager];
}

function replayAction(obj : Obj, action : Action) : void {
    switch(action.type) {
        case "Set": 
            objects.set(obj, action.property, action.newValue);
            break;
        case "Del":
            objects.unset(obj, action.property);
    }
}