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
export function createRestarter(restartFn : (forwarder : DecoratedForwarder) => void) : StateMachine<InputMessage, DecoratedForwarder> {
    const restartOptions = [CONFIRM,CANCEL].map(value => word(value, value, "option"));

    return createStateMachine("prompt", ["prompt", {
        onEnter : (forwarder : DecoratedForwarder) => {
            forwarder.print("All progress will be lost. Are you sure?");
            forwarder.words([], restartOptions);
        },
        onAction : (input : InputMessage, forwarder : DecoratedForwarder) => {
            let finished = false;
            handleInput(input)
                .onCommand([CONFIRM], () => {
                    forwarder.print(RESTARTING_MESSAGE);
                    restartFn(forwarder);
                    finished = true;
                })
                .onCommand([CANCEL], () => {
                    forwarder.print(CANCELLED_MESSAGE);
                    finished = true;
                })
                .onAnyCommand(command => forwarder.warn("Unexpected command: " + command.join(" ")))
                .onGetWords(() => forwarder.words([], restartOptions))
                .onAny(message => forwarder.send(message));
            return finished ? "__TERMINATE__" : undefined;
        }
    }]);
}