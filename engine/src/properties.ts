/**
 * Utilities for access properties.  These are the games defaults.
 */
import { isFound, isNotFound } from "./env";
import { parsePath } from "./script/pathparser";
import { property } from "./path";
import { Path } from "tift-types/src/path";
import _ from "lodash";
import { Env } from "tift-types/src/env";


const PROPS_KEY = property("properties");

export function getProperty(env : Env, path : string) : unknown {
    return getPropertyByPath(env, parsePath(path));
}

function getPropertyByPath(env : Env, path : Path) {
    const fullPath : Path = [PROPS_KEY, ...path];
    const value = env.get(fullPath);
    if(isNotFound(value)) {
        throw new Error(`property ${path} could not be found`);
    }
    return value;
}

export function getPropertyString(env : Env, path : string) : string {
    const value = getProperty(env, path);
    if (!_.isString(value)) {
        throw new Error(`property ${path} is not a string`);
    }
    return value as string;
}

export function setProperty(env : Env, path : string, value : unknown) : void {
    setPropertyByPath(env, parsePath(path), value);
    //env.set([PROPS_KEY, ...parsePath(path)], value);
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