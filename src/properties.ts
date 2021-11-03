const moo = require('moo');

const lexer = moo.compile({
  WS:    /[ \t]+/,
  COLON: /:/,
  NL:    { match: /\n/, lineBreaks: true },
  TEXT:  /[^: \t\n\r]+/,
});

type PropertyValue = string | number | PropertyMap;
type PropertyMap = { [key: string]: PropertyValue};

//const RE_IDENTIFIER = '[a-zA-Z$_][a-zA-Z0-9$_]*';
//const RE_PROP_START = `^(\\s*)(${RE_IDENTIFIER})\\s*:\\s*(.*?)$`


// Tokenize a properti string, adding INDENT DEDENT symbols 
// as appropriate
function tokenizeProperties(lines: string[]) {
  // Tokenize a properties string, adding INDENT DEDENT symbols 
  // as appropriate:
}

export function parseProperties(lines: string[]) {
  let propName = undefined;
  let previousAccumulator = [];
  let accumulator = [];
  let map = new Map();
  for(const line of lines) {
    lexer.reset(line + "\n");
    
    let lexeme = undefined;
    while(lexeme = lexer.next()) {
        switch(lexeme.type) {
          case "TEXT":
            accumulator.push(lexeme.value);
            break;
          case "COLON":
            if (accumulator.length == 1) {
              if (propName) {
                map.set(propName, previousAccumulator.join(" "));
                previousAccumulator.length = 0;
              }
              propName = accumulator[0];
              accumulator.length = 0;
            } else {
              accumulator.push(lexeme.value);
            }
            break;
          case "NL":
            previousAccumulator.push(...accumulator);
            accumulator = [];
            break;
          default:
            break;
        }
    }
  }
  if (propName) {
    previousAccumulator.push(...accumulator);
    map.set(propName, previousAccumulator.join(" "));
  }
  

  return map;
}
