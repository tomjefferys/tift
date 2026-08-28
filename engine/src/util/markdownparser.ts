// Parses rendered markdown text into the structured TextBlock/TextSpan model
// shared with the front-ends (see tift-types/src/messages/textblock).
//
// This is the single place markdown is interpreted. Front-ends no longer
// parse markdown themselves - they render the blocks this module produces -
// so "what markdown is supported" is defined here, once.
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import type { Node } from "mdast";
import { TextBlock, TextSpan, List } from "tift-types/src/messages/textblock";

const processor = remark().use(remarkGfm);

interface SpanFormat {
    bold? : boolean,
    italic? : boolean,
    strike? : boolean
}

export function parse(markdown : string) : TextBlock[] {
    const tree = processor.parse(markdown);
    return parseBlocks(childrenOf(tree));
}

export function blocksToText(blocks : TextBlock[]) : string {
    return blocks.map(blockToText).join("\n\n");
}

function blockToText(block : TextBlock) : string {
    switch(block.type) {
        case "paragraph":
        case "heading":
            return spansToText(block.content);
        case "thematicBreak":
            return "---";
        case "list":
            return block.items.map(item => `- ${blocksToText(item)}`).join("\n");
    }
}

function spansToText(spans : TextSpan[]) : string {
    return spans.map(span => span.text).join("");
}

function parseBlocks(nodes : Node[]) : TextBlock[] {
    const blocks : TextBlock[] = [];
    for (const node of nodes) {
        const block = parseBlock(node);
        if (block) {
            blocks.push(block);
        }
    }
    return blocks;
}

function parseBlock(node : Node) : TextBlock | undefined {
    switch(node.type) {
        case "paragraph":
            return { type : "paragraph", content : parseSpans(childrenOf(node)) };
        case "heading": {
            const depth = (node as Node & { depth : number }).depth;
            return { type : "heading", level : depth, content : parseSpans(childrenOf(node)) };
        }
        case "thematicBreak":
            return { type : "thematicBreak" };
        case "list":
            return parseList(node);
        default:
            // Unsupported block type (blockquote, code block, table, html, ...) -
            // flatten any inline content into a paragraph rather than silently
            // dropping the author's text.
            return flattenToParagraph(node);
    }
}

function flattenToParagraph(node : Node) : TextBlock | undefined {
    const spans = parseSpans(childrenOf(node));
    return spans.length > 0 ? { type : "paragraph", content : spans } : undefined;
}

function parseList(node : Node) : List {
    const listNode = node as Node & { ordered? : boolean | null, children : Node[] };
    const items = listNode.children.map(item => parseBlocks(childrenOf(item)));
    return { type : "list", ordered : listNode.ordered === true, items };
}

function parseSpans(nodes : Node[]) : TextSpan[] {
    const spans : TextSpan[] = [];
    nodes.forEach(node => collectSpans(node, {}, spans));
    return mergeAdjacent(spans);
}

function collectSpans(node : Node, format : SpanFormat, spans : TextSpan[]) : void {
    if (node.type === "strong" && hasChildren(node)) {
        node.children.forEach(child => collectSpans(child, { ...format, bold : true }, spans));
    } else if (node.type === "emphasis" && hasChildren(node)) {
        node.children.forEach(child => collectSpans(child, { ...format, italic : true }, spans));
    } else if (node.type === "delete" && hasChildren(node)) {
        node.children.forEach(child => collectSpans(child, { ...format, strike : true }, spans));
    } else if (node.type === "break") {
        // A hard line break within a paragraph. Whitespace normalization in
        // mustacheUtils happens before mustache is rendered, so authors can't
        // produce one of these directly; treat it as a plain space so any that
        // do slip through (e.g. via variable content) don't glue words together.
        spans.push({ text : " " });
    } else if (hasTextValue(node)) {
        if (node.value.length > 0) {
            spans.push({ text : node.value, ...format });
        }
    } else if (hasChildren(node)) {
        node.children.forEach(child => collectSpans(child, format, spans));
    }
}

function mergeAdjacent(spans : TextSpan[]) : TextSpan[] {
    const merged : TextSpan[] = [];
    for (const span of spans) {
        const previous = merged[merged.length - 1];
        if (previous && sameFormat(previous, span)) {
            previous.text += span.text;
        } else {
            merged.push({ ...span });
        }
    }
    return merged;
}

function sameFormat(a : TextSpan, b : TextSpan) : boolean {
    return !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.strike === !!b.strike;
}

function childrenOf(node : Node) : Node[] {
    return hasChildren(node) ? node.children : [];
}

function hasChildren(node : Node) : node is Node & { children : Node[] } {
    return "children" in node && Array.isArray((node as Node & { children? : unknown }).children);
}

function hasTextValue(node : Node) : node is Node & { value : string } {
    return "value" in node && typeof (node as Node & { value? : unknown }).value === "string";
}
