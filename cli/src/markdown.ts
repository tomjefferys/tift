// Renders the engine's structured TextBlock[] (see tift-types/src/messages/textblock)
// to terminal lines, reusing the existing FormattedToken word-wrap/ANSI
// pipeline (textaligner.ts + tokenformatter.ts). The engine parses markdown
// into blocks exactly once - this module is the terminal-specific renderer
// for that shared model, so it no longer parses markdown itself.
import { TextBlock, TextSpan, List } from "tift-types/src/messages/textblock";
import { Format, FormattedToken } from "./formattedToken";
import { TokenListFormatter } from "./tokenformatter";

const RULE_CHAR = "─";
// Deliberately wider than any realistic terminal - the aligner slices a
// token that's too long for the line down to exactly the available width
// (see handleTokenLongerThanLine in textaligner.ts), so the rule always
// fills the line regardless of console width.
const RULE_TOKEN_LENGTH = 400;

// Exported for direct unit testing of the span -> word-token mapping
// (format combination, strikethrough, format_space propagation) without
// going through the word-wrap/ANSI pipeline.
export function spansToTokens(spans : TextSpan[], overrides : { bold? : boolean } = {}) : FormattedToken[] {
    const tokens : FormattedToken[] = [];
    spans.forEach(span => {
        const format = combineFormat(!!span.bold || !!overrides.bold, !!span.italic);
        const words = span.text.split(/\s+/).filter(word => word.length > 0);
        words.forEach(word => {
            const token : FormattedToken = { text : word };
            if (format !== "plain") {
                token.format = format;
            }
            if (span.strike) {
                token.strikethrough = true;
            }
            // If the previous token has the same (non-plain) styling, format
            // the space between them too, so runs of bold/italic/strike text
            // don't get plain gaps in their formatting.
            const previous = tokens[tokens.length - 1];
            if (previous && format !== "plain"
                    && previous.format === token.format
                    && !!previous.strikethrough === !!token.strikethrough) {
                token.spaceFormat = "format_space";
            }
            tokens.push(token);
        });
    });
    return tokens;
}

export function renderBlocks(blocks : TextBlock[], tokenListFormatter : TokenListFormatter) : string[] {
    const lines : string[] = [];
    blocks.forEach((block, index) => {
        if (index > 0) {
            lines.push(""); // blank line between blocks (paragraph/list/heading/rule)
        }
        lines.push(...renderBlock(block, tokenListFormatter));
    });
    return lines;
}

function renderBlock(block : TextBlock, tokenListFormatter : TokenListFormatter) : string[] {
    switch(block.type) {
        case "paragraph":
            return tokenListFormatter(spansToTokens(block.content));
        case "heading":
            return tokenListFormatter(spansToTokens(block.content, { bold : true }));
        case "thematicBreak":
            return renderThematicBreak(tokenListFormatter);
        case "list":
            return renderList(block, tokenListFormatter);
    }
}

function renderThematicBreak(tokenListFormatter : TokenListFormatter) : string[] {
    const lines = tokenListFormatter([{ text : RULE_CHAR.repeat(RULE_TOKEN_LENGTH) }]);
    return lines.length > 0 ? [lines[0]] : [];
}

function renderList(list : List, tokenListFormatter : TokenListFormatter) : string[] {
    const lines : string[] = [];
    list.items.forEach((item, index) => {
        const bullet = list.ordered ? `${index + 1}.` : "•";
        const tokens = [{ text : bullet }, ...itemToTokens(item)];
        lines.push(...tokenListFormatter(tokens));
    });
    return lines;
}

function itemToTokens(blocks : TextBlock[]) : FormattedToken[] {
    const tokens : FormattedToken[] = [];
    blocks.forEach(block => {
        // Nested lists/rules within a list item aren't produced by any
        // current game template. Flattening paragraphs/headings covers
        // every list the stdlib/example templates actually generate.
        if (block.type === "paragraph" || block.type === "heading") {
            tokens.push(...spansToTokens(block.content));
        }
    });
    return tokens;
}

function combineFormat(bold : boolean, italic : boolean) : Format {
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
