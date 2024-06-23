# Context

Whenever a command is executed, the game engine considers what the current context is.
Only items within the current context are considered for an action.

Entities are considered in context if they are at the same location as the player, or are being carried by the player.

## Context tags
Verbs can be configured to only function with items in a particular context.  Eg if being carried or worn.

| name | description |
|------|-------------|
| `location` | The room the player is currently located in |
| `environment` | An entity that is also at the current location, but isn't being carried or worn by the player |
| `inventory` | An entity being carried by the player |
| `wearing` | An entity being worn by the player (eg an item of clothing) |
| `container` | An entity that is in a container |