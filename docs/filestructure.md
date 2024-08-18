# File structure

A Tift game consists of a single file containing multiple YAML documents.
YAML is a human readable markup language, similar to json.

An example might look like:

```yaml
---
room: northRoom,
description: The room is dark and square
tags: 
  - start
---
item: ball
name: The ball
description: The ball is red and bouncy
tags:
  - carryable
  - pushable
---
```

This contains two YAML documents separated by a `---`.  They both describe entities.  `northRoom` is a location, and `ball` is an item.

YAML has nice syntax for multiline strings, allowing for long descriptions
```yaml
---
room: northRoom
description: |
  The room is dark and square.
  In the middle is a fountain which gurgles with muddy water
tags:
  - start
---
```

YAML documents are typically either [entities](entities.md), [verbs](verbs.md), or [rules](rules.md)
