import * as YamlParser from "../src/yamlparser"

test("test null objects", () => {
    const objs = YamlParser.loadObjs("test/resources/nullentries.yaml");

    expect(objs.length).toBe(3);
})