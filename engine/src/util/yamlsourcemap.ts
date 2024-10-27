import * as YAML from 'yaml';
import { Document, LineCounter, } from 'yaml';
import { Obj } from 'tift-types/src/util/objects';


export function getSourceMap(doc : Document, lc : LineCounter) : Obj {
    return walkNodes(lc, doc);
}

function walkNodes(lc : LineCounter, node : unknown, path : string[] = []) : Obj {
    const sourceMap : Obj = {};
    if (YAML.isDocument(node)) {
        const contents = node.getIn([]);
        if (YAML.isMap(contents)) {
            contents.items.forEach((child) => {
                const childMap = walkNodes(lc, child);
                Object.assign(sourceMap, childMap);
            });
        } else if (YAML.isSeq(contents)) {
            contents.items.forEach((child) => {
                const childMap = walkNodes(lc, child);
                Object.assign(sourceMap, childMap);
            });
        } else {
            throw new Error("Unexpected document contents");
        }
    } else if (YAML.isMap(node)) {
        node.items.forEach((pair) => {
            const childMap = walkNodes(lc, pair, path);
            Object.assign(sourceMap, childMap);
        });
    } else if (YAML.isSeq(node)) {
        node.items.forEach((item, index) => {
            if (YAML.isNode(item) && item.range) {
                const fullPath = path.concat([index.toString()]).join(".");
                sourceMap[fullPath] = lc.linePos(item.range[0]);
            }
            const childMap = walkNodes(lc, item, path.concat([index.toString()]));
            Object.assign(sourceMap, childMap);
        });
    } else if (YAML.isPair(node)) { 
        if (!YAML.isScalar(node.key)) {
            throw new Error("Unexpected non-scalar key");
        }
        if (node.key.range) {
            const fullPath = path.concat([node.key.toJSON()]).join(".");
            sourceMap[fullPath] = lc.linePos(node.key.range[0]);
        }
        const childMap = walkNodes(lc, node.value, path.concat([node.key.toJSON()]));
        Object.assign(sourceMap, childMap);
    }
    return sourceMap;
}