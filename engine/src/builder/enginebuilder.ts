import { Verb } from "../verb";
import { VerbBuilder } from "./verbbuilder";
import { EntityBuilder } from "./entitybuilder";
import { Entity } from "../entity";
import { getString, forEach, forEachEntry, ifExists, getObj } from "../util/objects";
import { BasicEngine, EngineState } from "../engine";
import { Engine } from "tift-types/src/engine";
import { DEFAULT_VERBS } from "./defaultverbs";
import { getObjs } from "../yamlparser";
import { Obj } from "../util/objects"
import { OutputConsumer } from "tift-types/src/messages/output";
import _ from "lodash";
import { Phase, PhaseAction, phaseActionBuilder, PhaseActionType } from "../script/phaseaction";
import * as RuleBuilder from "./rulebuilder";
import { Env } from "tift-types/src/env";
import { getDefaultGameBehaviour } from "./behaviour";
import { Config, ConfigValueType } from "../config";

type ActionerBuilder = VerbBuilder | EntityBuilder;

export class EngineBuilder {
    private outputConsumer? : OutputConsumer;
    verbs : Verb[] = [];
    entities : Entity[] = [];
    objs : Obj[] = [];
    config : Config = {};

    constructor() {
        DEFAULT_VERBS.forEach(verb => this.verbs.push(verb));
    }

    withOutput(outputConsumer : OutputConsumer) {
        this.outputConsumer = outputConsumer;
        return this;
    }
     
    withObj(obj : Obj) : EngineBuilder {
        try {
            //compileFunctions(obj);
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
        } catch (e) {
            throw new Error("Error building '" + obj["id"] + "'\n" + (e as Error).message);
        }
        return this;
    }

    withConfigEntry(name : string, value : ConfigValueType) : EngineBuilder {
        this.config[name] = value;
        return this;
    }

    withConfig(config : Config) : EngineBuilder {
        Object.assign(this.config, config);
        return this;
    }

    fromYaml(data : string) {
        const objs = getObjs(data);
        objs.forEach(obj => this.withObj(obj));
    }

    build() : Engine & EngineState {
        if (!this.outputConsumer) {
            throw new Error("No output counsumer specified")
        }
        const engine = new BasicEngine(getDefaultGameBehaviour(), this.outputConsumer, this.config);
        this.addTo(engine);
        return engine;
    }
    
    addTo(engine : BasicEngine) {
        engine.addContent(this.entities, this.verbs, this.objs);
    }
}

export function loadFromYaml(data: string, outputConsumer : OutputConsumer) : Engine & EngineState {
    const objs = getObjs(data);
    const builder = new EngineBuilder().withOutput(outputConsumer);
    objs.forEach(obj => builder.withObj(obj));
    return builder.build();
}

export function addFromYaml(engine : Engine, data : string) {
    const objs = getObjs(data);
    const builder = new EngineBuilder();
    objs.forEach(obj => builder.withObj(obj));

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
                builder.withTrait("transitive");
                break;
              case 'intransitive':
                builder.withTrait("intransitive");
                break;
              default:
                break;
    }});
    addActions(builder, obj);
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
    makeEntityVerbs(builder, obj);
    addActions(builder, obj);
    addRules(builder, obj);
    const tags = obj?.tags ?? [];
    if (tags.includes("carryable")) {
        builder.withVerb("get");
        builder.withVerb("drop");
        builder.withVerb("put");
    }
    if (tags.includes("wearable")) {
        builder.withVerb("wear");
        builder.withVerb("remove");
    }
    if (tags.includes("pushable")) {
        builder.withVerb("push");
    }
    if (_.has(obj, "desc")) {
        builder.withVerb("examine");
    }
    return builder.build();
}

export function makeRoom(obj : Obj) : Entity {
    const builder = new EntityBuilder(obj);
    makeEntityVerbs(builder, obj);
    addActions(builder, obj);
    addRules(builder, obj);
    builder.withVerb("go");
    for(const [dir, dest] of Object.entries(obj["exits"] ?? {})) {
        if (typeof dest !== "string") {
            throw new Error(obj.id + " contains invalid destination for: " + dir);
        }
        builder.withVerbModifier("direction", dir);
    }
    builder.withVerb("look");
    return builder.build();
}

