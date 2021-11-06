import {parseProperties} from "../src/properties";

test("Test empty string", () => { 
  expect(parseProperties([])).toStrictEqual(objToMap({}));
}) 

test("Test simple string property parsing", () => {

  expect(parseProperties(["key:value"]))
    .toStrictEqual(objToMap({"key":"value"}));

  expect(parseProperties(["key: value"]))
    .toStrictEqual(objToMap({"key":"value"}));

  expect(parseProperties(["key:  value"]))
      .toStrictEqual(objToMap({"key":"value"}));

  expect(parseProperties(["key :value"]))
      .toStrictEqual(objToMap({"key":"value"}));

  expect(parseProperties(["key  :value"]))
      .toStrictEqual(objToMap({"key":"value"}));
    
  expect(parseProperties(["key  :value"]))
      .toStrictEqual(objToMap({"key":"value"}));

  expect(parseProperties(["key : value"]))
      .toStrictEqual(objToMap({"key":"value"}));

  expect(parseProperties(["key  :  value"]))
      .toStrictEqual(objToMap({"key":"value"}));
});

test("Test multiword string property", () => {
  expect(parseProperties(["key : one two three"]))
    .toStrictEqual(objToMap({"key": "one two three"}));
});

test("Test multiple properties", () => {
  expect(parseProperties(["prop1:value1",
                          "prop2: value2",
                          "prop3:  value3",
                          "prop4 :value4",
                          "prop5  :value5",
                          "prop6 : value6",
                          "prop7  :  value7"]))
    .toStrictEqual(objToMap(
                    {
                      "prop1":"value1",
                      "prop2":"value2",
                      "prop3":"value3",
                      "prop4":"value4",
                      "prop5":"value5",
                      "prop6":"value6",
                      "prop7":"value7"
                    }));

});

test("Test multi line string property", () => {
  expect(parseProperties(["prop1:value1",
                          "prop2:value2",
                          "      value3",
                          "      value4",
                          "prop3: value5",
                          "      value6"]))
    .toStrictEqual(objToMap(
                    {
                      "prop1":"value1",
                      "prop2":"value2 value3 value4",
                      "prop3":"value5 value6"
                    }));

});

test("Test simple object property", () => {
  expect(parseProperties(["myobj:",
                          "  prop1: value1", 
                          "  prop2: value2"]))
    .toStrictEqual(objToMap(
                    {
                      "myobj": {
                        "prop1": "value1",
                        "prop2": "value2"
                      }
                    }));
});

test("Simple doubly nested objects", () => {
  expect(parseProperties(["myobj1:",
                          "  myobj2:",
                          "    prop1: value1",
                          "    prop2: value2"]))
    .toStrictEqual(objToMap(
                    {
                      "myobj1": {
                        "myobj2": {
                          "prop1": "value1",
                          "prop2": "value2"
                        }
                      }
                    }));
    
});

test("Simple doubly nested objects with prop", () => {
    expect(parseProperties(["myobj1:",
                            "  prop0: value0",
                            "  myobj2:",
                            "    prop1: value1",
                            "    prop2: value2"]))
      .toStrictEqual(objToMap(
               {
                 "myobj1" : {
                   "prop0": "value0",
                   "myobj2": {
                     "prop1": "value1",
                     "prop2": "value2"
                   }
                 }
               }));
});

test("Test dedent", () => {
    expect(parseProperties(["myobj1:",
                            "  prop0: value0",
                            "  myobj2:",
                            "    prop1: value1",
                            "  prop2: value2"]))
        .toStrictEqual(objToMap(
                 {
                   "myobj1" : {
                     "prop0" : "value0",
                     "myobj2" : { 
                       "prop1" : "value1" 
                     },
                     "prop2": "value2" 
                   }
                 }));
});


function objToMap(obj : object) {
  let map = new Map();
  if(obj) {
    for(const [key,value] of Object.entries(obj)) {
      if (value != null) {
        if (typeof value === "object") {
          map.set(key, objToMap(value));
        } else {
          map.set(key, value);
        }
      }
    }
  }
  return map;
}

