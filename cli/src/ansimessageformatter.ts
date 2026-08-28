import pc from "picocolors";
import os from "os";
import { MessageFormatter, MessageFormatterBuilder } from "./message";
import * as MD from "./markdown";
import { TokenListFormatter } from "./tokenformatter";
import { TextBlock } from "tift-types/src/messages/textblock";

const getANSIMarkdownMessageFormatter = (tokenListFormatter : TokenListFormatter) : MessageFormatter => {
    const formatMDMessage = (blocks : TextBlock[]) : string => {
        const alignedLines = MD.renderBlocks(blocks, tokenListFormatter);
        return alignedLines.join(os.EOL);
    }
    return new MessageFormatterBuilder()
        .addFormatter("Normal", blocks => formatMDMessage(blocks))
        .addFormatter("Command", blocks => pc.green(formatMDMessage(blocks)))
        .addFormatter("Info", blocks => pc.blue(formatMDMessage(blocks)))
        .addFormatter("Warning", blocks => pc.yellow(formatMDMessage(blocks)))
        .addFormatter("Error", blocks => pc.red(pc.bold(formatMDMessage(blocks))))
        .build();
}

export { getANSIMarkdownMessageFormatter };
