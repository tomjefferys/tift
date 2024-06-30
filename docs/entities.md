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

eg
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

An item