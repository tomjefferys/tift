import * as YAML from 'yaml';
import { Document, Node, LineCounter, } from 'yaml';
import { Obj } from 'tift-types/src/util/objects';
import { Optional } from 'tift-types/src/util/optional';
import * as Path from "../path";
import _ from 'lodash';

const FILE_COMMENT = "file:";
const LINE = "line";
const COL = "col";

export function getSourceMap(doc : Document, lc : LineCounter) : Obj {
    const walker = createWalker(lc);
    return walker(doc);
}

export interface SourceLocation {
    [LINE] : number;
    [COL] : number;
    file? : string;
}

export function isSourceLocation(location : unknown) : location is SourceLocation {
    return typeof location === "object" && 
                location != null
                && LINE in location 
                && COL in location;
}

export function getSourceLocation(sourceMap : Obj, path : Path.Type) : SourceLocation {
    return _.get(sourceMap, Path.toString(path));
}

function createWalker(lc : LineCounter) {
    let currentFile : Optional<string> = undefined;
    let lineOffset = 0;

    const getLineNumber = (node : Node) : SourceLocation  => {
        if (!node.range) {
            return {line: -1, col: -1};
        }
        const location = lc.linePos(node.range[0]) as SourceLocation;
        location.line -= lineOffset
        if (currentFile) {
            location.file = currentFile;
        }
        return location;
    }

    const setFileName = (node : Node, fileComment : string) => {
        currentFile = fileComment;
        lineOffset = getLineNumber(node).line - 1;
    }

    const getFileComment = (comment : string) : Optional<string> => {
        let file : Optional<string> = undefined;
        if (comment.trim().startsWith(FILE_COMMENT)) {
            file = comment.trim().substring(FILE_COMMENT.length).trim();
        }
        return file;
    }

    const walkNodes = (node : unknown, path : string[] = []) : Obj => {
        const sourceMap : Obj = {};
        if (YAML.isNode(node) && node.commentBefore) {
            const fileComment = getFileComment(node.commentBefore);
            if (fileComment) {
                setFileName(node, fileComment);
            }
        }
        if (YAML.isDocument(node)) {
            const contents = node.getIn([]);
            Object.assign(sourceMap, walkNodes(contents));
        } else if (YAML.isMap(node)) {
            node.items.forEach((pair) => {
                const childMap = walkNodes(pair, path);
                Object.assign(sourceMap, childMap);
            });
        } else if (YAML.isSeq(node)) {
            node.items.forEach((item, index) => {
                if (YAML.isNode(item) && item.range) {
                    const fullPath = path.concat([index.toString()]).join(".");
                    sourceMap[fullPath] = getLineNumber(item);
                }
                const childMap = walkNodes(item, path.concat([index.toString()]));
                Object.assign(sourceMap, childMap);
            });
        } else if (YAML.isPair(node)) { 
            if (!YAML.isScalar(node.key)) {
                throw new Error("Unexpected non-scalar key");
            }
            if (node.key.range) {
                const fullPath = path.concat([node.key.toJSON()]).join(".");
                sourceMap[fullPath] = getLineNumber(node.key);
            }
            walkNodes(node.key, path.concat([node.key.toJSON()]))
            const childMap = walkNodes(node.value, path.concat([node.key.toJSON()]));
            Object.assign(sourceMap, childMap);
        }
        return sourceMap;
    }

    return walkNodes;
}