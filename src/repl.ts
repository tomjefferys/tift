import * as readline from "readline"
import {Parser} from "./properties";

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
    console.log("result: " + JSON.stringify(parser.getResult(), replacer));
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
