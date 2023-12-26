import { InputMessage } from "tift-types/src/messages/input";
import { OutputMessage, StatusType, Word } from "tift-types/src/messages/output";
import { Filters } from "tift-types/src/util/duplexproxy";
import { OutputConsumerBuilder, handleInput } from "tift-engine";
import { RefObject } from "react";


export function getUndoRedoFilter(
                    statusRef : RefObject<StatusType>, 
                    undoFn : () => Promise<void>,
                    redoFn : () => Promise<void>) : Filters<InputMessage, OutputMessage> {
    return {
        requestFilter : async (input, forwarder) => {
            const handler = handleInput(input);
            await handler.onCommand([getId("undo")], undoFn);
            await handler.onCommand([getId("redo")], redoFn);
            await handler.onAny(async message => forwarder.send(message));
        },
        responseFilter : (message, forwarder) => {
            const outputConsumer = new OutputConsumerBuilder()
                    .withWordsConsumer((command, words) => {
                        const allWords = [...words];
                        if (statusRef.current?.undoable) {
                            allWords.push(createWord("undo"));
                        }
                        if (statusRef.current?.redoable) {
                            allWords.push(createWord("redo"))
                        }
                        forwarder.respond(createWords(command, allWords));
                    })
                    .withDefaultConsumer(message => forwarder.respond(message))
                    .build();
            outputConsumer(message);
        }
    }
}

function createWords(command : string[], words : Word[]) : OutputMessage {
    return { type : "Words", command, words };
}

function createWord(name : string) : Word {
    return {
        id : getId(name),
        value : name,
        type : "option"
    };
}

function getId(name : string) : string {
    return `__option(${name})__`;
}