import { createStateMachine } from "tift-engine";
import { Word } from "tift-types/src/messages/output";
import { InputMessage } from 'tift-types/src/messages/input';
import { DecoratedForwarder } from "tift-types/src/engineproxy";
import { StateMachine, MachineOps } from "tift-types/src/util/statemachine";

export const BACKSPACE : Word = { type : "control", id : "__BACKSPACE__", value : "BACKSPACE" };

export function createSimpleOption(name : string, clearFn : (forewarder : DecoratedForwarder) => void) : StateMachine<InputMessage, DecoratedForwarder> {
    return createStateMachine(name, [name, {
        onEnter : (forwarder : DecoratedForwarder, machine : MachineOps) => {
            clearFn(forwarder);
            machine.setStatus("FINISHED");
        },
        onAction : async (input : InputMessage, forwarder : DecoratedForwarder) => {
            forwarder.send(input);
            return undefined;
        }
    }]);
}