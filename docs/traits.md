# Traits
Adding certain tags to an entity applies extra behaviour to that entity.  These are traits.

## Carryable
An entities with the `carryable` tag can be picked up and moved around by the player.
They can be manipulated with the following verbs `get`, `drop`, `put`

```yaml
item: ball
name: bouncy ball
description: A small rubber super bouncy ball
tags: [carryable]
```

## Containers
An entity with the `container` tag is considered a container.  By default a container support putting items inside it, but can also be configured to allow items to be on top of it.

Containers may be `carryable`, `openable`, and `transparent`

An openable container must first be opened before items can be placed in, or retrieved from the container.
A contents of a transparent container will always be visible, even if the container is closed.

```yaml
item: backpack
name: backpack
description: An old tattered canvas backpack.
tags: [carryable, container]
```

### placement / Relative Location
The `placement` field defines how items are placed within the container.  A shelf might have items placed on it, whereas a chest would have items placed in it. This is defined using the `placement` property.
Supported values are `in` and `on`.  Containers use `in` by default.

(Tip: YAML treats `on` as a boolean value, so be sure to put the value inside quotation marks)

### Closable/Openable containers
Containers can also be given the `closable`/`openable` traits. If a container is closed, then items can not be added to or removed.

```yaml
item: table
name: table
description: A large wooden table.
placement: "on"
tags: [container]
```

### contentsVisibleWhen
By default, a container's contents are visible according to the open/closed/transparent
rules above. A container can instead define its own `contentsVisibleWhen()` function to
fully control when its contents can be seen - for example a high shelf that's only
visible while standing on something tall enough to see onto it:

```yaml
item: trunk
name: trunk
location: storageCloset
tags: [pushable]
isStoodOn(): getPlayer().standing_on == 'trunk'
---
item: shelf
name: shelf
location: storageCloset
placement: "on"
tags: [container]
contentsVisibleWhen(): trunk.isStoodOn()
---
item: candle
name: candle
location: shelf
tags: [carryable]
```

The candle here is only visible/reachable while standing on the trunk - and, since the
predicate lives on the shelf rather than the candle, this applies to *anything* placed
on the shelf, and stops applying the moment an item is picked up (moved out of the
shelf). Defining `contentsVisibleWhen` on a container **replaces** the default
open/closed/transparent check entirely, so if the container is also `openable`, include
`is_open` in your own expression if you still want that behaviour.

## Carryable

Items tagged with `carryable` or `carried` can be picked up, dropped and put in containers. They have `get`, `drop`, and `put` verbs.

If an item is tagged with `carried` then it starts off in the player's inventory.

### examples

```yaml
item: ball
description: A small ball
location: northRoom
tags: 
  - carryable
```

## Wearable

Items tagged with `wearable` or `worn` are items that can be worn.  The have the `wear` and `remove` verbs.

If an item is tagged with `worn` then it starts off being worn by the player.

```yaml
item: cloak
tags: ["carryable", "wearable"],
location : "northRoom",
```

## Openable/Closable

Items tagged with `openable`/`closable` implicitly have `open` and `close` verbs, and an `is_open` property.

`openable` indicates that the item is closed.  `closable` indicates the item start open.

```yaml
item: greenDoor
location: northRoom
description: The green door
tags:  ["openable"],
before: 
  examine(this): 
    if: "this.is_open",
    then: "print('The door is open')",
    else: "print('The door is closed')"
```

## Lockable/Locked

Items with the `lockable` tag can be locked.  `lockable` items gain the `lock` and `unlock` verbs.
They are also have `is_locked`, and `key` properties.

The `key` property can by used to specify an item that can be used to unlock this item.

If `lockable` is combined with `openable` then the item cannot be opened until it is unlocked.

```yaml
item: "door"
location: northRoom
description: The green door
key: brass_key
tags: 
  - openable
  - lockable
  - locked
before:
    examine(this): 
        if: this.is_open
        then: print('The door is open')
        else: print('The door is closed')
---
item: brass_key
location: northRoom,
verbs: 
  - unlock.with
  - lock.with
tags: 
  - carryable
```

