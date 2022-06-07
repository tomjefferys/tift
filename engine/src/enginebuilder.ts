import { Verb, VerbBuilder, VerbTrait } from "./verb";
import { Entity, EntityBuilder } from "./entity";
import { Obj } from "./types";
import { getString, forEach, forEachEntry, ifExists } from "./obj";
import { BasicEngine, Engine, EngineState } from "./engine";
import { getObjs } from "./yamlparser";
import { Action } from "./action"
import { getMatcher, match } from "./actionmatcher"
import { Env, ObjBuilder } from "./env"

const DEFAULT_VERBS = [
      new VerbBuilder("go")
                  .withTrait(VerbTrait.Intransitive)
                  .withModifier("direction")
                  .build()
];

export class EngineBuilder {
    private verbs : Verb[] = [];
    private entities : Entity[] = [];

    constructor() {
        DEFAULT_VERBS.forEach(verb => this.verbs.push(verb));
    }
     
    withObj(obj : Obj) : EngineBuilder {
        switch(obj["type"]) {
            case "room":
                this.entities.push(makeRoom(obj));
                break;
            case "object":
                this.entities.push(makeEntity(obj));
                break;
            case "verb":
                this.verbs.push(makeVerb(obj));
                break;
            default:
                throw new Error("Unknown object type");
        }
        return this;
    }

    build() : Engine & EngineState {
        return new BasicEngine(this.entities, this.verbs);
        //return {
        //    verbs : this.verbs,
        //    entities : this.entities,
        //    getWords : (partial) => [],
        //    execute : (command) => {}
        //};
    }
    
}

export function loadFromYaml(data: string) : Engine & EngineState {
    const objs = getObjs(data);
    const builder = new EngineBuilder();
    objs.forEach(obj => builder.withObj(obj));
    return builder.build();
}

export function makeVerb(obj : Obj) : Verb {
   const builder = new VerbBuilder(getString(obj["id"]));
   ifExists(obj["name"], value => builder.withName(getString(value)));
   forEach(obj["modifiers"], modifier => builder.withModifier(getString(modifier)));
   forEach(obj["attributes"], attribute => builder.withAttribute(getString(attribute)));
   forEach(obj["tags"],
        tag => {
            switch(tag) {
              case 'transitive':
                builder.withTrait(VerbTrait.Transitive);
                break;
              case 'intransitive':
                builder.withTrait(VerbTrait.Intransitive);
                break;
              default:
                break;
    }});
   return builder.build();
}

export function makeEntity(obj : Obj) : Entity {
    const builder = new EntityBuilder(obj);
    makeEntityVerbs(builder, obj)
    return builder.build();
}

export function makeRoom(obj : Obj) : Entity {
    const builder = new EntityBuilder(obj);
    makeEntityVerbs(builder, obj);
    builder.withVerb("go");
    for(const [dir, dest] of Object.entries(obj["exits"] ?? {})) {
        builder.withVerbModifier("direction", dir);
        builder.withAction(createMoveToAction(dir, dest));
    }
    return builder.build();
}

function createMoveToAction(dir : string, dest : string) : Action {
    const matcher = getMatcher([match("go"), match(dir)]);
    const bindings = new ObjBuilder().with("dest", dest).build()
    const action = (env : Env) => env.execute("moveTo", bindings);
    return {
      matcher : matcher,
      action : action
    }
}

function makeEntityVerbs(builder : EntityBuilder, obj : Obj) {
    forEach(obj["verbs"], verb => {
        const components = getString(verb).split(".", 2);
        if (components.length == 2) {
            builder.withAttributedVerb(components[0], components[1])
        } else {
            builder.withVerb(components[0]);
        }
    });
    forEachEntry(obj["modifiers"], (type, mods) => {
        forEach(mods, mod => builder.withVerbModifier(type, getString(mod)))
    });
}
