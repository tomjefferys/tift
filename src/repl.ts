import * as readline from "readline"
import {
  Parser,
  ResultType,
  ParseError,
  PropertyMap,
  propMapToObj } from "./properties";

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


let parser = new Parser();
rl.on('line', (input) => {
  if (input) {
    parser.nextLine(input);
  } else {
    parser.finish();
    let result = parser.getResult();

    if (result instanceof ParseError) { 
      console.log("Error: " + result.message + " on line " + result.lineNum);
    } else if (result instanceof Map) {
      console.log("result: " +
                    JSON.stringify(propMapToObj(result), replacer, 2));
    }
    parser = new Parser();
  }
});

function replacer(key: string, value: object) {
  if(value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else {
    return value;
  }
}
