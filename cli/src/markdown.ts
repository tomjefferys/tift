import { remark } from "remark";
import type { Node } from "mdast";
import { Format, FormattedToken } from "./formattedToken";


export function parseMarkdown(text : string) : FormattedToken[] {
    const tokens : FormattedToken[] = [];
    const currentFormats : Format[] = [];
    const parsed = remark.parse(text);
    parse(parsed, currentFormats, tokens);
    return tokens;
}

// Type guards
function isTextNode(node: Node): node is Node & { value: string } {
    return node.type === "text" && 'value' in node;
}

function hasChildren(node: Node): node is Node & { children: Node[] } {
    return 'children' in node && Array.isArray((node as any).children);
}

function parse(node : Node, currentFormats : Format[], tokens : FormattedToken[]){
    if (isTextNode(node)) {
        const words = node.value.split(/\s+/);
        const currentFormat = getCombinedFormat(currentFormats);
        for(const word of words) {
            if (word === "") {
                continue;
            }
            tokens.push({ format: currentFormat, text: word });
        }
    }
    else if (node.type === "strong" && hasChildren(node)) {
        currentFormats.push("bold");
        node.children.forEach((child : any) => parse(child, currentFormats, tokens));
        currentFormats.pop();
    }
    else if (node.type === "emphasis" && hasChildren(node)) {
        currentFormats.push("italic");
        node.children.forEach((child : any) => parse(child, currentFormats, tokens));
        currentFormats.pop();
    }
    else if (hasChildren(node)) {
        node.children.forEach((child : any) => parse(child, currentFormats, tokens));
    }
}

function getCombinedFormat(formats : Format[]) : Format {
    let bold = false;
    let italic = false;
    if (formats.includes("bold")) {
        bold = true;
    }
    if (formats.includes("italic")) {
        italic = true;
    }
    if (bold && italic) {
        return "bold-italic";
    } else if (bold) {
        return "bold";
    } else if (italic) {
        return "italic";
    } else {
        return "plain";
    }
}
