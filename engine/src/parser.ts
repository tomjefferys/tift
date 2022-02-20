const fs = require('fs');



// A line loaded from a file
class Line {
  readonly linenum: number;
  readonly content: string;

  constructor(linenum: number, content: string) {
    this.linenum = linenum;
    this.content = content;
  }
}

// TODO reference other file
type PropertyValue = string | number | PropertyMap;
type PropertyMap = { [key: string]: PropertyValue};

// Represents a section.  Sections begin with
// === SectionName:PrototypeName ==
// and may contain freetext sections and properties
class Section {
  readonly name: string;
  readonly protoName: string;
  readonly text: string[];
  readonly properties: PropertyMap;

  constructor(name: string,
              protoName: string,
              text: string[],
              properties: PropertyMap) {
    this.name = name;
    this.protoName = protoName;
    this.text = text;
    this.properties = properties;
  }
}


function loadFile(filename: string) {
  console.log("Loading: " + filename);
  let lineobjs: Line[] = [];
  const data = fs.readFileSync(filename, 'utf8');
  const lines = data.split(/\r?\n/);
  let linenum = 0;
  for(const line of lines) {
    linenum++;
    lineobjs.push(new Line(linenum, line));
  }
  return lineobjs;
}


console.log("starting");
for(const line of loadFile("test.txt")) {
  console.log(line.linenum + ": " + line.content);
}
