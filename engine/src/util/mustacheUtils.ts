// Helper code for handling mustache templates
import { Env, isFound } from "../env"
import { Obj } from "./objects"
import * as _ from "lodash"
import * as Mustache from "mustache"

export function formatEntityString(env : Env, entity : Obj, entityField : string) {
    const entitiesEnv = env.newChild(env.createNamespaceReferences(["entities"]));
    const entityEnv = entitiesEnv.newChild(entity);

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
    return Mustache.render(template, proxy);
}