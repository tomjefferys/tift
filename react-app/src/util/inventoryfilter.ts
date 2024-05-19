import { OutputConsumerBuilder } from "tift-engine";
import { InputMessage } from "tift-types/src/messages/input";
import { OutputMessage, StatusType } from "tift-types/src/messages/output";
import { Word } from "tift-types/src/messages/word";
import { Filters, Forwarder } from "tift-types/src/util/duplexproxy";

/**
 * Capture the inventory from any status responses,
 * and insert it into the words responses
 */
export function getInventoryFilter() : Filters<InputMessage, OutputMessage> {
    let inventory : Word[] = [];

    const HIDDEN_WORDS = ["inventory"];

    /**
     * The request filter does nothing
     */
    const requestFilter = async (input : InputMessage, forwarder : Forwarder<InputMessage, OutputMessage>) => {
        forwarder.send(input);
    };

    /**
     * The response filter captures the inventory from status messages,
     * and inserts it into the words messages
     */
    const responseFilter = (message : OutputMessage, forwarder : Forwarder<InputMessage, OutputMessage>) => {

        const captureInventory = (status : StatusType) => {
            if (status.properties.inventory) {
                inventory = status.properties.inventory;
            }
            forwarder.respond({ type : "Status", status});
        }

        const injectInventory = (command : Word[], words : Word[]) => {
            const commandWords = command.filter(word => word.id !== '?');
            const wordsResponse = (commandWords.length === 0) ? 
                [...(words.filter(word => !HIDDEN_WORDS.includes(word.id))),
                 ...inventory] : words;
            forwarder.respond({ type : "Words", command, words : wordsResponse});
        }

        const outputConsumer = new OutputConsumerBuilder()
                                    .withStatusConsumer(status => captureInventory(status))
                                    .withWordsConsumer((command, words) => injectInventory(command, words))
                                    .withDefaultConsumer((message) => forwarder.respond(message))
                                    .build();
        outputConsumer(message);
    }

    return { requestFilter, responseFilter };
}