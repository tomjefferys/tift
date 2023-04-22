import { handleInput, word } from "tift-engine";
import { InputMessage } from "tift-types/src/messages/input";
import { OutputMessage, Word } from "tift-types/src/messages/output";
import { Filters, Forwarder } from "tift-types/src/util/duplexproxy";

/**
 * A filter that can pause the game for a fixed duration.
 * Provides a "continue" command to skip
 */
export interface Pauser {
  pause : (timeMillis : number) => void;
  unpause : () => void;
}

const CONTINUE = [word("continue", "continue", "control")];

export type PauseFilter = Filters<InputMessage, OutputMessage> & Pauser;

export function createPauseFilter(setWords : (words : Word[]) => void, getWords : (words : Word[]) => void) : PauseFilter {
  // Keep track of any messages recieved afert pause has been actived
  // These can then be replayed on unpause
  const heldMessages : [OutputMessage, Forwarder<InputMessage, OutputMessage>][] = [];
  let paused = false;
  let timer : ReturnType<typeof setTimeout> | null = null;
  const pauser : PauseFilter = {
    requestFilter : (input, forwarder) => {
      if (paused) {
        handleInput(input)
          .onCommand(["continue"], pauser.unpause)
          .onGetWords(command => command[0] === "continue" 
                                  ? forwarder.respond({ type : "Words", command, words : []})
                                  : forwarder.respond({ type : "Words", command, words : CONTINUE}))
          .onAny(message => forwarder.send(message));
      } else {
        forwarder.send(input);
      }
    },
    responseFilter : (output, forwarder) => {
      if (paused) {
        heldMessages.push([output, forwarder]);
      } else {
        forwarder.respond(output);
      }
    },
    pause : timeMillis => { 
      paused = true;
      setWords(CONTINUE);
      timer = setTimeout(pauser.unpause, timeMillis);
    },
    unpause : () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      paused = false;
      heldMessages.forEach(([message, forwarder]) => forwarder.respond(message));
      heldMessages.length = 0;
      getWords([]);
    }
  }
  return pauser;
}