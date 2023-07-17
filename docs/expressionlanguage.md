# Expression language

Logic in TIFT is encoded using a javascipt-like expression language.

## Hello world
```
print("hello world")
```
Outputs:
```
hello world
```

## Arithmetic expressions
```
print(5 * (6 - 2))
```
Outputs:
```
20
```

## Expression chaining 
Multiple commands can be chained together using `do`
```
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
```
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
```
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
```
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
```
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
```
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

## If statements
If expressions can be written with the following syntax
`if(expr).then(if_true).else(if_false)`
```
if(3 > 2)
    .then(print("foo"))
    .else(print("bar"))
```
Outputs:
```
foo
```

`if`s are expressions, so they return the result
```
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