import { Verb } from "../verb";
import { VerbBuilder } from "./verbbuilder";
import { EntityBuilder } from "./entitybuilder";
import { Entity } from "../entity";
import { getString, forEach, forEachEntry, ifExists, getObj } from "../util/objects";
import { BasicEngine, EngineState } from "../engine";
import { Engine } from "tift-types/src/engine";
import { getObjs } from "../yamlparser";
import { Obj } from "../util/objects"
import { OutputConsumer } from "tift-types/src/messages/output";
import _ from "lodash";
import { Phase, PhaseAction, phaseActionBuilder, PhaseActionType } from "../script/phaseaction";
import * as RuleBuilder from "./rulebuilder";
import { getDefaultGameBehaviour } from "./behaviour";
import { Config, ConfigValueType } from "../config";
import * as Location from "./locations";
import { Env } from "tift-types/src/env";
import { getDefaultVerbs } from "./defaultverbs";
import * as Entities from "./entities";
import { parseToThunk } from "../script/parser";

type ActionerBuilder = VerbBuilder | EntityBuilder;

export class EngineBuilder {
    private outputConsumer? : OutputConsumer;
    objs : Obj[] = [];
    config : Config = {};

    //constructor() {
    //    DEFAULT_VERBS.forEach(verb => this.objs.push(verb));
    //}

    withOutput(outputConsumer : OutputConsumer) {
        this.outputConsumer = outputConsumer;
        return this;
    }
     
    withObj(obj : Obj) : EngineBuilder {
        try {
            switch(obj["type"]) {
                case "room":
                    this.objs.push(makeRoom(obj));
                    break;
                case "object":
                case "item":
                    this.objs.push(makeItem(obj));
                    break;
                case "verb":
                    this.objs.push(makeVerb(obj));
                    break;
                case "rule":
                    this.objs.push(obj);
                    break;
                case "property":
                case "metadata":
                case "global":
                    this.objs.push(obj);
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
        engine.addContent(env => this.addToEnv(env));
    }

    addToEnv(env : Env) : Obj[] {
        const objs = [...this.objs];
        const defaults : Obj[] = [];
        const metadata = objs.find(obj => obj["id"] === "__metadata__");
        if (metadata) {
            const options = metadata["options"] ?? [];
            if (options.includes('useDefaultVerbs')) {
                defaults.push(...getDefaultVerbs(env));
            }
        }
        return [...defaults, ...objs];
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
    if (tags.includes("NPC")) {
        if (!obj["onMove(newLoc)"]) {
            builder.withProp("onMove(newLoc)", Location.makeOnMove());
        }
    }
    if (tags.includes("visibleWhenDark")) {
        if (!obj["visibleWhen()"]) {
            builder.withProp("visibleWhen()", Entities.makeVisibleWhenDarkFn());
        }
    }
    if (tags.includes("openable")) {
        addOpenClose(builder, false);
    }
    if (tags.includes("closable")) {
        addOpenClose(builder, true);
    }
    return builder.build();
}

function addOpenClose(builder : EntityBuilder, isOpen : boolean) {
    builder.withVerbMatcher({ verb : "open", condition : parseToThunk("is_open == false") });
    builder.withVerbMatcher({ verb : "close", condition : parseToThunk("is_open == true") });
    builder.withProp("is_open", isOpen);
}

export function makeRoom(obj : Obj) : Entity {
    const builder = new EntityBuilder(obj);
    makeEntityVerbs(builder, obj);
    addActions(builder, obj);
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