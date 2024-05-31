# Entites

You construct TIFT games using entities.

Entities represent things in your game world, such as rooms or items

All entities will have an id field, and usually a name and description field


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