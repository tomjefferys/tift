# Traits
Adding certain tags to an entity applies extra behaviour to that entity.  These are traits.

## Carryable
An entities with the `carryable` tag can be picked up and moved around by the player.
They can be manipulated with the following verbs `get`, `drop`, `put`

```yaml
item: ball
name: bouncy ball
desc: A small rubber super bouncy ball
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
desc: An old tattered canvas backpack.
tags: [carryable, container]
```

### Relative Location
The `relativeLocation` field defines how items are placed within the container.  A shelf might have items placed on it, whereas a chest would have items placed in it. This is defined using the `relativeLocation` property.
Supported values are `in` and `on`.  Containers use `in` by default.

(Tip: YAML treats `on` as a boolean value, so be sure to put the value inside quotation marks)

```yaml
item: table
name: table
desc: A large wooden table.
relativeLocation: "on"
tags: [container]
```