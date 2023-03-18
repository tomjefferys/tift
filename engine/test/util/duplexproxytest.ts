import { Consumer } from "tift-types/src/util/functions";
import { createDuplexProxy } from "../../src/util/duplexproxy";


test("Test no-op proxy", () => {
    // Create the proxy
    const proxy = createDuplexProxy<string,number>("test", {});

    // Creatre the delegate, call to the proxy output
    const delegate = (str : string) => proxy.respond(str.length);

    // Bind the delegate to the proxy
    proxy.setRequestListener(delegate);

    // Create a client
    const numbers : number[] = [];
    const client = (num : number) => numbers.push(num);

    // Bind client input to the proxy
    proxy.setResponseListener(client);

    // Send values to the client output
    proxy.send("aa");
    proxy.send("aaaa");

    expect(numbers).toEqual([2,4]);
});

test("Test intercepting proxy", () => {
    // Create the proxy
    const proxy = createDuplexProxy<string,number>("test",{
        requestFilter : (str, proxy) => proxy.respond(str.length + 1)
    });

    // Creatre the delegate, call to the proxy output
    const delegate = (str : string) => proxy.respond(str.length);

    // Bind the delegate to the proxy
    proxy.setRequestListener(delegate);

    // Create a client
    const numbers : number[] = [];
    const client = (num : number) => numbers.push(num);

    // Bind client input to the proxy
    proxy.setResponseListener(client);

    // Intercept the input, and don't pass on to the delegate
    //proxy.requestHandler = (str, proxy) => (proxy.respond(str.length + 1));

    // Send values to the client output
    proxy.send("aa");
    proxy.send("aaaa");

    expect(numbers).toEqual([3,5]);
});


class Server {
    output : Consumer<number[]>;

    constructor(output : Consumer<number[]>) {
        this.output = output;
    }

    doStuff(input : string) {
        const result = input.split(" ").map(word => word.length);
        this.output(result);
    }
}

class Client {
    numbers : number[] = [];
    stuffDoer : Consumer<string>;

    constructor(stuffDoer : Consumer<string>) {
        this.stuffDoer = stuffDoer;
    }

    execute(str : string) {
        this.stuffDoer(str);
    }

    getResultListener() : Consumer<number[]>{
        return nums => this.numbers.push(...nums);
    }

}

test("Test with proxy chain", () => {
    const proxy = createDuplexProxy<string, number[]>("A", {});
    const delegate = new Server(response => proxy.respond(response));
    proxy.setRequestListener(str => delegate.doStuff(str));

    const proxy2 = proxy.insertProxy("B", { requestFilter : (str, proxy) => proxy.send(str + " " + str)});
    const proxy3 = proxy2.insertProxy("C", { responseFilter : (nums, proxy) => proxy.respond(nums.map(n => n + 1))});
    
    const client = new Client(str => proxy3.send(str));
    proxy3.setResponseListener(client.getResultListener());

    client.execute("one two three");

    expect(client.numbers).toEqual([4,4,6,4,4,6]);
});
