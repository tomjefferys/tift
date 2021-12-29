import * as moo from 'moo';
import log from 'loglevel';

log.setLevel("DEBUG");

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
  readonly lineNum: number;

  constructor(message: string, lineNum: number) {
    super(message);
    this.lineNum = lineNum;
  }
}

export class IndentError extends ParseError {
  constructor(message: string, lineNum: number) {
    super(message, lineNum);
  }
}

// Class holding proprty details when parsing
class Property {
  name: string;
  line: number;
  col: number;
 
  constructor(name: string, line: number, col: number) {
    this.name = name;
    this.line = line;
    this.col = col;
  }
}

// Intermediate data type used when parsing the data
class PropNode {
  readonly name: string;
  readonly line: number;
  readonly col: number;
  readonly valueCol: number;
  readonly parent? : PropNode;

  value?: number | string;
  desc?: string;
  children: PropNode[];
  
  constructor(name: string,
              line: number,
              col: number,
              valueCol: number,  // The location of the colon
              parent?: PropNode) {
    this.name = name;
    this.line = line;
    this.col = col;
    this.valueCol = valueCol;
    this.parent = parent;
    this.children = [];
  }

  static makeRoot() : PropNode {
    return new PropNode("", 0, -1, -1, undefined);
  }
  
  isRoot() : boolean {
    return !this.parent;
  }
 
  createChild(name: string, line: number, col: number, valueCol: number) : PropNode {
    log.debug("NodeProp: ", this.name, " adding child ", name);
    if (line <= this.line) {
      throw new ParseError(
           "Child properties must be on a later line to their parent",
           line);
    }
    if (col <= this.col) {
      throw new ParseError(
           "Child properties must have greater indentation than their parent",
           line); 
    }
    if (valueCol <= col) {
      throw new ParseError(
           "The value (colon) column must be after the indent column",
           line);
    }
    const child = new PropNode(name, line, col, valueCol, this);
    this.children.push(child);
    return child;
  }

  createSibling(name: string, line: number, col: number, valueCol: number) : PropNode {
    if (!this.parent) {
      throw new ParseError(
           "The root node cannot have siblings", line);
    }
    return this.parent.createChild(name, line, col, valueCol);
  }

  getAncestor(count : number) : PropNode {
    log.debug("PropNode: ", this.name, " getAncestor ", count);
    if (count == 0) {
      return this;
    } else if (this.parent) {
      return this.parent.getAncestor(count - 1);
    } else {
      throw new Error("Can't get ancestor of the root node");
    }
  }
 
  getRoot() : PropNode {
    return this.parent? this.parent.getRoot() : this;
  }

  toPropertyMap() : PropertyMap {
    const value = this.toPropertyValue();
    if (!(value instanceof Map)) {
      throw new Error("Property value is not of type Map");
    }
    return value;
  }

