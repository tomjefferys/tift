import pc from "picocolors";
import os from "os";
import { MessageFormatter, MessageFormatterBuilder } from "./message";
import * as MD from "./markdown";
import { TokenListFormatter } from "./tokenformatter";

const getANSIMarkdownMessageFormatter = (tokenListFormatter : TokenListFormatter) : MessageFormatter => {
    const formatMDMessage = (message : string) : string => {
        const tokens = MD.parseMarkdown(message);
        const alignedLines = tokenListFormatter(tokens);
        return alignedLines.join(os.EOL);
    }
    return new MessageFormatterBuilder()
        .addFormatter("Normal", text => formatMDMessage(text))
        .addFormatter("Command", text => pc.green(formatMDMessage(text)))
        .addFormatter("Info", text => pc.blue(formatMDMessage(text)))
        .addFormatter("Warning", text => pc.yellow(formatMDMessage(text)))
        .addFormatter("Error", text => pc.red(pc.bold(formatMDMessage(text))))
        .build();
}

export { getANSIMarkdownMessageFormatter };
