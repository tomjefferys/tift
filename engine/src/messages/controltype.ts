
export type ControlType = Pause | Alert;

export interface Pause {
    type : "pause",
    durationMillis : number,
    interruptable : boolean
}

export interface Alert {
    type : "alert", 
    message : string
}