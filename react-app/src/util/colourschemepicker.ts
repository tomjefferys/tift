import { word, createStateMachine, handleInput } from "tift-engine"
import { InputMessage } from 'tift-types/src/messages/input';
import { DecoratedForwarder } from "tift-types/src/engineproxy";
import { StateMachine } from "tift-types/src/util/statemachine";

const LIGHT = "light";
const DARK = "dark";
const CYBERPUNK = "cyberpunk";
const TERMINAL = "terminal";
const MEDIEVAL = "medieval";
const FOREST = "forest";
const HIGH_CONTRAST_LIGHT = "high-contrast-light";
const HIGH_CONTRAST_DARK = "high-contrast-dark";
const CANCEL = "cancel";

const ALL_SCHEMES = [LIGHT, DARK, CYBERPUNK, TERMINAL, MEDIEVAL, FOREST, HIGH_CONTRAST_LIGHT, HIGH_CONTRAST_DARK];

const CHANGE_MESSAGE = (scheme : string) => `Changing to the ${scheme} scheme.`;

/**
 * Creates the colour scheme picker
 * @param schemeChanger a function to perform the change
 * @returns the colour scheme picker
 */
export function createColourSchemePicker(schemeChanger : (scheme : string) => void) : StateMachine<InputMessage, DecoratedForwarder> {
    const colourSchemes = ALL_SCHEMES.map(value => word(value, value, "select"));
    return createStateMachine("prompt", ["prompt", {
        onEnter : (forwarder : DecoratedForwarder) => {
            forwarder.print("Select a colour scheme: " + ALL_SCHEMES.join(", "));
            forwarder.words([], colourSchemes);
        },
        onAction : async (input : InputMessage, forwarder : DecoratedForwarder) => {
            let finished = false;
            const handler = handleInput(input);
            ALL_SCHEMES.forEach(scheme => {
                handler.onCommand([scheme], async () => {
                    forwarder.print(CHANGE_MESSAGE(scheme));
                    schemeChanger(scheme);
                    finished = true;
                });
            });
            await handler.onCommand([CANCEL], async () => {
                    forwarder.print("cancelled");
                    finished = true;
                })
            await handler.onAnyCommand(async command => forwarder.warn("Unexpected command: " + command.join(" ")));
            await handler.onGetWords(async () => forwarder.words([], colourSchemes));
            await handler.onAny(async message => forwarder.send(message));
            return finished ? "__TERMINATE__" : undefined;
        }
    }]);
}