## Pushable

Items tagged with `pushable` can be pushed. They are given the `push` verb.
Pushable items can be pushed into adjacent rooms without being picked up.

```yaml
item: box
location: northRoom
tags: 
  - pushable
```

## Light Sources
Items with the `lightSource` tag are considered light sources.

```yaml
item: torch,
tags: 
  - carryable
  - lightSource
```

## Hidden
An item with the `hidden` tag cannot be seen.

The `reveal` function can be used to unhide it.

```yaml
item: diamond
location: rubbishHeap
tags: 
  - carryable, 
  - hidden
---
item: rubbishHeap
description: A pile of stinking rubbish
location : northRoom
after:
  examine(this): 
    if: hasTag(diamond,'hidden')
    then: 
      - reveal(diamond)
      - print('You find a diamond')
```

## onlyVisibleInDark
Items tagged with `onlyVisibleInDark` are only visible while their room is dark - they
are hidden in the light (eg glow-in-the-dark items that would otherwise blend in).

```yaml
room: northRoom
description: >
  A small square room
tags:
  - start
  - dark
---
item: stickers
description: >
  glow in the dark stickers
location: northRoom
tags: 
  - carryable
  - onlyVisibleInDark
```

## NPC
Items tagged with `NPC` have an implicit `onMove` function added to them. This automatically prints a message when the NPC item moves between locations (only when the player is there to see it leave or arrive).

`NPC`-tagged items are also, implicitly, agents - see below.

## Agent

The player is a built-in example of an **agent**: something with its own inventory and worn items, that can act in the world via commands (`go`, `get`, `wear`...) the same way the player does.

Tagging any item `agent` (or `NPC` - every `NPC` is automatically an agent too) gives it its own independent inventory and worn-items containers, set up automatically when the game starts. There's nothing to declare by hand - an item authored directly into `<agentId>-INVENTORY` (or `-WEARING`) starts out carried/worn by that agent:

```yaml
item: goblin
name: Goblin
location: cave
tags:
  - NPC
---
item: dagger
location: goblin-INVENTORY
tags:
  - carryable
```

An agent's carried belongings are excluded from `look`'s item listing wherever it's standing, the same way the player's own inventory is - so a goblin holding a dagger doesn't make the dagger look like it's just lying around.

### Driving an agent's turns

Two functions let a game script make an agent act on its own behalf, reusing the same command-search/execution machinery a player's own turn uses - see [`executeCommandAs`](functions.md#executeCommandAs) and [`createPlanFor`](functions.md#createPlanFor).

A rule's `afterTurn()` is a natural place to drive an agent. There are two common patterns:

- **Plan once, then step through it.** Work out a route (eg in `beforeGame()`) and pop one command off it per turn - cheapest option when the goal isn't going to change. See `examples/GoblinThief` for a complete worked example.
- **Replan every turn.** Call `createPlanFor` again from `afterTurn()` itself, so the agent reacts to a world that's changed since its last plan (an item moved, a door opened, the player got in the way). More expensive - every turn re-runs the whole search - but necessary for an agent that can't assume an earlier plan is still valid.

Both are safe. The only thing guarded against is genuine recursion, not repeated real turns: `createPlanFor`'s search simulates full turns while it searches, including `beforeTurn()`/`afterTurn()` rules, so a rule that replans from `afterTurn()` also fires *inside* every command the search itself simulates. A nested call for an agent already being planned for further up the same call stack returns an empty plan and logs a warning instead of recursing without end (see [createPlan](functions.md#createPlan)); a call from a genuinely new turn is unaffected.

That in-progress state is checkable, not hidden engine bookkeeping - see [`isPlanning`](functions.md#isPlanning). A rule can call `isPlanning(agentId)` itself, eg to skip its own work while a search for that agent is already under way (the recommended pattern, rather than relying on the recursion guard as a backstop), or to narrate it ("the goblin pauses, thinking").
