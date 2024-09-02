import { Matcher, matchObject, captureObject, matchBuilder, matchVerb } from "../../commandmatcher";
import { Thunk } from "../../script/thunk";
import { Phase, PhaseActionBuilder, PhaseActionType } from "../../script/phaseaction";

export function createThisMatcher(verb : string) : Matcher {
    return createMatcherWithObjectMatcher(verb, matchObject("this"));
}

export function createMatcher(verb : string, obj : string) : Matcher {
    return createMatcherWithObjectMatcher(verb, captureObject(obj));
}

function createMatcherWithObjectMatcher(verb : string, objectMatcher : Matcher) : Matcher {
    return matchBuilder()
                .withVerb(matchVerb(verb))
                .withObject(objectMatcher)
                .build();
}

export function createAction<T extends Phase>(matcher : Matcher, thunk : Thunk, phase : T) : PhaseActionType<T> {
    const phaseAction = 
        new PhaseActionBuilder()
                        .withPhase(phase)
                        .withMatcherOnMatch(matcher, thunk);
    return phaseAction as unknown as PhaseActionType<T>;  // FIXME get this to work without the cast
}