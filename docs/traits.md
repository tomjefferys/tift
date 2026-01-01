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

### Adposition / Relative Location
The `adposition` field defines how items are placed within the container.  A shelf might have items placed on it, whereas a chest would have items placed in it. This is defined using the `adposition` property.
Supported values are `in` and `on`.  Containers use `in` by default.

(Tip: YAML treats `on` as a boolean value, so be sure to put the value inside quotation marks)

### Closable/Openable containers
Containers can also be given the `closable`/`openable` traits. If a container is closed, then items can not be added to or removed.

```yaml
item: table
name: table
description: A large wooden table.
adposition: "on"
tags: [container]
```

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

## visibleWhenDark
Items tagged with `visibleWhenDark` can be seen in the dark.

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
  - visibleWhenDark
```

## NPC
Items tagged with `npc` have and implicit onMove function added to them. This automatically prints a message when the npc item moves between locations.
