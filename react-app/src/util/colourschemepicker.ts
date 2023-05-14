import { word, createStateMachine, handleInput } from "tift-engine"
import { InputMessage } from 'tift-types/src/messages/input';
import { DecoratedForwarder } from "tift-types/src/engineproxy";
import { StateMachine } from "tift-types/src/util/statemachine";

const LIGHT = "light";
const DARK = "dark";
const CANCEL = "cancel";

const CHANGE_MESSAGE = (scheme : string) => `changine to ${scheme} scheme`;

/**
 * Creates the colour scheme picker
 * @param schemeChanger a function to perform the change
 * @returns the colour scheme picker
 */
export function createColourSchemePicker(schemeChanger : (scheme : string) => void) : StateMachine<InputMessage, DecoratedForwarder> {
    const colourSchemes = [LIGHT, DARK].map(value => word(value, value, "option"));
    return createStateMachine("prompt", ["prompt", {
        onEnter : (forwarder : DecoratedForwarder) => {
            forwarder.print("Select a colour scheme: light, dark");
            forwarder.words([], colourSchemes);
        },
        onAction : (input : InputMessage, forwarder : DecoratedForwarder) => {
            let finished = false;
            handleInput(input)
                .onCommand([LIGHT], () => {
                    forwarder.print(CHANGE_MESSAGE(LIGHT));
                    schemeChanger(LIGHT);
                    finished = true;
                })
                .onCommand([DARK], () => {
                    forwarder.print(CHANGE_MESSAGE(DARK));
                    schemeChanger(DARK);
                    finished = true;
                })
                .onCommand([CANCEL], () => {
                    forwarder.print("cancelled");
                    finished = true;
                })
                .onAnyCommand(command => forwarder.warn("Unexpected command: " + command.join(" ")))
                .onGetWords(() => forwarder.words([], colourSchemes))
                .onAny(message => forwarder.send(message));
            return finished ? "__TERMINATE__" : undefined;
        }
    }]);
}