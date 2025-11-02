import { createEngine } from "./enginefacade";
import { StatePersister } from "./statepersister";
import { Display } from "./display";
import { CommandState } from "./commandstate";

export class StateManager {

    readonly statePersister : StatePersister;
    readonly dataFiles : string[];
    readonly displayBuilder : () => Display;

    commandState : CommandState

    constructor(
        statePersister : StatePersister,
        dataFiles : string[],
        displayBuilder : () => Display
    ) {
        this.statePersister = statePersister;
        this.dataFiles = dataFiles;
        this.displayBuilder = displayBuilder;
        this.commandState = this.build();
    }

    private build() : CommandState {
        const engine = createEngine(this.statePersister, this.dataFiles);
        const display = this.displayBuilder();
        const commandState = new CommandState(engine, display); 
        commandState.flush();
        commandState.update();
        return commandState;
    }

    get() : CommandState {
        return this.commandState;
    }

    refresh() {
        this.commandState.messages.push("--- Game state reloaded due to file change ---");
        this.commandState.flush();
        const newState = this.build();
        this.commandState = newState;
    }

}