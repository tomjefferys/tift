# Command Matching

When a player executes a command, each entity in scope is checked to see if it has relevant command matcher.

## before, action, after

Command matchers are defined in either `before`, `action` or `after` entry.

An `action` is the main action, and is usually defined on a verb.
`before` entries allow an entity to intercept an action.
The result of a `before` action is checked for truthyness.  A value of true indicates that command has been handled, and stops further processing by any other `before` or `action` entries on any entity or verb.

`after` entries execute after everything else has been run.

## Command Matchers

Command matchers are specified with the following format.

```
verb()
verb(directObject)
verb(directObject, modifier)
verb(directObject).attribute(indirectObject)
verb(directObject).attribute(subCommand)
```

The last form is for [clausal verbs](./verbs.md#sub-commands-clausal-verbs), where the
attribute's argument is itself a whole nested command (see [Sub-commands](#sub-commands)
below), rather than a single indirect object.

### Specifying and capturing item
Objects and modifiers can be specified exactly, or by capturing a value.

#### Matching `this`
`this` is used to specify that the matcher should match the current object.

#### Matching a specific object
Use the item id.

eg
```yaml
push(theBox): print("you push the box")
```

#### Matching any object and capturing its id  
Specify a capture by providing a variable staring with a `$`.
The variable can then be used later by omitting the `$`

```yaml
push($pushable): print("you push " + getFullName(pushable))
```

#### Matching any modifier and capturing its value
A modifier capture needs to be matched using the modifier name, there could be several modifiers and we need to know which one matches.

eg 

```yaml
push(this, $direction): print("You push " + direction)
push($pushable, $direction, $effort): print("You push " + getFullName(pushable) + " " + direction + " with " + effort)
```

### examples

Intercepting a simple get command
```yaml
item: hotRock
name: hot rock
tags:
  - carryable
before:
  get(this): print("Ouch!")
```

Handling an attributed verb
```yaml
---
npc: barkeep
name: barkeep
location: theRoom
verbs:
  - ask
---
verb: ask
tags:
  - transitive
attributes:
  - about
---
item: beerThought
location: theRoom
verbs: ask.about
before:
  ask(barkeep).about(this): print("I recommend the porter")
---
```

Matching a modified verb

```yaml
item: box
tags:
  - pushable
isStuck: true
before:
  push(this, $direction):
    when: this.isStuck
    then: print("You cannot push the box " + direction)
    otherwise: return(false)
```

## Sub-commands

A [clausal verb](./verbs.md#sub-commands-clausal-verbs) like `tell` takes a sub-command as its
attribute's argument. That sub-command is written and matched exactly like an ordinary
top-level command matcher - `subVerb`, `subVerb(subObjectOrModifier)`, or
`subVerb(subObject).attribute(subIndirectObject)` - just nested inside the outer attribute
call, so the syntax stays the same at every level:

```yaml
---
item: robot
verbs:
  - tell
before:
  tell(this).to(go($direction)): print("The robot whirs off to the " + direction)
  tell(this).to(fire($target)): print("The robot fires its laser at " + getFullName(target))
---
```

A bare sub-verb with no arguments (eg `wait`) is written the same way a bare intransitive
verb is at the top level - with or without parentheses, `tell(this).to(wait)` and
`tell(this).to(wait())` are equivalent.

The sub-verb itself can also be captured, eg to write one handler for any command - the
capture becomes the call name, and still takes whatever arguments that particular sub-verb
needs:

```yaml
before:
  tell(this).to($action($direction)): print("The robot tries to " + action.id + " " + direction)
```

### Attributed sub-verbs

If the sub-verb itself takes an attribute (eg `stir soup with spoon`), write it exactly as
you would at the top level, nested as the single argument to the outer attribute:

```yaml
before:
  tell(this).to(stir($item).with($tool)): print("The robot stirs " + item.name + " with " + tool.name)
```

As with a normal attributed verb, if the sub-verb has the `indirectOptional` tag the
`.with(...)` part can be omitted, eg `tell(this).to(stir(soup))` alone still matches
`tell robot to stir soup`.




