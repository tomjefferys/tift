import { Matcher, captureObject, matchBuilder, matchVerb } from "../../commandmatcher";
import { Thunk } from "../../script/thunk";
import { Phase, PhaseActionBuilder, PhaseActionType } from "../../script/phaseaction";

export function createMatcher(verb : string, obj : string) : Matcher {
    return matchBuilder()
                .withVerb(matchVerb(verb))
                .withObject(captureObject(obj))
                .build();
}

export function createAction<T extends Phase>(matcher : Matcher, thunk : Thunk, phase : T) : PhaseActionType<T> {
    const phaseAction = 
        new PhaseActionBuilder()
                        .withPhase(phase)
                        .withMatcherOnMatch(matcher, thunk);
    return phaseAction as unknown as PhaseActionType<T>;  // FIXME get this to work without the cast
}