import * as moo from 'moo';

const LEXEMES = {
  WS:    /[ \t]+/,
  COLON: /:/,
  NL:    { match: /\n/, lineBreaks: true },
  TEXT:  /[^: \t\n\r]+/,
};

type HandlerDict = { [key: string]: Function}
export type PropertyValue = string | number | PropertyMap;
export type PropertyMap = Map<string,PropertyValue>;
export type ResultType = PropertyMap | ParseError | undefined;
type PropertyObject = {[key:string]: PropertyObject|string|number}

export enum ParserStatus {
  RUNNING,
  SUCCESS,
  FAILURE,
}

export class ParseError extends Error {
  readonly linenum: number;

  constructor(message: string, linenum: number) {
    super(message);
    this.linenum = linenum;
  }
}

export class IndentError extends ParseError {
  constructor(message: string, linenum: number) {
    super(message, linenum);
  }
}

export class Parser {
  readonly lexer = moo.compile(LEXEMES);
  readonly handlers : HandlerDict = {
       "TEXT":  (token: moo.Token) => this.text(token),
       "COLON": (token: moo.Token) => this.colon(token),
       "NL":    (token: moo.Token) => this.newLine(token),
       "WS":    (token: moo.Token) => this.whitespace(token),
  };

  linenum: number = 0;
  propName?: string = undefined;
  acc: string[] = [];
  lineAcc: string[] = [];
  indents: string[] = [""];
  indent: string = "";
  maps: PropertyMap[] = [new Map<string,PropertyValue>()];
  parserStatus = ParserStatus.RUNNING;
  parseError?: ParseError = undefined;

  nextLine(line: string) {
    this.linenum++;
    this.lexer.reset(line + "\n");
    let token = undefined;
    while(token = this.lexer.next()) {
      if (token.type) {
        this.handlers[token.type](token);
      }
    }
  }

  finish() : void {
    if (this.propName) {
      this.acc.push(...this.lineAcc);
      peek(this.maps).set(this.propName, this.acc.join(" "));
    }
    this.parserStatus = ParserStatus.SUCCESS;
  }

  getResult() : ResultType {
    switch(this.parserStatus) {
      case ParserStatus.RUNNING:
        return undefined;
      case ParserStatus.FAILURE:
        return this.parseError;
      case ParserStatus.SUCCESS:
        return this.maps[0];
    }
  }
  
  private text(token: moo.Token) {
    this.lineAcc.push(token.value);
  }

  // handle a colon, this may mean a new 
  // property definition
  private colon(token: moo.Token) {
    if (this.lineAcc.length == 1) {
      // Check the indent, if it's greater than previous 
      // then this is a child property
      const indent = this.verifyIndent();
      if (indent === 1) {
        let newMap = new Map();
        if (!this.propName) {
          throw new ParseError("No object defined", this.linenum);
        }
        peek(this.maps).set(this.propName, newMap);
        this.maps.push(newMap);
      } else if (indent === 0) {
        if (this.propName) {
          this.setProperty();
        }
      } else if (indent < 0) {
        this.setProperty();
        for(var i=0; i> indent; i--) {
          this.maps.pop();
        }
      } else {
        throw new Error("Unknown indent type found: " + indent);
      } 
      
      this.propName = this.lineAcc[0];
      this.lineAcc.length = 0;
    } else {
      this.lineAcc.push(token.value);
    }
  }

  // handle a newLine
  // Resets the line accumultor and indent
  private newLine(token: moo.Token) {
    this.acc.push(...this.lineAcc);
    this.indent = "";
    this.lineAcc = [];
  }

  // handle whitespace
  // If it's the first on a line record it as an indent
  private whitespace(token: moo.Token) {
    if (!this.indent && this.lineAcc.length == 0) {
      this.indent = token.value;
    }
  }

  // Returns the type of indent, and verifies that the indent is 
  // appropriate
  // Result is a number.  1 -> Ident, 0 -> nodent, -n -> n dedents
  private verifyIndent() : number {
    const lastIndent = peek(this.indents);
    let indentType : number;
    if (this.indent.length > lastIndent.length) {
      if (!this.indent.startsWith(lastIndent)) {
        throw new IndentError("Inconsistent indenting (mixing tabs/spaces?)",
                              this.linenum);
      }       
      this.indents.push(this.indent);
      indentType = 1;

    } else if (this.indent === peek(this.indents)) {
      indentType = 0;

    } else {
      // pop the indent need to find match
      let dedentCount = 0;
      while(this.indents.pop()) {
        const prevIndent = peek(this.indents);
        if (this.indent.length > prevIndent.length) {
          throw new IndentError("Inconsistent indenting", this.linenum);
        }
        dedentCount++;
        if(this.indent === prevIndent) {
          break;
        }
      }
      indentType = -dedentCount;
    }
    return indentType;
  }


  // Set the currently parsing property with the value of the
  // accumulator
  private setProperty() : void {
      peek(this.maps).set(this.propName!, this.acc.join(" "));
      this.acc.length = 0;
  }

}


// Tokenize a properti string, adding INDENT DEDENT symbols 
// as appropriate
function tokenizeProperties(lines: string[]) {
  // Tokenize a properties string, adding INDENT DEDENT symbols 
  // as appropriate:
}

function peek<Type>(list: Type[]) : Type {
  return list[list.length - 1];
}

// Convert a property map into an object
export function propMapToObj(map: PropertyMap) : PropertyObject {
  let obj : PropertyObject = {};
  map.forEach((value,key) => {
    obj[key] = (value instanceof Map) ? propMapToObj(value) : value;
  });
  return obj;
}

export function parseProperties(lines: string[]) : ResultType {
  const parser = new Parser();
  for(const line of lines) {
    parser.nextLine(line);
  }
  parser.finish();
  return parser.getResult();
}
