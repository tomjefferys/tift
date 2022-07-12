import jsep from 'jsep';

test("Simple Jsep test", () => {
    //const parseTree = jsep('1 + 1');
    const parseTree = jsep('if(health == 0).then("you die").else("you live")');
    console.log(JSON.stringify(parseTree, null, 2));
})
