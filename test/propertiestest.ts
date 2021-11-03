import {parseProperties} from "../src/properties";

test("Test empty string", () => { 
  expect(parseProperties([])).toStrictEqual(new Map());
}) 

test("Test simple string property parsing", () => {

  expect(parseProperties(["key:value"]))
    .toStrictEqual(new Map([["key","value"]]));

  expect(parseProperties(["key: value"]))
    .toStrictEqual(new Map([["key","value"]]));

  expect(parseProperties(["key:  value"]))
      .toStrictEqual(new Map([["key","value"]]));

  expect(parseProperties(["key :value"]))
      .toStrictEqual(new Map([["key","value"]]));

  expect(parseProperties(["key  :value"]))
      .toStrictEqual(new Map([["key","value"]]));
    
  expect(parseProperties(["key  :value"]))
      .toStrictEqual(new Map([["key","value"]]));

  expect(parseProperties(["key : value"]))
      .toStrictEqual(new Map([["key","value"]]));

  expect(parseProperties(["key  :  value"]))
      .toStrictEqual(new Map([["key","value"]]));
});

test("Test multiword string property", () => {
  expect(parseProperties(["key : one two three"]))
    .toStrictEqual(new Map([["key", "one two three"]]));
});

test("Test multiple properties", () => {
  expect(parseProperties(["prop1:value1",
                          "prop2: value2",
                          "prop3:  value3",
                          "prop4 :value4",
                          "prop5  :value5",
                          "prop6 : value6",
                          "prop7  :  value7"]))
    .toStrictEqual(new Map([["prop1","value1"],
                            ["prop2","value2"],
                            ["prop3","value3"],
                            ["prop4","value4"],
                            ["prop5","value5"],
                            ["prop6","value6"],
                            ["prop7","value7"]]));

});

test("Test multi line string property", () => {
  expect(parseProperties(["prop1:value1",
                          "prop2:value2",
                          "      value3",
                          "      value4",
                          "prop3: value5",
                          "      value6"]))
    .toStrictEqual(new Map([["prop1","value1"],
                            ["prop2","value2 value3 value4"],
                            ["prop3","value5 value6"]]));

});

test("Test simple object property", () => {
  expect(parseProperties(["myobj:",
                          "  prop1: value1", 
                          "  prop2: value2"]))
    .toStrictEqual(new Map([["myobj", 
                    new Map([["prop1","value1"],
                             ["prop2","value2"]])]]));


});
