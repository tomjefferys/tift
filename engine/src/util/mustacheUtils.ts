// Helper code for handling mustache templates
import { Env, Obj } from "../env"
import * as _ from "lodash"
import * as Mustache from "mustache"
import * as Path from "../path"

export function formatEntityString(env : Env, entity : Obj, entityField : string) {
    const entityEnv = env.newChild(entity);

    const handler = {
        has : (target : any, key : any) => {
            return _.has(target, key) || env.has(Path.fromValueList(["entities",key])); 
        },
        get : (target : any, key : any) => {
            return _.get(target, key) ?? env.get(Path.fromValueList(["entities", key]));
        }
    }
    const proxy = new Proxy(entity, handler);

    const template = _.get(entity, entityField);
    return Mustache.render(template, proxy);
}