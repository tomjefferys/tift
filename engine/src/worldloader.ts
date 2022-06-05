import * as YAML from "./yamlparser"

export function loadWorld(filename: string) {
    YAML.loadObjs(filename);
}