import { Verb, VerbBuilder } from "./verb";
import { Entity, EntityBuilder } from "./entity";
import { getString, forEach, forEachEntry, ifExists } from "./util/objects";
import { BasicEngine, Engine, EngineState } from "./engine";
import { DEFAULT_VERBS } from "./enginedefault";
import { getObjs } from "./yamlparser";
import { Obj } from "./util/objects"
import { OutputConsumer } from "./messages/output";
import _ from "lodash";
import { Phase, PhaseAction, phaseActionBuilder, PhaseActionType } from "./script/phaseaction";
import * as RuleBuilder from "./rulebuilder";

type ActionerBuilder = VerbBuilder | EntityBuilder;

export class EngineBuilder {
    private outputConsumer? : OutputConsumer;
    verbs : Verb[] = [];
    entities : Entity[] = [];
    objs : Obj[] = [];

    constructor() {
        DEFAULT_VERBS.forEach(verb => this.verbs.push(verb));
    }

    withOutput(outputConsumer : OutputConsumer) {
        this.outputConsumer = outputConsumer;
        return this;
    }
     
    withObj(obj : Obj) : EngineBuilder {
        try {
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

    fromYaml(data : string) {
        const objs = getObjs(data);
        objs.forEach(obj => this.withObj(obj));
    }

    build() : Engine & EngineState {
        if (!this.outputConsumer) {
            throw new Error("No output counsumer specified")
        }
        const engine = new BasicEngine(this.outputConsumer);
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
    builder.withVerb("wait");
    return builder.build();
}

export function makeRule(obj : Obj) : Obj {
    const runValue = obj["run"];
    if (!_.has(obj,"run")) {
        throw new Error(`Rule [${obj["id"]}] has no 'run' property`);
    }
    obj["__COMPILED__"] = RuleBuilder.parseRule(runValue, `${obj.id}.run`);
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
        builder.withRule(RuleBuilder.parseRule(rules, obj["id"] + ".rules"));
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
                                 .filter(([_key,value], index) => actionIsString(value, index))
                                 .map(([key,value], index) =>  buildPhaseAction(index).withMatcherAndCommand(key,value as string));
        } else {
            throw new Error("'" + fieldPath + "' is an unsupported type:\n" + JSON.stringify(actionData));
        }
    }
    return phaseActions as PhaseActionType<T>[];
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