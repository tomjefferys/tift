import * as _ from "lodash"

export const AUTO_LOOK = "autoLook";

export type ConfigValueType = boolean | number | string | undefined;

export interface Config {
    undoLevels? : number,
    [key : string] : ConfigValueType
 }

export function getOrDefault(config : Config, key : string, defaultValue? : ConfigValueType) {
    return _.get(config, key, defaultValue);
}

export function getBoolean(config : Config, key : string, defaultValue = false) : boolean {
    return Boolean(_.get(config, key, defaultValue));
}