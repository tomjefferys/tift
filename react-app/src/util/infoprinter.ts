import { DecoratedForwarder } from "tift-types/src/engineproxy";
import { Properties } from "tift-types/src/messages/output";
import _ from "lodash"

// List of info properties to be displayed, and the labels to be used
const DEFAULT_PROPS = {
    "name" : "name",
    "author" : "author",
    "gameId" : "game id",
    "version" : "game version",
    "engineVersion" : "engine version"
};

// List of properties to skip
const SKIP_POPS = ["id", "type", "options"];

/**
 * log the game info, output default properties first, then any remaining ones
 */
export function print(forwarder : DecoratedForwarder, properties : Properties) {
    const writeInfo = (label : string, value : unknown) => 
        forwarder.respond({ type : "Log", level : "info", message : `${label}:  ${value}`});

    Object.entries(DEFAULT_PROPS)
            .filter(([key, _label]) => _.has(properties, key))
            .forEach(([key, label]) => writeInfo(label, _.get(properties, key)));

    Object.entries(properties)
            .filter(([key, _value]) => !_.has(DEFAULT_PROPS, key))
            .filter(([key, _value]) => !SKIP_POPS.includes(key))
            .forEach(([key, value]) => writeInfo(key, value));
}
