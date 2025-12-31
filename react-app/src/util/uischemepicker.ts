import { word, createStateMachine, handleInput } from "tift-engine"
import { InputMessage } from 'tift-types/src/messages/input';
import { DecoratedForwarder } from "tift-types/src/engineproxy";
import { StateMachine } from "tift-types/src/util/statemachine";
import { UIType } from "./settings";

const BUBBLE = "bubble";
const NORMAL = "normal";
const CANCEL = "cancel";

const CHANGE_MESSAGE = (scheme : string) => `Changing to the ${scheme} UI scheme.`;

/**
 * Creates the UI scheme picker
 * @param schemeChanger a function to perform the change
 * @returns the UI scheme picker
 */
export function createUISchemePicker(schemeChanger : (scheme : UIType) => void) : StateMachine<InputMessage, DecoratedForwarder> {
    const uiSchemes = [BUBBLE, NORMAL].map(value => word(value, value, "select"));
    return createStateMachine("prompt", ["prompt", {
        onEnter : (forwarder : DecoratedForwarder) => {
            forwarder.print("Select a UI scheme: bubble, normal");
            forwarder.words([], uiSchemes);
        },
        onAction : async (input : InputMessage, forwarder : DecoratedForwarder) => {
            let finished = false;
            const handler = handleInput(input);
            await handler.onCommand([BUBBLE], async () => {
                    forwarder.print(CHANGE_MESSAGE(BUBBLE));
                    schemeChanger(BUBBLE);
                    finished = true;
                });
            await handler.onCommand([NORMAL], async () => {
                    forwarder.print(CHANGE_MESSAGE(NORMAL));
                    schemeChanger(NORMAL);
                    finished = true;
                });
            await handler.onCommand([CANCEL], async () => {
                    forwarder.print("cancelled");
                    finished = true;
                })
            await handler.onAnyCommand(async command => forwarder.warn("Unexpected command: " + command.join(" ")));
            await handler.onGetWords(async () => forwarder.words([], uiSchemes));
            await handler.onAny(async message => forwarder.send(message));
            return finished ? "__TERMINATE__" : undefined;
        }
    }]);
}
