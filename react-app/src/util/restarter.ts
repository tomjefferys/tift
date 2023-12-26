import { word, createStateMachine, handleInput } from "tift-engine"
import { InputMessage } from 'tift-types/src/messages/input';
import { DecoratedForwarder } from "tift-types/src/engineproxy";
import { StateMachine } from "tift-types/src/util/statemachine";


const CONFIRM = "restart";
const CANCEL = "cancel";

const RESTARTING_MESSAGE = "restarting";
const CANCELLED_MESSAGE = "cancelled";

/**
 * Create a 'restarter' state machine
 * Prompts the player to confirm if the want to actually restart or not.
 * @param restartFn a function to actually perform the restart
 * @returns the restarter state machine
 */
export function createRestarter(restartFn : (forwarder : DecoratedForwarder) => Promise<void>) : StateMachine<InputMessage, DecoratedForwarder> {
    const restartOptions = [CONFIRM,CANCEL].map(value => word(value, value, "select"));

    return createStateMachine("prompt", ["prompt", {
        onEnter : (forwarder : DecoratedForwarder) => {
            forwarder.print("All progress will be lost. Are you sure?");
            forwarder.words([], restartOptions);
        },
        onAction : async (input : InputMessage, forwarder : DecoratedForwarder) => {
            let finished = false;
            let handler = handleInput(input);
            handler = await handler.onCommand([CONFIRM], async () => {
                    forwarder.print(RESTARTING_MESSAGE);
                    await restartFn(forwarder);
                    finished = true;
                });
            handler = await handler.onCommand([CANCEL], async () => {
                    forwarder.print(CANCELLED_MESSAGE);
                    finished = true;
                });
            handler = await handler.onAnyCommand(async command => forwarder.warn("Unexpected command: " + command.join(" ")));
            handler = await handler.onGetWords(async () => forwarder.words([], restartOptions));
            await handler.onAny(async message => forwarder.send(message));
            return finished ? "__TERMINATE__" : undefined;
        }
    }]);
}