import * as moo from 'moo';

const LEXEMES = {
  WS:    /[ \t]+/,
  COLON: /:/,
  NL:    { match: /\n/, lineBreaks: true },
  NUMBER: /-?\d*[\.]?\d+/,
  TEXT:  /[^: \t\n\r]+/,
};

type HandlerDict = { [key: string]: Function}
export type PropertyValue = string | number | PropertyMap;
export type PropertyMap = Map<string,PropertyValue>;
export type ResultType = PropertyMap | ParseError | undefined;
type PropertyObject = {[key:string]: PropertyObject|string|number}
type Accumulator = (string | number)[];

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
       "NUMBER":(token: moo.Token) => this.num(token),
       "TEXT":  (token: moo.Token) => this.text(token),
       "COLON": (token: moo.Token) => this.colon(token),
       "NL":    (token: moo.Token) => this.newLine(token),
       "WS":    (token: moo.Token) => this.whitespace(token),
  };

  linenum: number = 0;
  propName?: string = undefined;
  acc: Accumulator = [];
  lineAcc: Accumulator = [];
  wordAcc: Accumulator = [];
  indents: string[] = [""];
  indent: string = "";
  maps: PropertyMap[] = [new Map<string,PropertyValue>()];
  parserStatus = ParserStatus.RUNNING;
  parseError?: ParseError = undefined;

  nextLine(line: string) {
    if (this.parserStatus !== ParserStatus.RUNNING) {
      return;
    }
  
    this.linenum++;
    this.lexer.reset(line + "\n");
    let token = undefined;
    try {
      while(token = this.lexer.next()) {
        if (token.type) {
          this.handlers[token.type](token);
        }
      }
    } catch (error) {
        this.parserStatus = ParserStatus.FAILURE;
      if (error instanceof ParseError) {
        this.parseError = error;
      } else if (error instanceof Error) {
        this.parseError = new ParseError(error.message, this.linenum);
      } else {
        this.parseError = new ParseError(String(error), this.linenum);
      }
    }
  }

  finish() : void {
    if (this.parserStatus !== ParserStatus.RUNNING) {
      return;
    } 
    if (this.propName) {
      this.pushWordAcc();
      this.acc.push(...this.lineAcc);
      this.setProperty();
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
    this.wordAcc.push(token.value);
  }

  private num(token: moo.Token) {
    this.wordAcc.push(Number(token.value));
  }

  // handle a colon, this may mean a new 
  // property definition
  private colon(token: moo.Token) {
    this.pushWordAcc();
    if (this.lineAcc.length == 1) {
      // Check the indent, if it's greater than previous 
      // then this is a child property
      const indent = this.verifyIndent();
      if (indent === 1) {
        let newMap = new Map();
        if (!this.propName) {
          this.throwParseError("No object defined");
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

      const propName = this.lineAcc[0];
      
      if (typeof propName === "string") {
        this.propName = propName;
      } else {
        this.throwParseError(this.lineAcc + " is not a valid property name");
      }      
      this.lineAcc.length = 0;
    } else {
      this.lineAcc.push(token.value);
    }
  }

  // handle a newLine
  // Resets the line accumultor and indent
  private newLine(token: moo.Token) {
    this.pushWordAcc();
    this.acc.push(...this.lineAcc);
    this.indent = "";
    this.lineAcc = [];
  }

  // handle whitespace
  // If it's the first on a line record it as an indent
  private whitespace(token: moo.Token) {
    this.pushWordAcc();
    if (!this.indent && this.lineAcc.length == 0) {
      this.indent = token.value;
    }
  }

  // Push the contents of the word add into the line acc, combining
  // if necessary
  private pushWordAcc() {
    let len = this.wordAcc.length;
    if (len == 1) {
      this.lineAcc.push(this.wordAcc[0]);
    } else if (len > 1) {
      this.lineAcc.push(this.wordAcc.join(""));
    }
    this.wordAcc.length = 0;
  }

  // Returns the type of indent, and verifies that the indent is 
  // appropriate
  // Result is a number.  1 -> Ident, 0 -> nodent, -n -> n dedents
  private verifyIndent() : number {
    const lastIndent = peek(this.indents);
    let indentType : number;
    if (this.indent.length > lastIndent.length) {
      if (!this.indent.startsWith(lastIndent)) {
        this.throwIndentError("Inconsistent indenting (mixing tabs/spaces?)");
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
          this.throwIndentError("Inconsistent indenting");
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
      let value : number | string
      if (this.acc.length == 1 && typeof this.acc[0] === "number") {
        value = this.acc[0];
      } else {
        value = this.acc.join(" ");
      }
      peek(this.maps).set(this.propName!, value);
      this.acc.length = 0;
  }

  // Throw a new parse error
  private throwParseError(message: string) : never {
    throw new ParseError(message, this.linenum);
  }

  private throwIndentError(message: string) : never {
    throw new IndentError(message, this.linenum);
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
