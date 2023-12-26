import { Consumer, BiConsumer } from "./functions"

/**
 * Something that can forward on a request or response
 */
export interface Forwarder<S,T> {
    send(request : S) : Promise<void>;
    respond(response : T) : void;
}

/**
 * A request filter.  This is a consumer, that can intercept and manipulate requests
 */
export type RequestFilter<S,T> = (request : S, forwarder : Forwarder<S,T>) => Promise<void>;

/**
 * A response filter.  This is a consumer, that can intercept and manipulate responses
 */
export type ResponseFilter<S,T> = BiConsumer<T, Forwarder<S,T>>;

/**
 * A pair of filters, used when consturcting a DuplexProxy
 */
export interface Filters<S,T> {
    requestFilter? : RequestFilter<S,T>;
    responseFilter? : ResponseFilter<S,T>;
}


/**
 * A proxy that can sit between arbirary client, and servers filtering both requests and responses
 * Request are pushed in using the send method
 * Resposnes are pushed using the response method
 * 
 * Listeners need to be set to listen to to the requests and responses
 * 
 */
export interface DuplexProxy<S,T> extends Forwarder<S,T> {

    setRequestListener(requestListener : Consumer<S>) : void;

    setResponseListener(responseListener : Consumer<T>) : void; 

    // Client -> S -> Server
    send(request : S) : Promise<void>; 

    // Server -> T -> Client
    respond(response : T) : void;
    
    forwardRequest(request : S) : void;

    forwardResponse(response : T) : void;

    insertProxy(name : string, filters : Filters<S,T>) : DuplexProxy<S,T>;
    
}