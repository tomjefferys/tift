import { Verb } from "../verb";
import { VerbBuilder } from "./verbbuilder";
import { EntityBuilder } from "./entitybuilder";
import { Entity, buildVerbModifier } from "../entity";
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
import { Env } from "tift-types/src/env";
import { getDefaultVerbs } from "./defaultverbs";
import { TRAITS } from "./traits/trait";
import * as Entities from "./entities";
import * as Metadata from "./metadata";
import * as Tags from "./tags";
import * as Path from "../path";
import * as Errors from "../util/errors";
import { Thunk, mkResult, mkThunk } from "../script/thunk";


type ActionerBuilder = VerbBuilder | EntityBuilder;

export class EngineBuilder {
    private outputConsumer? : OutputConsumer;
    objs : Obj[] = [];
    config : Config = {};

    withOutput(outputConsumer : OutputConsumer) {
        this.outputConsumer = outputConsumer;
        return this;
    }
     
    withObj(obj : Obj) : EngineBuilder {
        try {
            switch(obj["type"]) {
                case Entities.Types.ROOM:
                    this.objs.push(makeRoom(obj));
                    break;
                case Entities.Types.OBJECT:
                case Entities.Types.ITEM:
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
            Errors.throwError("Error building '" + obj["id"] + "'", e);
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
        const metadata = objs.find(obj => obj["id"] === Metadata.KEY);
        if (metadata && Metadata.hasOption(metadata, "useDefaultVerbs")) {
            defaults.push(...getDefaultVerbs(env));
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
   forEach(obj["contexts"], context => builder.withContext(getString(context)));
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
    makeEntityVerbs(builder, obj);
    makeEntityVerbModifiers(builder, obj);  
    return builder.build();
}

export function makeItem(obj : Obj) : Entity {
    const builder = new EntityBuilder(obj);
    addVerbsAndActions(builder, obj);
    const tags = obj?.tags ?? [] as string[];

    TRAITS.forEach(trait => trait(obj, tags, builder));

    return builder.build();
}

export function makeRoom(obj : Obj) : Entity {
    const builder = new EntityBuilder(obj);
    addVerbsAndActions(builder, obj);
    let allExitsConditional = true;
    const exitConditions : Thunk[] = [];

    // Add the exit directions as verb modifiers
    for(const [dir, dest] of Object.entries(obj["exits"] ?? {})) {
        const path = Path.of([obj.id, "exits", dir]);
        if (_.isString(dest)) {
            builder.withVerbModifier(buildVerbModifier("direction", dir));
            allExitsConditional = false;
        } else if (_.isPlainObject(dest)) {
            Object.entries(getObj(dest))
                  .forEach(([key,value]) => {
                    const condition = RuleBuilder.evaluateRule(value, Path.concat(path, key));
                    exitConditions.push(condition);
                    builder.withVerbModifier(buildVerbModifier("direction", dir, condition));
                  });
        } else {
            Errors.throwError("Invalid exit entry, must be string or object", path);
        }
    }

    // Combine multiple exit conditions into one 'or' condition
    const combineExitConditions = (thunks : Thunk[]) => {
        return mkThunk(env => {
            const result = thunks.reduce(
                (anyTrue, thunk) => anyTrue || !!thunk.resolve(env).getValue(), false);
            return mkResult(result);
        });
    };

    // Add the 'go' and 'look' verbs
    const tags = obj?.tags ?? [];
    if (!tags.includes(Tags.PSEUDO_ROOM)) {
        if (allExitsConditional && exitConditions.length > 0) {
            const verbCondition = combineExitConditions(exitConditions);
            builder.withVerbMatcher({ verb: "go", condition: verbCondition });
        } else {
            builder.withVerb("go");
        }
        builder.withVerb("look");
    }
    return builder.build();
}


function addVerbsAndActions(builder : (EntityBuilder & ActionerBuilder), obj : Obj) {
    makeEntityVerbs(builder, obj);
    makeEntityVerbModifiers(builder, obj);
    addActions(builder, obj);
};

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
    const pathPrefix = Path.of([obj.id, field]);
    const fieldActionPath = (index : number) => Path.concat(pathPrefix, index);
    const actionIsString = (value : unknown, index : number) : value is string =>  {
        if (!_.isString(value)) {
            Errors.throwError(`Expecting string whilst parsing actions, but found: ${JSON.stringify(value)}`, [...pathPrefix, index]);
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
            Errors.throwError(`Unsupported type: ${JSON.stringify(actionData)}`, pathPrefix);
        }
    }
    return phaseActions as PhaseActionType<T>[];
}

function makeEntityVerbs(builder : EntityBuilder, obj : Obj) {
    forEach(obj["verbs"], (verbEntry, index) => {
        const path = Path.of([obj.id,"verbs",index]);
        if (_.isString(verbEntry)) {
            const [verb, attribute] = getString(verbEntry).split(".", 2);
            builder.withVerbMatcher({verb, attribute, condition : undefined});
        } else if (_.isPlainObject(verbEntry)) {
            Object.entries(getObj(verbEntry))
                  .forEach(([key,value]) => {
                    const condition = RuleBuilder.evaluateRule(value, Path.concat(path, key));
                    const [verb,attribute] = getString(key).split(".", 2);
                    builder.withVerbMatcher({verb, attribute, condition});
                  });
        } else {
            Errors.throwError("Invalid verb entry, must be string or object", path);
        }
    });
}

function makeEntityVerbModifiers(builder : EntityBuilder, obj : Obj) {
    forEachEntry(obj["modifiers"], (type, mods) => {
        forEach(mods, mod => {
            const path = Path.of([obj.id, "modifiers", type]);
            if (_.isString(mod)) {
                builder.withVerbModifier(buildVerbModifier(type, getString(mod)));
            } else if (_.isPlainObject(mod)) {
                Object.entries(getObj(mod))
                      .forEach(([key,value]) => {
                        const condition = RuleBuilder.evaluateRule(value, Path.concat(path, key));
                        builder.withVerbModifier(buildVerbModifier(type, key, condition));
                      });
            } else {
                Errors.throwError("Invalid modifier entry, must be string or object", path);
            }
        });
    });
}