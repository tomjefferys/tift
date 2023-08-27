// Helper code for handling mustache templates
import { isFound } from "../env"
import { Env } from "tift-types/src/env"
import { Obj } from "./objects"
import * as _ from "lodash"
import * as Mustache from "mustache"
import { getCauseMessage } from "./errors";
import { Optional } from "tift-types/src/util/optional"
import { IMPLICIT_FUNCTION } from "../builder/functionbuilder"

const COUNT = (name : string) => `__COUNT(${name})__`;

type ObjProp = [Obj,string];
type IncrementFunction = (tag : string) => void;
type FinalizeFunction = () => void;

export function formatString(env : Env, str : string, objProp? : Optional<ObjProp>, partials? : Record<string,string>) : string {
    const [count, incrementCount, finalizeCount] = getCountAndIncrement(str, objProp);

    const specialFunctions = {
        "choose" : () => (text : string, render : (str : string) => void) => {
           const choice = _.sample(text.split("||"));
           return choice? render(choice) : "";
        },
        "sometimes" : () => (text : string, render : (str : string) => void) => {
            return (_.random(0,1,true) < 0.5)? render(text) : "";
        },
        "firstTime" : () => {
            incrementCount("firstTime");
            return count === 0;
        },
        "secondTime" : () => {
            incrementCount("secondTime");
            return count === 1;
        },
        "br" : "\n  \n" // Force a line break
    };
    
    const scope = env.newChild(specialFunctions)
                     .newChild(getObj(objProp));

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const handler = {
        has : (_target : any, key : any) => {
            return scope.has(key); 
        },
        get : (_target : any, key : any) => {
            const value = scope.get(key);
            let result = undefined;
            if (value !== undefined && isFound(value)) {
                result = value[IMPLICIT_FUNCTION]? value(env).getValue() : value;
            }
            return result;
        }
    }
    const proxy = new Proxy({}, handler);

    try {
        const result = Mustache.render(str, proxy, partials);
        finalizeCount();
        return result;
    } catch(e) {
        throw new Error(`Error formatting: "${str}", ${getCauseMessage(e)}`);
    }
}

function getCountAndIncrement(str : string, objProp : Optional<ObjProp>) : [number, IncrementFunction, FinalizeFunction] {
    let count = 0;
    let incrementer : (tag : string) => void;
    let finalizer : () => void;
    if (objProp) {
        const [obj, property] = objProp;
        const countProp = COUNT(property);
        count = obj[countProp] ?? 0;
        let doIncrement = false;
        incrementer = _tag => doIncrement = true;
        finalizer = () => {
            if (doIncrement) {
                obj[countProp] = count + 1;
            }
        }
    } else {
        incrementer = tag => {
            throw new Error(`Can't use state mutating tag: ${tag} in literal string: ${str}. ` + 
                            `${tag} can only be used in an object property`);
        }
        finalizer = () => {/* do nothing */};
    }
    return [count, incrementer, finalizer];
}

function getObj(objProp : Optional<ObjProp>) : Obj {
    return objProp? objProp[0] : {}
}
