export type Consumer<T> = (item : T) => void;
export type BiConsumer<S,T> = (item1 : S, item2 : T) => void;

export type Producer<T> = () => T;

export class Router<T> {
    
    listener : Consumer<T>;

    constructor(listener : Consumer<T>) {
        this.listener = listener;
    }

    setListener(listener : Consumer<T>) {
        this.listener = listener;
    }

    getOutputConsumer() : Consumer<T> {
        return message => this.listener(message);
    }
}

export class InputOutput<S,T> {
    input : Consumer<S>;
    output : Producer<T>;

    constructor(input : Consumer<S>, output : Producer<T>) {
        this.input = input;
        this.output= output;
    }
}

/**
 * A request filter.  This is a consumer, that can intercept and manipulate requests
 */
export type RequestFilter<S,T> = BiConsumer<S, DuplexProxy<S,T>>;

/**
 * A response filter.  This is a consumer, that can intercept and manipulate responses
 */
export type ResponseFilter<S,T> = BiConsumer<T, DuplexProxy<S,T>>;

/**
 * A pair of request/response filters
 */
export interface ProxyFilter<S,T> {
    onRequest(value : S, proxy : DuplexProxy<S,T>) : void;
    onRepsonse(value : T, proxy : DuplexProxy<S,T>) : void;
}

/**
 * A pair of filters, used when consturcting a DuplexProxy
 */
export interface Filters<S,T> {
    requestFilter? : RequestFilter<S,T>;
    responseFilter? : ResponseFilter<S,T>;
}

// Input is pushed to the Server
// Output is pushed to the client
// This needs two consumers
//   1. Server Input
//   2. Client Input (the output consumer)
// Any actions are tiggered on push
// Client -> S -> Server
// Client <- T <- Server

/**
 * A proxy that can sit between arbirary client, and servers filtering both requests and responses
 * Request are pushed in using the send method
 * Resposnes are pushed using the response method
 * 
 * Listeners need to be set to listen to to the requests and responses
 * 
 */
export class DuplexProxy<S,T> {
    private name : string;

    private requestListener? : Consumer<S>;
    private responseListener? : Consumer<T>;

    private requestFilter : RequestFilter<S,T>;
    private responseFilter : ResponseFilter<S,T>;

    constructor(name : string, filters : Filters<S,T>) {
        this.name = name;
        this.requestFilter = filters.requestFilter ?? ((request, proxy) => proxy.forwardRequest(request));
        this.responseFilter = filters.responseFilter ?? ((response, proxy) => proxy.forwardResponse(response));
    }

    setRequestListener(requestListener : Consumer<S>) {
        this.requestListener = requestListener;
    }

    setResponseListener(responseListener : Consumer<T>) {
        this.responseListener = responseListener;
    }

    // Client -> S -> Server
    send(request : S) {
        this.requestFilter(request, this);
    }

    // Server -> T -> Client
    respond(response : T) {
        this.responseFilter(response, this);
    }

    forwardRequest(request : S) {
        if (this.requestListener) {
            this.requestListener(request);
        } else {
            throw new Error("Request listener is undefined");
        }
    }

    forwardResponse(response : T) {
        if (this.responseListener) {
            this.responseListener(response);
        } else {
            throw new Error("Response listener is undefined");
        }
    }

    insertProxy(name : string, filters : Filters<S,T>) : DuplexProxy<S,T> {
        const newProxy = new DuplexProxy<S,T>(name, filters);

        newProxy.requestListener = request => this.send(request); //this.requestListener;
        this.responseListener = response => newProxy.respond(response);

        return newProxy;
    }
}

