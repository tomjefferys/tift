// Structured representation of rendered narrative text.
//
// The engine parses rendered markdown (produced from YAML templates + mustache)
// into this typed block/span model exactly once, at the point it emits a
// `Print` message. Front-ends render `TextBlock[]` directly instead of each
// parsing a markdown string independently, so they can never disagree about
// which constructs (lists, headings, breaks, ...) are supported.

export type TextBlock = Paragraph | Heading | ThematicBreak | List;

export interface Paragraph {
    type : "paragraph",
    content : TextSpan[]
}

export interface Heading {
    type : "heading",
    level : number,
    content : TextSpan[]
}

export interface ThematicBreak {
    type : "thematicBreak"
}

export interface List {
    type : "list",
    ordered : boolean,
    items : TextBlock[][]
}

export interface TextSpan {
    text : string,
    bold? : boolean,
    italic? : boolean,
    strike? : boolean
}
