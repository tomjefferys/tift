import { Verb, VerbBuilder, VerbTrait } from "./verb";
import { Entity, EntityBuilder } from "./entity";
import { Obj } from "./types";
import { getString, getArray, getObj, forEach, forEachEntry, ifExists } from "./obj";
import { Engine } from "./engine";

class EngineBuilder {
    private verbs : Verb[] = [];
    private entities : Entity[] = [];
     
    withObj(obj : Obj) : EngineBuilder {
        switch(obj["type"]) {
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

    build() : Engine {
        return {
            getWords : (partial) => [],
            execute : (command) => {}
        };
    }
    
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
    const builder = new EntityBuilder(getString(obj["id"]));
    ifExists(obj["name"], value => builder.withName(getString(value)));
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

    return builder.build();
}