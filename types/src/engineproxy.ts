import { Forwarder, DuplexProxy } from "./util/duplexproxy";
import { InputMessage } from "./messages/input";
import { OutputMessage } from "./messages/output";

export type MessageForwarder = Forwarder<InputMessage, OutputMessage>;

export type EngineProxy = DuplexProxy<InputMessage, OutputMessage>;