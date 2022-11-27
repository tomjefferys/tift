// A proxy object that records mutations to an object

import _ from "lodash";
import { isPrefixOf } from "./arrays";

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

export class ProxyManager {
    private history : Action[];

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
            get : (target : object, property : PropType) => {
                const value = Reflect.get(target, property);
                return (_.isObject(value)) 
                            ? this.createProxy(value, [...prefix, property])
                            : value;
            },
            set : (target : object, property : PropType, newValue : any) => {
                this.recordAction({type : "Set", property : [...prefix, property], newValue});
                return Reflect.set(target, property, newValue);
            },
            deleteProperty : (target : object, property : PropType) => {
                this.recordAction({type : "Del", property : [...prefix, property]})
                return Reflect.deleteProperty(target, property);
            }
        }
    }
}

export function replayHistory<T extends Object>(obj : T, history : Action[]) : [T, ProxyManager] {
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