export function makeRule(obj : Obj) : Obj {
    const thunk = RuleBuilder.evaluateRule(obj, `${obj.id}`);
    obj["__COMPILED__"] = (env : Env) => thunk.resolve(env).getValue();
    return obj;
}

/**
 * Compiles any rules attached to an object, or room.
 * These are executed every turn whilst the object is
 * in context
 * @param obj 
 * 
 * could be ["rule1", "rule2v"]
 * or [{"repeat" : ["rule1", "rule2"]}, "rule3"]
 * or [{"random" : ["rule1", "rule2"]}]
 * or [{"repeat" : { "random" : "rule1", "rule2"}}]
 */
function addRules(builder : EntityBuilder, obj : Obj) {
    const rules = obj["rules"];
    if (rules) {
        const thunk = RuleBuilder.evaluateRule(rules, obj["id"] + ".rules");
        builder.withRule(env => thunk.resolve(env).getValue());
    }
}


function addActions(builder : ActionerBuilder, obj : Obj) {
    getActionStrings(obj, "before", "before")
        .forEach(beforeAction => builder.withBefore(beforeAction));

    getActionStrings(obj, "actions", "main")
        .forEach(mainAction => builder.withAction(mainAction));

    getActionStrings(obj, "after", "after")
        .forEach(mainAction => builder.withAfter(mainAction));
}

function getActionStrings<T extends Phase>(obj : Obj, field : string, phase : T) : PhaseActionType<T>[] {
    const actionData = obj[field];
    let phaseActions : PhaseAction[] = [];
    const fieldPath = obj.id + "." + field;
    const fieldActionPath = (index : number) => fieldPath + "[" + index + "]";
    const actionIsString = (value : unknown, index : number) : value is string =>  {
        if (!_.isString(value)) {
            throw new Error("Non string found whilst parsing: " + fieldPath + "[" + index + "]" + "\n" + JSON.stringify(value));
        }
        return true;
    }
    const buildPhaseAction = (index : number) => phaseActionBuilder(fieldActionPath(index)).withPhase(phase);

    if (actionData) {
        if (_.isString(actionData)) {
            phaseActions = [buildPhaseAction(0).withExpression(actionData)];
        } else if (_.isArray(actionData)) {
            phaseActions = actionData.filter(actionIsString)
                                     .map((actionExpr, index) => buildPhaseAction(index).withExpression(actionExpr));
        } else if (_.isPlainObject(actionData)) {
            phaseActions = Object.entries(actionData)
                                 .map(([key,value], index) =>  buildPhaseAction(index).withMatcherAndCommand(key,value));
        } else {
            throw new Error("'" + fieldPath + "' is an unsupported type:\n" + JSON.stringify(actionData));
        }
    }
    return phaseActions as PhaseActionType<T>[];
}

function makeEntityVerbs(builder : EntityBuilder, obj : Obj) {

    forEach(obj["verbs"], (verbEntry, index) => {
        const path = `${obj.id}.verbs[${index}]`;
        if (_.isString(verbEntry)) {
            const [verb, attribute] = getString(verbEntry).split(".", 2);
            builder.withVerbMatcher({verb, attribute, condition : undefined});
        } else if (_.isPlainObject(verbEntry)) {
            Object.entries(getObj(verbEntry))
                  .forEach(([key,value]) => {
                    const condition = RuleBuilder.evaluateRule(value, `${path}.${key}`);
                    const [verb,attribute] = getString(key).split(".", 2);
                    builder.withVerbMatcher({verb, attribute, condition});
                  });
        } else {
            throw new Error(`${path} is not expected type. Must be string or object`);
        }
    });
    forEachEntry(obj["modifiers"], (type, mods) => {
        forEach(mods, mod => builder.withVerbModifier(type, getString(mod)))
    });
}