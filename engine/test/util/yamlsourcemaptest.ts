import { getSourceMap } from "../../src/util/yamlsourcemap";
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

    expect(sourceMap["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap["baz"]).toStrictEqual({line: 2, col: 1});
});

test("test nested", () => {
    const yaml = dedent(`
        foo:
          bar: baz
    `);

    const lc = new YAML.LineCounter();

    const doc = YAML.parseDocument(yaml, { lineCounter : lc});
    const sourceMap = getSourceMap(doc, lc);

    expect(sourceMap["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap["foo.bar"]).toStrictEqual({line: 2, col: 3});
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

    expect(sourceMap["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap["foo.bar"]).toStrictEqual({line: 2, col: 3});
    expect(sourceMap["foo.bar.baz"]).toStrictEqual({line: 3, col: 5});
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

    expect(sourceMap["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap["foo.0"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap["foo.1"]).toStrictEqual({line: 3, col: 5});
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

    expect(sourceMap["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap["foo.0"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap["foo.0.bar"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap["foo.0.qux"]).toStrictEqual({line: 3, col: 5});
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

    expect(sourceMap["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap["foo.0"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap["foo.0.bar"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap["foo.0.bar.baz"]).toStrictEqual({line: 3, col: 7});
    expect(sourceMap["foo.0.bar.quux"]).toStrictEqual({line: 4, col: 7});
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

    expect(sourceMap["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap["foo.0"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap["foo.0.bar"]).toStrictEqual({line: 2, col: 5});
    expect(sourceMap["foo.0.bar.baz"]).toStrictEqual({line: 3, col: 7});
    expect(sourceMap["foo.0.bar.quux"]).toStrictEqual({line: 4, col: 7});
    expect(sourceMap["foo.0.bar.quux.0"]).toStrictEqual({line: 5, col: 11});
    expect(sourceMap["foo.0.bar.quux.1"]).toStrictEqual({line: 6, col: 11});
});

test("test json style arrays", () => {
    const yaml = dedent(`
        foo: [bar, baz]
    `);
    
    const lc = new YAML.LineCounter();

    const doc = YAML.parseDocument(yaml, { lineCounter : lc});
    const sourceMap = getSourceMap(doc, lc);
    
    expect(sourceMap["foo"]).toStrictEqual({line: 1, col: 1});
    expect(sourceMap["foo.0"]).toStrictEqual({line: 1, col: 7});
    expect(sourceMap["foo.1"]).toStrictEqual({line: 1, col: 12});
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

    expect(sourceMap["foo"]).toStrictEqual({line: 2, col: 1});
    expect(sourceMap["foo.bar"]).toStrictEqual({line: 3, col: 3});
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

    expect(sourceMap["foo"]).toStrictEqual({line: 1, col: 1, file: "src/foo/bar.yaml"});
    expect(sourceMap["baz"]).toStrictEqual({line: 2, col: 1, file: "src/foo/bar.yaml"});
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
    expect(sourceMap1["foo"]).toStrictEqual({line: 1, col: 1, file: "src/foo/bar.yaml"});
    expect(sourceMap1["baz"]).toStrictEqual({line: 2, col: 1, file: "src/foo/bar.yaml"});

    const sourceMap2 = getSourceMap(docs[1], lc);
    expect(sourceMap2["corge"]).toStrictEqual({line: 1, col: 1, file: "src/foo/baz.yaml"});
    expect(sourceMap2["garply"]).toStrictEqual({line: 2, col: 1, file: "src/foo/baz.yaml"});
});