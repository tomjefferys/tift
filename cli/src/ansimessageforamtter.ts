import pc from "picocolors";
import { MessageFormatter, MessageFormatterBuilder } from "./message";

const ANSI_MESSAGE_FORMATTER : MessageFormatter = new MessageFormatterBuilder()
    .addFormatter("Normal", text => formatMessage(text))
    .addFormatter("Command", text => pc.green(text))
    .addFormatter("Info", text => pc.blue(text))
    .addFormatter("Warning", text => pc.yellow(text))
    .addFormatter("Error", text => pc.red(pc.bold(text)))
    .build();

function formatMessage(message : string) : string {
    // Check for markdown bold/italic syntax and replace with terminal codes
    message = message.replace(/\*\*\*(.*?)\*\*\*/g, pc.bold(pc.italic("$1"))); // bold italic
    message = message.replace(/\*\*(.*?)\*\*/g, pc.bold("$1")); // bold
    message = message.replace(/\*(.*?)\*/g, pc.italic("$1")); // italic
    return message;
}

export { ANSI_MESSAGE_FORMATTER };
