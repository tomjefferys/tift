# Entites

You construct TIFT games using entities.

Entities represent things in your game world, such as rooms or items

All entities will have an id field, and usually a name and description field.

## Entity types
The following properties define the type of an entity. The value should be a unique id for the entity.

| Type | Description |
|------|-------------|
| `room` | A location within your game |
| `item` | An item. Usually something you can interact with. Sometime, but not always can be carried. |
| `verb` | A verb. Describes a mechanism for interacting with the game world. |
| `rule` | Some logic that will run every turn |
| `property` | Used to define a global string property or template |
| `global` | Used to define a globally accessible property or function |


## Entity fields
The following fields can be set on most entity types.

| name | description |
|------|-------------|
| `name` | The name of the entity.  This is the value that will be shown in the game |
| `description` | A description of the entity. If present, the examine verb will be activated for this entity |
| `tags` | A list of strings, representing some state for the entity |
| `beforeGame()` | A function that will be executed before the game starts |
| `beforeTurn()` | A function that will be executed before every turn, if the entity it in the current  [context](context.md) |
| `afterTurn()` | A function that will be executed after every turn, if the entity is in the current [context](context.md) |


## Rooms/Items

## Room

A room consists of a YAML document with the following properties:

|property| Mandatory | Description |
|---|---|---|
|`room`|Yes|Unique id|
|`description`|no|A description|
|`exits`|no|An array of exits, and the rooms they lead to|

### Tags
#### `start`
This is room that the player starts in.  There should only be one of these

#### `dark`
This room has no light, any items in this room will not be visible unless the player is carrying a [lightsource](./traits.md#light-sources)

#### `pseudoRoom`
This is treated as a special location (eg an endgame room). This room will have no context, and the usual verbs for movement will not be available.

### Example
```yaml
room: squareRoom
description: |
  The room is dark and square.
  In the middle is a fountain
tags: [start]
exits:
  south: redRoom
  east: garden
```


## Item

An item is an entity that can be interacted with in some way.

|property| Mandatory | Description |
|---|---|---|
|`item`|Yes|Unique id|
|`description`|no|A description|
|`verbs`|no|An array of verbs that can be used to interact with the item|

Various [traits](traits.md) can be assigned to an item, these are specified using tags.

### Examples
```yaml
item: cloak
name: velvet cloak
description: >
  A cloak of purest black, a little damp from the rain, its darkness seems to suck in all the light.
tags:
  - carryable
  - worn
verbs:
  - hang
```

```yaml
item: chair
name: chair
desc: |
  Rough and uncomfortable, made of sturdy but unfinished wood.
  No one has ever wanted to sit on it, the risk of a painful splinter too high.
location: cellar_south
sat_on: false
standing_on: false
tags:
  - pushable
verbs: 
  - stand: sat_on
  - sit: not(sat_on) 
before:
  go($direction):
    switch:
      - when: sat_on
        do: print("You're not going anywhere whilst sitting down")
  push(this, $direction):
     when: or(sat_on)
     do: print("You need to get off the chair before you push it")
  sit(this):
    when: not(sat_on)
    do: 
      - print("You sit on the chair")
      - standing_on = false
      - sat_on = true
    otherwise: "'You are already sitting on the chair'"
  stand:
    when: sat_on
    do:
      - print("You stand up")
      - sat_on = false
    otherwise: print("You are already standing")
after:
  look:
    switch:
      - when: sat_on
        do: print("You are sitting on the chair")
```