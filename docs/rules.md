# Rules

The rule syntax allows logic to be expressed within yaml.

The simplest rule is a single expression, represented as a string.

```yaml
afterTurn(): print("Time passes")
```

## lists

Expressions can be provided as a list, in which case each expression will run.

```yaml
afterTurn():
  - print("one")
  - print("two")
  - print("three")
```

## do

Synonyms: `all`, `then`

Takes either an expression, or a list of expressions and executes each one.

```yaml
do:
  - print("One")
  - print("Two")
  - print("Three")
```

```yaml
do: print("hello world")
```

## when

Synonyms: `if`

Checks the truthyness of an expression, and if true, executes a `do`/`all`/`then`.

```yaml
when: foo == 4
do: 
  - print("hello")
  - print("world")
```

## otherwise

Synonyms: `else`

Executes if the when expression evaluates to false

```yaml
when: isHolding(candle)
then: print("You see vast treasures")
otherwise: print("It is dark, you cannot see a thing")
```

## switch

Executes each entry until one return true, then stops.

```yaml
before:
  push(this, $direction):
    switch:
      - when: direction == 'up'
        then: print("The mechanism whirs")
      - when: direction == 'down'
        then: print("The mechanism hums")
```

## repeat

Each turn executes the next item in the list. Repeats when it get's to the end. Can be used to move an NPC on a regular schedule.

```yaml
afterTurn():
  repeat: 
    - move(rat).to(cellar_east)
    - move(rat).to(cellar_south)
    - move(rat).to(cellar_west)
```

## random

Executes a random entry from the list

## once

Executes the entry only once. 

```yaml
after:
  hang(cloak).on(this):
    once: score(1)
```