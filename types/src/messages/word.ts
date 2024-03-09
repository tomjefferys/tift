import { IdValue, Taggable } from "../shared";

export type PoSType = "start" | "verb" | "directObject" | "preposition" | "indirectObject" | "modifier";

export type Word = OptionWord | ControlWord | SelectWord | PartOfSpeech;

export interface OptionWord extends IdValue<string>, Partial<Taggable> {
    type : "option";
}

export interface ControlWord extends IdValue<string>, Partial<Taggable> {
    type : "control";
}

export interface SelectWord extends IdValue<string>, Partial<Taggable> {
    type : "select";
}

export interface PartOfSpeech extends IdValue<string>, Partial<Taggable> {
    type : "word";
    partOfSpeech : PoSType;
    position : number;
    modifierType? : string;
}