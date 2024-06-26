import { Forwarder, DuplexProxy } from "./util/duplexproxy";
import { InputMessage } from "./messages/input";
import { OutputMessage } from "./messages/output";
import { Word } from "./messages/word";

export type MessageForwarder = Forwarder<InputMessage, OutputMessage>;

export type EngineProxy = DuplexProxy<InputMessage, OutputMessage>;

export interface DecoratedForwarder extends MessageForwarder {
    print(message : string) : void;
    
    warn(warning : string) : void;    

    error(error : string) : void;

    words(command : Word[], words : Word[]) : void;
}