  private toPropertyValue() : PropertyValue {
    //if (this.isValueType()) {
    //  throw new Error("Can't create map out of single value property node");
    //}
    if (!this.children.length && !this.desc && this.value) {
      return this.value;
    } 

    // Don't allow non empty non root definitions
    if (!(this.children.length || this.desc || this.value) && this.parent) {
      throw new Error("Property: [" +  this.name + "] is not defined");
    }

    const map = new Map<string,PropertyValue>();
    for(let prop of this.children) {
      //map.set(prop.name, (prop.isValueType())? prop.value : prop.toPropertyMap());
      map.set(prop.name, prop.toPropertyValue());
    }
    // FIXME use symbols?
    if (this.desc) {
      map.set("desc", this.desc);
    }
    if (this.value) {
      map.set("value", this.value);  
    }
    return map;
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

  node: PropNode = PropNode.makeRoot();

  lineNum: number = 0;
  property?: Property = undefined;
  //propName?: string = undefined;
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
  
    this.lineNum++;
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
        this.parseError = new ParseError(error.message, this.lineNum);
      } else {
        this.parseError = new ParseError(String(error), this.lineNum);
      }
    }
  }

  finish() : void {
    if (this.parserStatus !== ParserStatus.RUNNING) {
      return;
    } 
    if (this.property) {
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
        return this.node.getRoot().toPropertyMap();
        //return this.maps[0];
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
      // TODO treat all properties as object type
      //      each can have a value field containing the value
      //      in the case of string or number properties
      //      this could be an intermediate datastructure

      let propName : string;
      if (typeof this.lineAcc[0] === "string") {
        propName = this.lineAcc[0];
      } else {
        this.throwParseError(this.lineAcc + " is not a valid property name");
      }

      // Check the indent, if it's greater than previous 
      // then this is a child property
      const indent = this.verifyIndent();
      if (indent === 1) {
        if (!this.property) {
          this.throwParseError("No object defined");
        }
        this.setProperty();
        const child = this.node.createChild(
                        propName, this.lineNum, this.indent.length, token.col);
        this.node = child;

        let newMap = new Map();
        peek(this.maps).set(this.property.name, newMap);
        this.maps.push(newMap);
      } else if (indent === 0) {
        
        if (this.property) {
          this.setProperty();
        }
        // FIXME the first property at root will have indent type of 0
        const newNode = (this.node.parent)
                           ? this.node.createSibling(
                                propName, this.lineNum, this.indent.length, token.col)
                           : this.node.createChild(
                                propName, this.lineNum, this.indent.length, token.col);
   
        this.node = newNode;
        

        
        //if (this.property) {
        //  this.setProperty();
        //}
      } else if (indent < 0) {
        this.setProperty();
        const ancestor = this.node.getAncestor(-indent + 1);
        const child = ancestor.createChild(
                          propName, this.lineNum, this.indent.length, token.col);
        this.node = child;
       
        for(var i=0; i> indent; i--) {
          this.maps.pop();
        }
      } else {
        throw new Error("Unknown indent type found: " + indent);
      } 

      // Create the new property
      
      this.property = new Property(propName, this.lineNum, token.col);
      this.lineAcc.length = 0;
    } else {
      this.wordAcc.push(token.value);
    }
  }

  // handle a newLine
  // Resets the line accumultor and indent
  private newLine(token: moo.Token) {
    this.pushWordAcc();
    let parent = this.node.parent;
    if (!parent) {
      log.debug("newLine: no parent node");
      this.appendLineToNodeDescription(this.node);
    } /*else if (this.node.line < this.lineNum &&
                     this.node.valueCol > this.indent.length) {
      // We're at the top level so this is a description
      log.debug("newLine: appending decription to parent");
      this.appendLineToNodeDescription(parent);
    } */ else {
      this.acc.push(...this.lineAcc);
      this.lineAcc.length = 0;
    }
    //else if (parent.line < this.lineNum &&
    //            parent.col < this.indent.length) {
    //  this.appendLineToNodeDescription(parent);
    //}

 
    //if (!this.property || 
    //       ( this.property.line < this.lineNum &&
    //         this.property.col > this.indent.length)) {
    //  this.appendLineToDescription();
    //} else {
    //  this.acc.push(...this.lineAcc);
    //  this.lineAcc.length = 0;
    //}
    this.indent = "";
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

      log.debug("Setting node value: ", this.node.name, "= ", value);
      // FIXME what if acc.length == 0
      this.node.value = value;

      if (this.property) {
        peek(this.maps).set(this.property.name, value);
      } else {
        this.throwParseError("No property found");
      }
      this.acc.length = 0;
  }

  private appendLineToNodeDescription(node: PropNode) : void {
    const desc = node.desc;
    const value = (desc? desc + " " : "") + this.lineAcc.join(" ");
    log.debug("Setting node: ", node.name, " description: ", value); 
    /*this.*/node.desc = value;
    this.lineAcc.length = 0; //TODO uncomment 
  }

  private appendLineToDescription() : void {
    const desc = peek(this.maps).get("desc");
    const value = (desc? desc + " " : "") + this.lineAcc.join(" ");
    peek(this.maps).set("desc", value);
    this.lineAcc.length = 0;
  }

  // Throw a new parse error
  private throwParseError(message: string) : never {
    throw new ParseError(message, this.lineNum);
  }

  private throwIndentError(message: string) : never {
    throw new IndentError(message, this.lineNum);
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
