import { VerbMap, EntityMap, Obj } from "./types";
import { Entity, EntityBuilder } from "./entity";
import { Verb } from "./verb";
import * as YAML from "./yamlparser";

type BuildFn<T> = (universe: Universe, obj: Obj) => void;

interface Universe {
    readonly entities : EntityMap;
    readonly verbs : VerbMap;
}

export const loadUniverse = (data: string) : Universe => {
    const objs = YAML.getObjs(data);
    const universe = {entities: {}, verbs: {}};
    objs.forEach(obj => {
        const type = obj["type"];
    })


    return {entities : {}, verbs : {}};
}

const entityBuilder : BuildFn<Entity> = (universe, obj) => {
    const id = obj["id"];
    if (typeof id === "string") {
        const builder = new EntityBuilder(id);
        return builder.build();
    }
    else {
        throw new Error("Entity without id found");
    }
    



}