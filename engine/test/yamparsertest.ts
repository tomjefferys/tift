import * as YamlParser from "../src/yamlparser"
import * as fs from "fs"

test("test null objects", () => {
    const data = fs.readFileSync("test/resources/nullentries.yaml", "utf8");
    const objs = YamlParser.getObjs(data);
    expect(objs.length).toBe(3);
})