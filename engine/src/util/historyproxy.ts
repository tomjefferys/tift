// A proxy object that records mutations to an object

/* eslint-disable @typescript-eslint/no-explicit-any */
import _ from "lodash";
import * as Arrays from "./arrays";
import * as objects from "./objects";
import * as Type from "tift-types/src/util/historyproxy";

const IS_PROXY = Symbol("isProxy");

type PropType = objects.PropType;
type Obj = objects.Obj;

export type Action = Set | Del;

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

/**
 * Proxy manager. Creates proxys, and track changes to them
 * Automatically proxies child objects on get
 */
export class ProxyManager implements Type.ProxyManager {

    // The base history, this cannot be undone
    private baseHistory : Action[];

    // keep track of actions associated with and undo/redo step
    // There may be multiple actions per step
    private undoHistory : Action[][];

    // Accumulate actions in here first, before sending them to the undohistory
    private accumlator : Action[];

    private recordHistory : boolean;

    private readonly undoLevels : number;

    private undoIndex : number;

    constructor(recordHistory = false, history : Action[] = [], undoLevels = 0) {
        this.baseHistory = history;
        this.recordHistory = recordHistory;
        this.undoLevels = undoLevels;
        this.undoIndex = 0;
        this.undoHistory = [];
        this.accumlator = [];
    }

    createProxy<T extends object>(obj : T, prefix : PropType[] = []) : T {
        return new Proxy(obj, this.createHandler(prefix));
    }

    getHistory() : Action[] {
        return [...this.baseHistory];
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

    replayHistory(obj : Obj, history : Action[]) {
        history.forEach(action => {
            switch(action.type) {
                case "Set": 
                    objects.set(obj, action.property, action.newValue);
                    break;
                case "Del":
                    objects.unset(obj, action.property);
            }
        });
    }

    /**
     * Push the latest accumultated history onto the undo queue
     * and add old entries to the base history
     */
    push() {
        this.resetUndoLevel();
        this.undoHistory.push([...this.accumlator]);
        this.accumlator.length = 0;
        while(this.undoHistory.length > this.undoLevels) {
            const stage = this.undoHistory.shift();
            if (stage) {
                stage.forEach(action => this.addAction(this.baseHistory, action));
            }
        }
    }

    isUndoable() : boolean {
        return (this.undoHistory.length + this.undoIndex) > 0;
    }

    isRedoable() : boolean {
        return this.undoIndex !== 0;
    }

    undo(obj : Obj) {
        if (this.isUndoable()) {
            this.undoIndex--;
        }
        this.replayToUndoPosition(obj);
    }

    redo(obj : Obj) {
        if (this.isRedoable()) {
            this.undoIndex++;
        }
        this.replayToUndoPosition(obj);
    }

    /**
     * Reset the undo level to the current position, removing any newer history
     */
    private resetUndoLevel() : void {
        if (this.undoIndex < 0) {
            this.undoHistory.splice(this.undoIndex);
        }
        this.undoIndex = 0;
    }

    private replayToUndoPosition(obj : Obj) {
        const isRecording = this.recordHistory;
        try {
            this.recordHistory = false;
            this.replayHistory(obj, this.baseHistory);
            this.undoHistory.slice(0, this.undoHistory.length + this.undoIndex)
                            .forEach(actions => this.replayHistory(obj, actions));
        } finally {
            this.recordHistory = isRecording;
        }
    }

    /**
     * Record an action, overwriting any previous actions relating to this property
     * The process of overwriting enables the history to be kept as short as possible
     * @param newAction 
     */
    private recordAction(newAction : Action) {
        const target = (this.undoLevels === 0)? this.baseHistory : this.accumlator;
        this.addAction(target, newAction);
    }

    private addAction(history : Action[], newAction : Action) {
        const isSettingEmptyObject = (action : Action) => action.type === "Set" && !action.replace && objects.isEmptyObject(action.newValue);

        Arrays.remove(history, action => 
            Arrays.isPrefixOf(newAction.property, action.property) ||
            (isSettingEmptyObject(action) && Arrays.isPrefixOf(action.property, newAction.property))
        );
        history.push(newAction);
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
                    const replace = (!_.isUndefined(oldValue) && objects.getType(oldValue) !== objects.getType(newValue))? { replace : true } : {};
                    const action : Action = {type : "Set", property : path, newValue : _.isObject(newValue)? _.cloneDeep(newValue) : newValue, ...replace};
                    this.recordAction(action);
                }
                return Reflect.set(target, property, newValue);
            },
            deleteProperty : (target : object, property : PropType) => {
                if (this.recordHistory) {
                    this.recordAction({type : "Del", property : [...prefix, property]})
                }
                return Reflect.deleteProperty(target, property);
            }
        }
    }
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
//export function replayHistory<T extends object>(obj : T, history : Action[]) : [T, ProxyManager] {
export function replayHistory(obj : Obj, history : Action[]) : [Obj, ProxyManager] {
    history.forEach(action => {
        switch(action.type) {
            case "Set": 
                objects.set(obj, action.property, action.newValue);
                break;
            case "Del":
                objects.unset(obj, action.property);
        }
    })
    const proxyManager = new ProxyManager(false, history);
    return [proxyManager.createProxy(obj), proxyManager];
}