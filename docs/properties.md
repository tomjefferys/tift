# Properties

Properties are common templates and messages.
A default set of these is provided, and contains basic templates for the output of default verbs, such as `look`

These are stored in the `properties.yaml` file by default.

Properties are defined as an individual yaml document eg

```yaml
---
property: open
message: You open {{name}}
templates:
  isLocked: "{{#sentence}} {{item}} is locked {{/sentence}}"
---
```

Properties can be overridden on an individual entity, by adding a `properties` property to the object.  eg

```yaml
item: trolley
name: shopping trolley
description: A battered old shopping trolley
tags:
  - NPC
  - container
properties:
  location:
    messages:
      leaves: The trolley rolls {{direction}}
      arrives: The trolley rolls from {{direction}}
```