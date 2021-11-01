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
  let accumulator = [];
  let map = new Map();
  for(const line of lines) {
    lexer.reset(line);
    let lexeme = undefined;
    do {
      lexeme = lexer.next()
      if (lexeme) {
        switch(lexeme.type) {
          case "TEXT":
            accumulator.push(lexeme.value);
            break;
          case "COLON":
            if (accumulator.length == 1) {
              propName = accumulator[0];
              accumulator.length = 0;
            }
            break;
          default:
            break;
        }
      }
    } while (lexeme != undefined);
    if (propName) {
      map.set(propName, accumulator.join(" "));
    }
  }

  return map;
}
