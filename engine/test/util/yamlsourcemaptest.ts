import { getSourceMap, getSourceLocation } from "../../src/util/yamlsourcemap";
import dedent from "dedent-js";
import * as YAML from "yaml";

test("test simple", () => {
    const yaml = dedent(`
        foo: bar
        baz: qux
    `);

    const lc = new YAML.LineCounter();

    const doc = YAML.parseDocument(yaml, { lineCounter : lc});
    const sourceMap = getSourceMap(doc, lc);

    expect(sourceMap.map["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap.map["baz"]).toStrictEqual({line: 2, col: 1});
});

test("test nested", () => {
    const yaml = dedent(`
        foo:
          bar: baz
    `);

    const lc = new YAML.LineCounter();

    const doc = YAML.parseDocument(yaml, { lineCounter : lc});
    const sourceMap = getSourceMap(doc, lc);

    expect(sourceMap.map["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap.map["foo.bar"]).toStrictEqual({line: 2, col: 3});
});

test("test double nested", () =>  {
    const yaml = dedent(`
        foo:
          bar:
            baz: qux
    `);

    const lc = new YAML.LineCounter();

    const doc = YAML.parseDocument(yaml, { lineCounter : lc});
    const sourceMap = getSourceMap(doc, lc);

    expect(sourceMap.map["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap.map["foo.bar"]).toStrictEqual({line: 2, col: 3});
    expect(sourceMap.map["foo.bar.baz"]).toStrictEqual({line: 3, col: 5});
});

test("test array", () => {
    const yaml = dedent(`
        foo:
          - bar
          - baz
    `);

    const lc = new YAML.LineCounter();

    const doc = YAML.parseDocument(yaml, { lineCounter : lc});
    const sourceMap = getSourceMap(doc, lc);

    expect(sourceMap.map["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap.map["foo.0"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap.map["foo.1"]).toStrictEqual({line: 3, col: 5});
});

test("test array of objects", () => {
    const yaml = dedent(`
        foo:
          - bar: baz
            qux: quux
    `);

    const lc = new YAML.LineCounter();

    const doc = YAML.parseDocument(yaml, { lineCounter : lc});
    const sourceMap = getSourceMap(doc, lc);

    expect(sourceMap.map["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap.map["foo.0"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap.map["foo.0.bar"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap.map["foo.0.qux"]).toStrictEqual({line: 3, col: 5});
});

test("test array of objects with nested objects", () => {
    const yaml = dedent(`
        foo:
          - bar:
              baz: qux
              quux: corge
    `);

    const lc = new YAML.LineCounter();

    const doc = YAML.parseDocument(yaml, { lineCounter : lc});
    const sourceMap = getSourceMap(doc, lc);

    expect(sourceMap.map["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap.map["foo.0"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap.map["foo.0.bar"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap.map["foo.0.bar.baz"]).toStrictEqual({line: 3, col: 7});
    expect(sourceMap.map["foo.0.bar.quux"]).toStrictEqual({line: 4, col: 7});
});

test("test array of objects with nested objects and arrays", () => {
    const yaml = dedent(`
        foo:
          - bar:
              baz: qux
              quux:
                - corge
                - grault
    `);

    const lc = new YAML.LineCounter();

    const doc = YAML.parseDocument(yaml, { lineCounter : lc});
    const sourceMap = getSourceMap(doc, lc);

    expect(sourceMap.map["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap.map["foo.0"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap.map["foo.0.bar"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap.map["foo.0.bar.baz"]).toStrictEqual({line: 3, col: 7});
    expect(sourceMap.map["foo.0.bar.quux"]).toStrictEqual({line: 4, col: 7});
    expect(sourceMap.map["foo.0.bar.quux.0"]).toStrictEqual({line: 5, col: 11});
    expect(sourceMap.map["foo.0.bar.quux.1"]).toStrictEqual({line: 6, col: 11});
});

test("test json style arrays", () => {
    const yaml = dedent(`
        foo: [bar, baz]
    `);
    
    const lc = new YAML.LineCounter();

    const doc = YAML.parseDocument(yaml, { lineCounter : lc});
    const sourceMap = getSourceMap(doc, lc);
    
    expect(sourceMap.map["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap.map["foo.0"]).toStrictEqual({line: 1, col: 7});
    expect(sourceMap.map["foo.1"]).toStrictEqual({line: 1, col: 12});
});

test("test with comments", () => { 
    const yaml = dedent(`
        # start
        foo: # comment
          bar: baz
    `);

    const lc = new YAML.LineCounter();

    const doc = YAML.parseDocument(yaml, { lineCounter : lc});
    const sourceMap = getSourceMap(doc, lc);

    expect(sourceMap.map["foo"]).toStrictEqual({line: 2, col: 1});
    expect(sourceMap.map["foo.bar"]).toStrictEqual({line: 3, col: 3});
});

test("test with file comment", () => {
    const yaml = dedent(`
        --- # file:src/foo/bar.yaml
        foo: bar
        baz: qux 
        `)

    const lc =  new YAML.LineCounter();
    const doc = YAML.parseDocument(yaml, { lineCounter : lc});
    const sourceMap = getSourceMap(doc, lc);

    expect(getSourceLocation(sourceMap, "foo")).toStrictEqual({line: 1, col: 1, file: "src/foo/bar.yaml"});
    expect(getSourceLocation(sourceMap, "baz")).toStrictEqual({line: 2, col: 1, file: "src/foo/bar.yaml"});

    //Check we're not storing the file comment in the map
    expect(sourceMap.map["foo"].file).toBeUndefined();
    expect(sourceMap.map["baz"].file).toBeUndefined();
});

test("test multiple file comments", () => {
    const yaml = dedent(`
        --- # file:src/foo/bar.yaml
        foo: bar
        baz: qux 
        --- # file:  src/foo/baz.yaml
        corge: grault
        garply: waldo
        `)
    
    const lc = new YAML.LineCounter();
    const docs = YAML.parseAllDocuments(yaml, { lineCounter : lc});

    expect(docs.length).toBe(2);

    const sourceMap1 = getSourceMap(docs[0], lc);
    expect(getSourceLocation(sourceMap1, "foo")).toStrictEqual({line: 1, col: 1, file: "src/foo/bar.yaml"});
    expect(getSourceLocation(sourceMap1, "baz")).toStrictEqual({line: 2, col: 1, file: "src/foo/bar.yaml"});

    // Check we're not storing the file comment in the map
    expect(sourceMap1.map["foo"].file).toBeUndefined();
    expect(sourceMap1.map["baz"].file).toBeUndefined();

    const sourceMap2 = getSourceMap(docs[1], lc);
    expect(getSourceLocation(sourceMap2, "corge")).toStrictEqual({line: 1, col: 1, file: "src/foo/baz.yaml"});
    expect(getSourceLocation(sourceMap2, "garply")).toStrictEqual({line: 2, col: 1, file: "src/foo/baz.yaml"});
    
    // Check we're not storing the file comment in the map
    expect(sourceMap2.map["corge"].file).toBeUndefined();
    expect(sourceMap2.map["garply"].file).toBeUndefined();
});

test("Test multiple file comments in same document", () => {
    const yaml = dedent(`
        --- # file:src/foo/bar.yaml
        foo: bar
        # file: src/foo/baz.yaml[]
        baz: qux 
        `);

    const lc = new YAML.LineCounter();

    const docs = YAML.parseAllDocuments(yaml, { lineCounter : lc});

    expect(docs.length).toBe(1);

    expect(() => getSourceMap(docs[0], lc)).toThrowError();
});