import { Verb, VerbBuilder, VerbTrait } from "./verb";
import { Entity, EntityBuilder } from "./entity";
import { getString, forEach, forEachEntry, ifExists } from "./obj";
import { BasicEngine, Engine, EngineState } from "./engine";
import { DEFAULT_VERBS } from "./enginedefault";
import { getObjs } from "./yamlparser";
import { Env, Obj } from "./env"
import { OutputConsumer } from "./messages/output";
import _ from "lodash";
import { parse } from "./script/parser";
import { matchBuilder, matchModifier, matchVerb } from "./commandmatcher";
import { EnvFn, mkResult, mkThunk, Thunk } from "./script/thunk";
import { createMatcherThunk } from "./script/matchParser";

export class EngineBuilder {
    private outputConsumer? : OutputConsumer;
    private verbs : Verb[] = [];
    private entities : Entity[] = [];
    private objs : Obj[] = [];

    constructor() {
        DEFAULT_VERBS.forEach(verb => this.verbs.push(verb));
    }

    withOutput(outputConsumer : OutputConsumer) {
        this.outputConsumer = outputConsumer;
        return this;
    }
     
    withObj(obj : Obj) : EngineBuilder {
        switch(obj["type"]) {
            case "room":
                this.entities.push(makeRoom(obj));
                break;
            case "object":
            case "item":
                this.entities.push(makeItem(obj));
                break;
            case "verb":
                this.verbs.push(makeVerb(obj));
                break;
            case "rule":
                this.objs.push(makeRule(obj));
                break;
            default:
                throw new Error("Unknown object type");
        }
        return this;
    }

    build() : Engine & EngineState {
        if (!this.outputConsumer) {
            throw new Error("No output counsumer specified")
        }
        return new BasicEngine(this.entities, this.verbs, this.outputConsumer, this.objs);
    }
    
}

export function loadFromYaml(data: string, outputConsumer : OutputConsumer) : Engine & EngineState {
    const objs = getObjs(data);
    const builder = new EngineBuilder().withOutput(outputConsumer);
    objs.forEach(obj => builder.withObj(obj));
    return builder.build();
}

export function makeVerb(obj : Obj) : Verb {
   const builder = new VerbBuilder(obj);
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

// This is only called from tests
export function makeEntity(obj : Obj) : Entity {
    const builder = new EntityBuilder(obj);
    makeEntityVerbs(builder, obj)
    return builder.build();
}

export function makeItem(obj : Obj) : Entity {
    const builder = new EntityBuilder(obj);
    const tags = obj?.tags ?? [];
    if (tags.includes("carryable")) {
        builder.withVerb("get");
        builder.withVerb("drop");
    }
    return builder.build();
}

export function makeRoom(obj : Obj) : Entity {
    const builder = new EntityBuilder(obj);
    makeEntityVerbs(builder, obj);
    builder.withVerb("go");
    for(const [dir, dest] of Object.entries(obj["exits"] ?? {})) {
        if (typeof dest !== "string") {
            throw new Error(obj.id + " contains invalid destination for: " + dir);
        }
        builder.withVerbModifier("direction", dir);
        builder.withAction(createMoveToAction(dir, dest));
    }
    builder.withVerb("look");
    return builder.build();
}

export function makeRule(obj : Obj) : Obj {
    const runValue = obj["run"];
    if (!_.has(obj,"run")) {
        throw new Error("Rule " + obj["id"] + " has no 'run' property")
    }
    const expressions = _.isArray(runValue) ? runValue : [runValue];
    const compiled = expressions.map((expr, index) => parse(expr, obj["id"] + ".run[" + index + "]"));
    obj["__COMPILED__"] = compiled;
    return obj;
}

function createMoveToAction(dir : string, dest : string) : Thunk {
    const matcher = matchBuilder().withVerb(matchVerb("go")).withModifier(matchModifier("direction", dir)).build();
    const action : EnvFn = (env : Env) => {
        env.execute("moveTo", {"dest" : dest});
        return mkResult(true);
    }
    return createMatcherThunk(matcher, mkThunk(action));
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