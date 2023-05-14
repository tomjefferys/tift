import { Word } from "tift-types/src/messages/output";
import { buildStateMachine } from "tift-engine"
import { InputMessage } from 'tift-types/src/messages/input';
import { DecoratedForwarder } from "tift-engine/src/engineproxy";
import { StateMachine, MachineOps } from "tift-engine/src/util/statemachine";

export const BACKSPACE : Word = { type : "control", id : "__BACKSPACE__", value : "BACKSPACE" };

export function createSimpleOption(name : string, clearFn : (forewarder : DecoratedForwarder) => void) : StateMachine<InputMessage, DecoratedForwarder> {
    return buildStateMachine(name, [name, {
        onEnter : (forwarder : DecoratedForwarder, machine : MachineOps) => {
            clearFn(forwarder);
            machine.setStatus("FINISHED");
        },
        onAction : (input : InputMessage, forwarder : DecoratedForwarder) => {
            forwarder.send(input);
            return undefined;
        }
    }]);
}