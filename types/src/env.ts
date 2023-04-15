import { Obj } from "./util/objects";
import { Path } from "./path";
import { ProxyManager } from "./util/historyproxy";
import { History } from "./util/historyproxy";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AnyArray = unknown[];

export type ReturnType = boolean | number | string | EnvFn | Obj | AnyArray | void;

export type EnvFn = (env : Env) => ReturnType;

export type NameSpace = string[];

export interface Env {

    readonly properties : Obj;

    readonly proxyManager : ProxyManager;

    getParent() : Env | undefined;

    def(name : string, value : any) : void;

    get(name: Path | string | symbol, followReferences : boolean) : any;
    get(name: Path | string | symbol) : any;
    
    getStr(name : string) : string;

    set(name : Path | string | symbol, value : any) : void;

    has(name : Path | string | symbol) : boolean;

    execute(name : string, bindings : Obj ) : ReturnType;

    newChild() : Env;
    newChild(obj : Obj) : Env;

    addBindings(bindings : Obj) : void;

    replayHistory(history : History) : void;

    createNamespaceReferences(ns : NameSpace) : Obj;

    findObjs(predicate: (obj: Obj) => boolean) : Obj[];
    findObjs(predicate: (obj: Obj) => boolean, namespaces : NameSpace[]) : Obj[];

}