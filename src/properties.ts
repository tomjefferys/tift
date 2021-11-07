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

function peek<Type>(list: Type[]) : Type {
  return list[list.length - 1];
}

export function parseProperties(lines: string[]) {
  let propName = undefined;
  let acc = [];
  let lineAcc = [];
  let indents = [""];
  let indent = "";
  let maps = [new Map()];
  for(const line of lines) {
    lexer.reset(line + "\n");
    
    let lexeme = undefined;
    while(lexeme = lexer.next()) {
        switch(lexeme.type) {
          case "TEXT":
            lineAcc.push(lexeme.value);
            break;
          case "COLON":
            if (lineAcc.length == 1) {
              // Check the indent, if it's greater than previous 
              // then this is a child property
              // TODO check that all other indents are 
              //      prefixes of this indent
              if (indent.length > peek(indents).length) {
                indents.push(indent);
                let newMap = new Map();
                peek(maps).set(propName, newMap);
                maps.push(newMap);

              } else if (indent === peek(indents)) {
                // If same then sibling
                // don't need to do anything
                if (propName) {
                  peek(maps).set(propName, acc.join(" "));
                  acc.length = 0;
                }
              } else {
                // set the prop
                peek(maps).set(propName, acc.join(" "));
                acc.length = 0;

                // pop the indent need to find match
                while(indents.pop()) {
                  maps.pop();
                  if(indent === peek(indents)) {
                    break;
                  }
                }
                //maps.pop();
              }
              
              propName = lineAcc[0];
              lineAcc.length = 0;
            } else {
              lineAcc.push(lexeme.value);
            }
            break;
          case "NL":
            acc.push(...lineAcc);
            indent = "";
            lineAcc = [];
            break;
          case "WS":
            if (!indent && lineAcc.length == 0) {
              indent = lexeme.value;
            }
            break;
          default:
            break;
        }
    }
  }
  if (propName) {
    acc.push(...lineAcc);
    peek(maps).set(propName, acc.join(" "));
  }
  

  return maps[0];
}
