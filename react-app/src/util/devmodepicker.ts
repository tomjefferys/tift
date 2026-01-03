import { word, createStateMachine, handleInput } from "tift-engine"
import { InputMessage } from 'tift-types/src/messages/input';
import { DecoratedForwarder } from "tift-types/src/engineproxy";
import { StateMachine } from "tift-types/src/util/statemachine";

const DEV_ON = "on";
const DEV_OFF = "off";
const CANCEL = "cancel";

const CHANGE_MESSAGE = (mode : string) => `Switching developer mode ${mode}.`;

/**
 * Creates the UI scheme picker
 * @param schemeChanger a function to perform the change
 * @returns the UI scheme picker
 */
export function createDevModePicker(devModeChanger : (enableDebug : boolean) => void) : StateMachine<InputMessage, DecoratedForwarder> {
    const devOptions = [DEV_ON, DEV_OFF].map(value => word(value, value, "select"));
    return createStateMachine("prompt", ["prompt", {
        onEnter : (forwarder : DecoratedForwarder) => {
            forwarder.print("Select a developer mode: on, off");
            forwarder.words([], devOptions);
        },
        onAction : async (input : InputMessage, forwarder : DecoratedForwarder) => {
            let finished = false;
            const handler = handleInput(input);
            await handler.onCommand([DEV_ON], async () => {
                    forwarder.print(CHANGE_MESSAGE(DEV_ON));
                    devModeChanger(true);
                    finished = true;
                });
            await handler.onCommand([DEV_OFF], async () => {
                    forwarder.print(CHANGE_MESSAGE(DEV_OFF));
                    devModeChanger(false);
                    finished = true;
                });
            await handler.onCommand([CANCEL], async () => {
                    forwarder.print("cancelled");
                    finished = true;
                })
            await handler.onAnyCommand(async command => forwarder.warn("Unexpected command: " + command.join(" ")));
            await handler.onGetWords(async () => forwarder.words([], devOptions));
            await handler.onAny(async message => forwarder.send(message));
            return finished ? "__TERMINATE__" : undefined;
        }
    }]);
}
