/**
 * Utilities for access properties.  These are the games defaults.
 */
import { isFound, isNotFound } from "./env";
import { parsePath } from "./script/pathparser";
import { property } from "./path";
import { Path } from "tift-types/src/path";
import _ from "lodash";
import { Env } from "tift-types/src/env";
import { Optional } from "tift-types/src/util/optional";


const PROPS_KEY = property("properties");

export function getProperty<T>(env : Env, path : string, defaultValue : Optional<T> = undefined) : T {
    return getPropertyByPath(env, parsePath(path), defaultValue);
}

function getPropertyByPath<T>(env : Env, path : Path, defaultValue : Optional<T> = undefined) : T {
    const fullPath : Path = [PROPS_KEY, ...path];
    let value = env.get(fullPath);
    if(isNotFound(value)) {
        const parent = env.getParent();
        if (parent) {
            value = getPropertyByPath(parent, path, defaultValue);
        } else if (defaultValue) {
            value = defaultValue;
        } else {
            throw new Error(`property ${path} could not be found`);
        }
    }
    return value;
}

export function getPropertyString(env : Env, path : string, defaultValue : Optional<string> = undefined) : string {
    const value = getProperty(env, path, defaultValue);
    if (!_.isString(value)) {
        throw new Error(`property ${path} is not a string`);
    }
    return value as string;
}

export function setProperty<T>(env : Env, path : string, value : T) : void {
    setPropertyByPath(env, parsePath(path), value);
}

function setPropertyByPath(env : Env, path : Path, value : unknown) : void {
    env.set([PROPS_KEY, ...path], value);
}

export function setProperties(env : Env, path : string, values : object) : void {
    const basePath = parsePath(path)
    if (pathExists(env, basePath)) {
        const property = getPropertyByPath(env, basePath);
        if (_.isObject(property)) {
            const leaves = getLeaves(values);
            leaves.forEach(([path, value]) => setPropertyByPath(env, [...basePath, ...path],value));
        } else {
            throw new Error(`property ${path} is not an object`);
        }
    } else {
        // base path doesn't exist, so nothing to overwrite
        setPropertyByPath(env, basePath, values);
    }
}

function getLeaves(tree : object) : [Path, unknown][] {
    const leaves : [Path, unknown][] = [];
    Object.entries(tree).forEach(
        ([name, value]) => {
            const path = parsePath(name);
            if (_.isObject(value)) {
                const branchLeaves = getLeaves(value);
                branchLeaves.forEach(
                    ([branchPath, value]) => {
                        leaves.push([[...path, ...branchPath], value]);
                    }
                )
            } else {
                leaves.push([path, value]);
            }
        }
    )
    return leaves;
}

function pathExists(env : Env, path : Path) : boolean {
    const fullPath : Path = [PROPS_KEY, ...path];
    const value = env.get(fullPath);
    return isFound(value);
}