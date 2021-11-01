import {parseProperties} from "../src/properties";

test("Test simple properties parsing", () => {
  expect(parseProperties([])).toStrictEqual(new Map());

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
