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

## Sub-commands (clausal verbs)

A verb can take a whole sub-command as its attribute's object, instead of a single indirect
object. This is used for commanding another entity, eg `tell robot to go north`.

A verb becomes "clausal" by declaring a `commands` list: the sub-verbs it will accept.
It still needs the usual `transitive` tag (its direct object is the entity being commanded)
and an `attributes` entry (the connecting word, eg `to`).

```yaml
verb: tell
tags:
  - transitive
attributes:
  - to
commands:
  - go
  - fire
```

```yaml
item: robot
verbs:
  - tell
```

With the above defined (and `go`/`fire` verbs available elsewhere), `tell robot to go north`
and `tell robot to fire laser` become valid commands. The sub-verb's own grammar still
applies: an intransitive sub-verb with modifiers (like `go`) needs a modifier to complete the
command, a transitive sub-verb (like `fire`) needs a direct object, and an attributed
sub-verb (like `stir`) can take its own indirect object, eg `tell robot to stir soup with
spoon` - including `indirectOptional`, so `tell robot to stir soup` alone is also valid if
`stir` allows it.

Only the verbs listed in `commands` are offered after the connecting word - `commands` is an
explicit allow-list on the commanding verb (`tell`), not something the commanded entity opts
into.

See [command matching](./commandmatching.md#sub-commands) for how to write actions that
respond to a sub-command.