import { InputMessage } from "./messages/input";

export interface Engine {
  send(message : InputMessage) : Promise<void>;
}