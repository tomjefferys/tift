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

export enum ParserStatus {
  RUNNING,
  SUCCESS,
  FAILURE,
}

export class ParseResult {
   readonly parserStatus: ParserStatus;
   readonly result: ResultType;

   constructor(parserStatus: ParserStatus, result: ResultType) {
     this.parserStatus = parserStatus;
     this.result = result;
   }

}

export class ParseError {
  readonly message: string;
  readonly linenum: number;

  constructor(message: string, linenum: number) {
    this.message = message;
    this.linenum = linenum;
  }
}

class Parser {
  readonly lexer = moo.compile(LEXEMES);
  readonly handlers : HandlerDict = {
       "TEXT":  (token: moo.Token) => this.text(token),
       "COLON": (token: moo.Token) => this.colon(token),
       "NL":    (token: moo.Token) => this.newLine(token),
       "WS":    (token: moo.Token) => this.whitespace(token),
  };

  lineNum: number = 0;
  propName?: string = undefined;
  acc: string[] = [];
  lineAcc: string[] = [];
  indents: string[] = [""];
  indent: string = "";
  maps: PropertyMap[] = [new Map<string,PropertyValue>()];
  parserStatus = ParserStatus.RUNNING;
  parseError?: ParseError = undefined;

  nextLine(line: string) {
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

  getResult() : ParseResult {
    switch(this.parserStatus) {
      case ParserStatus.RUNNING:
        return new ParseResult(ParserStatus.RUNNING, undefined);
      case ParserStatus.FAILURE:
        return new ParseResult(ParserStatus.FAILURE, this.parseError);
      case ParserStatus.SUCCESS:
        return new ParseResult(ParserStatus.SUCCESS, this.maps[0]);
    }
  }
  
  text(token: moo.Token) {
    this.lineAcc.push(token.value);
  }

  // handle a colon, this may mean a new 
  // property definition
  colon(token: moo.Token) {
    if (this.lineAcc.length == 1) {
      // Check the indent, if it's greater than previous 
      // then this is a child property
      if (this.indent.length > peek(this.indents).length) {
        this.indents.push(this.indent);
        let newMap = new Map();
        // FIXME propName could be undefined
        peek(this.maps).set(this.propName!, newMap);
        this.maps.push(newMap);

      } else if (this.indent === peek(this.indents)) {
        // If same then sibling
        // don't need to do anything
        if (this.propName) {
          this.setProperty();
        }
      } else {
        // set the prop
        this.setProperty();

        // pop the indent need to find match
        while(this.indents.pop()) {
          this.maps.pop();
          if(this.indent === peek(this.indents)) {
            break;
          }
        }
        //maps.pop();
      }
      
      this.propName = this.lineAcc[0];
      this.lineAcc.length = 0;
    } else {
      this.lineAcc.push(token.value);
    }
  }

  // handle a newLine
  // Resets the line accumultor and indent
  newLine(token: moo.Token) {
    this.acc.push(...this.lineAcc);
    this.indent = "";
    this.lineAcc = [];
  }

  // handle whitespace
  // If it's the first on a line record it as an indent
  whitespace(token: moo.Token) {
    if (!this.indent && this.lineAcc.length == 0) {
      this.indent = token.value;
    }
  }


  // Set the currently parsing property with the value of the
  // accumulator
  setProperty() : void {
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

export function parseProperties(lines: string[]) : ParseResult {
  const parser = new Parser();
  for(const line of lines) {
    parser.nextLine(line);
    parser.finish();
  }
  return parser.getResult();
}
