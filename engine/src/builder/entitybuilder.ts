
import { AfterAction, MainAction, BeforeAction } from "../script/phaseaction";
import { Obj } from "tift-types/src/util/objects";
import { VerbMatcher, Entity, PROPS } from "../entity";
import { MultiDict } from "../util/multidict";
import { RuleFn } from "../entity";
import { getString, getArray } from "../util/objects";
import { buildVerbMatcher } from "../entity";
import _ from "lodash";

export class EntityBuilder {
  id : string;
  props : Obj;
  verbs : VerbMatcher[] = [];
  verbModifiers : MultiDict<string> = {};
  before : BeforeAction[] = [];
  actions : MainAction[] = [];
  after : AfterAction[] = [];
  rules : RuleFn[] = [];
  
  constructor(props : Obj) {
    if (!props) {
      throw new Error("An Entity must have properties");
    }
    if (!props["id"]) {
      throw new Error("An Entity must have an id property")
    }
    if (props["tags"] && !_.isArray(props["tags"])) {
      throw new Error(`${props["id"]}.tags is not an array`);
    }
    this.props = props;
    this.id = getString(props["id"]);
  }
  
  withVerb(verb: string) : EntityBuilder {
    this.verbs.push(buildVerbMatcher(verb));
    return this;
  }

  withAttributedVerb(verb : string, attribute : string) {
    this.verbs.push(buildVerbMatcher(verb, attribute));
    return this;
  }

  withVerbMatcher(verbMatcher : VerbMatcher) {
    this.verbs.push(verbMatcher);
    return this;
  }

  withVerbModifier(modType : string, value : string) {
    if (!this.verbModifiers[modType]) {
      this.verbModifiers[modType] = [];
    }
    this.verbModifiers[modType].push(value);
    return this;
  }

  withBefore(action : BeforeAction) {
    this.before.push(action);
    return this;
  }

  withAction(action : MainAction) {
    this.actions.push(action);
    return this;
  }

  withAfter(action : AfterAction) {
    this.after.push(action);
    return this;
  }

  withProp(name : string, value : string) {
    this.props[name] = value; 
    return this;
  }

  withTag(tag : string) {
    if (!this.props[PROPS.TAGS]) {
      this.props[PROPS.TAGS] = [];
    }
    getArray(this.props[PROPS.TAGS]).push(tag);
    return this;
  }
  
  withRule(rule : RuleFn) {
    this.rules.push(rule);
  }

  build() : Entity {
    return {...this.props,
            id : this.id,
            verbs : this.verbs,
            verbModifiers : this.verbModifiers,
            before : this.before,
            actions : this.actions,
            after : this.after,
            rules : this.rules };
  }
}
