# Expression language

Logic in TIFT is encoded using a javascipt-like expression language.

## Hello world
```js
print("hello world")
```
Outputs:
```
hello world
```

## Arithmetic expressions
```js
print(5 * (6 - 2))
```
Outputs:
```
20
```

## Expression chaining 
Multiple commands can be chained together using `do`
```js
do(
    print("foo"),
    print("bar"),
    print("baz")
)
```
Outputs:
```
foo
bar
baz
```

## Variable assignment
Variables can be assigned using the `=` assignement operator, `set` and `def`
### assigment operator
```js
do(
    a = 3,
    b = a + 7,
    print(a),
    print(b)
)
```
Outputs:
```
3
10
```
### set
Set sets a variable to particular value.
```js
do(
    set(a, 3),
    set(b, a + 7),
    print(a),
    print(b)
);
```
Outputs:
```
3
10
```
### def
`def` always creates a new variable. Variables are scoped to a `do` block
In this example variable `a` is shadowed by a new `a` in the nested `do` block, and the
value does not overwrite the previous value of `a`
```js
do(
    def(a,"foo"),
    def(b,"bar"),
    do(
        def(a,"baz"),
        print(a),
        print(b),
        set(b,"qux")
    ),
    print(a),
    print(b)
)
```
Outputs:
```
baz
bar
foo
qux
```

## Arrays
Arrays are defined with square brackets.
```js
do(
    obj.arr = ["foo", "bar"],
    obj.arr[0] = "baz",
    print(obj.arr[0]),
    print(obj.arr[1])
)
```
Outputs:
```
baz
bar
```

## Enhanced assignment
Enhanced assignment operators are supported `+=`, `-=`, `*=`, `/=`
```js
do(
    a = 2,
    b = 4,
    b *= a,
    a += 5 + 5,
    write(a),
    write(b)
)
```
Outputs:
```
12
8
```

## If expressions
If expressions can be written with the following syntax
`if(expr).then(if_true).else(if_false)`
```js
if(3 > 2)
    .then(print("foo"))
    .else(print("bar"))
```
Outputs:
```
foo
```

`if`s are expressions, so they return the result
```js
do(
    myvar = if(3>2)
               .then("foo")
               .else("bar"),
    print(myvar)
)
```
Outputs:
```
foo
```
## Switch expressions
Switch expression use the following syntax:

```js
do(
    set(a, 3),
    set(b, switch(a)
            .case(1).then('one')
            .case(2).then('two')
            .default('three')),
    print(b)
)
```
Outputs:
```
three
```

### Fall through
Case methods can be chained 

```js
do(
    set(a,1),
    set(b, switch(a)
                .case(1).case(2).then("one or two")
                .default('three')),
    print(b)
)
```
Outputs:
```
one or two
```

## Object properties
Although objects can't be defined in the expression language, object properties (eg created in the yaml file) can be accessed using `.` notation.

```js
do(
    player.score = 100,
    print(player.score)
)
```
Outputs:
```
100
```

## Functions
Functions can be created using `fn`

```js
do(
    def(add, fn([param1, param2], param1 + param2)),
    result = add(2,3),
    print(result)
)
```
Outputs
```
5
```

### Closures
Functions can capture the local scope when the function is created (known as a closure)
```js
do(
    def(createAdd, fn([param1], do(
        fn([param2], param1 + param2)
    ))),
    def(addSeven, createAdd(7)),
    result = addSeven(3),
    print(result)
)
```
Outputs:
```
10
```
