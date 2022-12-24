import { Consumer, BiConsumer } from "./functions";


/**
 * Something that can forward on a request or response
 */
export interface Forwarder<S,T> {
    send(request : S) : void;
    respond(response : T) : void;
}

/**
 * A request filter.  This is a consumer, that can intercept and manipulate requests
 */
export type RequestFilter<S,T> = BiConsumer<S, Forwarder<S,T>>;

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
export class DuplexProxy<S,T> implements Forwarder<S,T> {
    private name : string;

    private requestListener? : Consumer<S>;
    private responseListener? : Consumer<T>;

    private requestFilter : RequestFilter<S,T>;
    private responseFilter : ResponseFilter<S,T>;

    constructor(name : string, filters : Filters<S,T>) {
        this.name = name;
        this.requestFilter = filters.requestFilter ?? ((request, proxy) => proxy.send(request));
        this.responseFilter = filters.responseFilter ?? ((response, proxy) => proxy.respond(response));
    }

    setRequestListener(requestListener : Consumer<S>) {
        this.requestListener = requestListener;
    }

    setResponseListener(responseListener : Consumer<T>) {
        this.responseListener = responseListener;
    }

    // Client -> S -> Server
    send(request : S) {
        this.requestFilter(request, this.getForwarder());
    }

    // Server -> T -> Client
    respond(response : T) {
        this.responseFilter(response, this.getForwarder());
    }

    forwardRequest(request : S) {
        if (this.requestListener) {
            this.requestListener(request);
        } else {
            throw new Error("Proxy [" + this.name + "] Request listener is undefined");
        }
    }

    forwardResponse(response : T) {
        if (this.responseListener) {
            this.responseListener(response);
        } else {
            throw new Error("Proxy [" + this.name + "] Response listener is undefined");
        }
    }

    insertProxy(name : string, filters : Filters<S,T>) : DuplexProxy<S,T> {
        const newProxy = new DuplexProxy<S,T>(name, filters);

        newProxy.requestListener = request => this.send(request); //this.requestListener;
        this.responseListener = response => newProxy.respond(response);

        return newProxy;
    }
    
    private getForwarder() : Forwarder<S,T> {
        return {
            send : request => this.forwardRequest(request),
            respond : response => this.forwardResponse(response)
        }
    }
}
