import * as moo from 'moo';
import log from 'loglevel';

const LEXEMES = {
  WS:            /[ \t]+/,
  ESCAPE:        /\\./,
  BRACKET_OPEN:  /\[/,
  BRACKET_CLOSE: /\]/,
  COMMA:         /,/,
  //COLON:         /:/,
  NL:            { match: /\n/, lineBreaks: true },
  //NUMBER:        /-?\d*[\.]?\d+/,
  TEXT:          /[^: \t\n\r]+/,
};

// TODO share with properties.ts
type HandlerDict = { [key: string]: Function}

export class ArrayParser {

  readonly lexer = moo.compile(LEXEMES);

  readonly handlers : HandlerDict = {
       "TEXT":          (token: moo.Token) => this.text(token),
       "ESCAPE":        (token: moo.Token) => this.escape(token),
       "NL":            (token: moo.Token) => this.newLine(token),
       "WS":            (token: moo.Token) => this.whitespace(token),
       "BRACKET_OPEN":  (token: moo.Token) => this.openArray(token),
       "BRACKET_CLOSE": (token: moo.Token) => this.closeArray(token),
  };
 
  nextLine(line : string) {

  }

  private text(token : moo.Token) {

  }

  private escape(token : moo.Token) {

  }

  private newLine(token : moo.Token) {

  }

  private whitespace(token : moo.Token) {

  }

  private openArray(token : moo.Token) {

  }

  private closeArray(token : moo.Token) {

  }
}

export function parseArray(lines: string[]) : ResultType {
  const parser = new ArrayParser();
  for(const line of lines) {
    parser.nextLine(line);
  }
  parser.finish();
  return parser.getResult();
}

