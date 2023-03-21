// Helper code for handling mustache templates
import { isFound } from "../env"
import { Env } from "tift-types/src/env"
import { Obj } from "./objects"
import * as _ from "lodash"
import * as Mustache from "mustache"
import { LOOK_COUNT } from "../builder/enginedefault";
import { getCauseMessage } from "./errors";

export function formatEntityString(env : Env, entity : Obj, entityField : string) : string {
    const entitiesEnv = env.newChild(env.createNamespaceReferences(["entities"]));

    const specialFunctions = {
        "choose" : () => (text : string, render : (str : string) => void) => {
           const choice = _.sample(text.split("||"));
           return choice? render(choice) : "";
        },
        "sometimes" : () => (text : string, render : (str : string) => void) => {
            return (_.random(0,1,true) < 0.5)? render(text) : "";
        },
        "firstTime" : () => {
            let lookCount = entity[LOOK_COUNT];
            if (lookCount === undefined) {
                lookCount = 0;
                entity[LOOK_COUNT] = lookCount;
            }
            return lookCount === 0;
        }
    };

    const specialsEnv = entitiesEnv.newChild(specialFunctions);

    const entityEnv = specialsEnv.newChild(entity);

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const handler = {
        has : (_target : any, key : any) => {
            return entityEnv.has(key); 
        },
        get : (_target : any, key : any) => {
            const value = entityEnv.get(key);
            return isFound(value) ? value : "NOT FOUND";
        }
    }
    const proxy = new Proxy(entity, handler);

    const template = _.get(entity, entityField);

    try {
        return Mustache.render(template, proxy);
    } catch(e) {
        throw new Error(`Error formatting ${entity.id}.${entityField}\n"${template.trim()}"\n${getCauseMessage(e)}`);
    }
}