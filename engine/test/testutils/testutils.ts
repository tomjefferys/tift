import { MessageType, OutputConsumer } from "../../src/messages/output";

export function listOutputConsumer(messages : string[]) : OutputConsumer {
    return message => {
        switch(message.type) {
            case MessageType.PRINT:
                messages.push(message.value);
                break;
            default:
                throw new Error("Can't handle type " + message.type);
        }
    }
}