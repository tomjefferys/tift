// A proxy object that records mutations to an object

/* eslint-disable @typescript-eslint/no-explicit-any */
import _ from "lodash";
import { isPrefixOf } from "./arrays";

const IS_PROXY = Symbol("isProxy");

type PropType = string | symbol;

type Action = Set | Del;

interface Set {
    type : "Set",
    property : PropType[],
    newValue : any
}

interface Del {
    type : "Del",
    property : PropType[]
}

/**
 * Proxy manager. Creates proxys, and track changes to them
 * Automatically proxies child objects on get
 */
export class ProxyManager {
    private history : Action[];
    fullHistory : Action[] = [];

    constructor(history : Action[] = []) {
        this.history = history;
    }

    createProxy<T extends object>(obj : T, prefix : PropType[] = []) : T {
        return new Proxy(obj, this.createHandler(prefix));
    }

    getHistory() : Action[] {
        return [...this.history];
    }

    private recordAction(newAction : Action) {
        this.history = [...this.history.filter(action => !isPrefixOf(newAction.property, action.property)), newAction];
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
                const path = [...prefix, property];
                const action : Action = {type : "Set", property : path, newValue : _.isObject(newValue)? _.cloneDeep(newValue) : newValue};
                this.recordAction(action);
                this.fullHistory.push(action);
                return Reflect.set(target, property, newValue);
            },
            deleteProperty : (target : object, property : PropType) => {
                this.recordAction({type : "Del", property : [...prefix, property]})
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
export function replayHistory<T extends object>(obj : T, history : Action[]) : [T, ProxyManager] {
    history.forEach(action => {
        switch(action.type) {
            case "Set": 
                _.set(obj, action.property, action.newValue);
                break;
            case "Del":
                _.unset(obj, action.property);
        }
    })
    const proxyManager = new ProxyManager(history);
    return [proxyManager.createProxy(obj), proxyManager];
}