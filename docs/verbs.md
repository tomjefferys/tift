# Verbs

Verbs are defined as a yaml object, similar to entities.

A simple verb might look as follows.

```yaml
verb: fuddle
tags:
  - transitive
```

Each entity will contain a list of verbs that can be used to interact with that entity, this is specified in the entities verb list.

## Transitive/intransitive verbs
Verbs are either transitive, or intransitive.`
Transitive verbs need an object eg `get ball`
Intransitive verbs don't need an object eg `stand`

These are specified as tags.

## Attributes
Verb attributes are prepositions that can be used to combine a verb with two objects.
eg in the phrase `stir soup with spoon` the word `with` is an attribute.

An example attribute would look like:

```yaml
verb: spray
tags:
  - transitive
attributes: ['on']
actions:
  spray($spray).on($that): print("You {{spray.name}} on the {{that.name}}")
```

```yaml
verb: stir
tags:
  - transitive
attributes:
  - with
```

Entities specify a verb attribute in their verb with the following syntax:
`<verb>.<attribute>`

```yaml
item: soup
verbs:
  - stir
---
item: spoon
verbs:
  - stir.with
```

With the above items defined, you could execute `stir soup with spoon`

## Modifiers

Modifiers are words that add extra information, such as directions.

```yaml
verb: turn
tags:
  - transitive
modifiers:
  - turn_direction
```

In this example, a `turn_direction` modifier is specified.
The values available are context dependent, and are based on the object they are acting on.
eg

```yaml
item: crank
verbs:
  - turn
modifiers:
  turn_direction:
    - clockwise
    - anticlockwise
before:
  turn(this, $turn_direction): 
    - print("The crank turns, gears grind. ")
```

To capture the value of a modifier in an action, you need to use the full name of the modifier (ie `$turn_direction` in the above example)

## contexts

A verb can be made available only if it's object is in certain [contexts](./context.md).  Eg you might need to be carrying an item before you can use it.

In this example, the `hang` verb can only be used on an object whose item is in the players inventory, or is being worn.

```yaml
verb: hang
tags:
  - transitive
attributes:
  - "on"
contexts:
  - inventory
  - wearing
actions:
  hang($hangable).on($hanger):
    - moveItemTo(hangable, hanger)
```

## Instant

Verbs that are tagged as `instant` do not take any time to execute, and won't increment the turn counter.
Instant verbs, should not alter game state, and are meant for verbs such as `examine`.