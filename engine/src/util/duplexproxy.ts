import { Consumer } from "tift-types/src/util/functions";
import { Forwarder, RequestFilter, ResponseFilter, Filters, DuplexProxy } from "tift-types/src/util/duplexproxy"


export function createDuplexProxy<S,T>(name : string, filters : Filters<S,T>) : DuplexProxy<S,T> {
    return new DuplexProxyImpl(name, filters);
}

/**
 * A proxy that can sit between arbirary client, and servers filtering both requests and responses
 * Request are pushed in using the send method
 * Resposnes are pushed using the response method
 * 
 * Listeners need to be set to listen to to the requests and responses
 * 
 */
class DuplexProxyImpl<S,T> implements DuplexProxy<S,T> {
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
    async send(request : S) {
        await this.requestFilter(request, this.getForwarder());
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
        const newProxy = new DuplexProxyImpl<S,T>(name, filters);

        newProxy.requestListener = async request => this.send(request); //this.requestListener;
        this.responseListener = response => newProxy.respond(response);

        return newProxy;
    }
    
    private getForwarder() : Forwarder<S,T> {
        return {
            send : async request => this.forwardRequest(request),
            respond : response => this.forwardResponse(response)
        }
    }
}
