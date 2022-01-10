import {parseProperties, ParseError, IndentError} from "../src/properties";

test("Test empty array", () => { 
  expect(parseProperties([])).toStrictEqual(objToMap({}));
}) 
