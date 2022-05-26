import jsep from 'jsep';

test("Simple Jsep test", () => {
    const parseTree = jsep('1 + 1');
    console.log(JSON.stringify(parseTree));
})
