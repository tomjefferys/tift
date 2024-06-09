# Functions

## and

Performs a boolean `and` operation.

`and(expr1, expr2)`

### See also
- [not](#not)
- [or](#or)

## clearBuffer

Clear any un-flushed messages.

```yaml
do:
  - print("one")
  - print("two")
  - clearBuffer()
  - print("three")
```

Output

```
three
```

## close

Close something. Errors if the item is not openable.

`close(item)`

### see also
- [isOpenable](#isOpenable)
- [open](#open)

## closeExit

Closes an existing exit between two rooms, blocking the player from navigating between them.

`closeExit(room, direction)`

```js
closeExit(northRoom, 'south')
```

```yaml
item: door
tags:
  - cloasable
exits: 
  south: southRom
before:
  close(this): closeExit(thisRoom, 'south')
```

### see all
- [openExit](#openexit)

## delTag

Deletes a tag on an entity

`delTag(entity, tag-name)`

```yaml
room: northRoom
name: north room
tags:
  - start
  - foo
afterTurn():
  - print(hasTag(northRoom, 'foo'))
  - delTag(northRoom, 'foo')
  - print(hasTag(northRoom, 'foo'))
```

```
$ wait
> true
false
```

### See also
- [hasTag](#hasTag)
- [setTag](#setTag)

## error

Print an error message. Indicates something has gone wrong with the execution of the game.

```js
print("Something has gone wrong")
```

### see also
- [print](#print)
- [say](#say)
- [warn](#warn)

## format
Format a string. Strings can be specified using mustache expressions. `format` can be used to evaluate these strings.

### Implicit formatting
Strings containing mustache expressions are usually implicitly evaluated, and you don't normally need to call `format`. Only needs to be used if you want to explicitly control what data is passed into the expression.

To avoid implicit evaluation format strings should be defined under a `templates` property, or inlined into the expression.

```yaml
room: northRoom
name: north room
templates:
  formatStr: "foo = {{foo}}, qux = {{qux}}"
afterTurn():
  - foo = 'bar'
  - qux = 'baz'
  - print(format(templates.formatStr))
```

```
$ wait
> foo = bar, qux = baz
```

## gameOver

Triggers the game over state, and displays the provided message

`gameOver(message)`


## getEntity

Returns the entity with the corresponding is.

```js
getEntity(entityId);
```

```yaml
do:
  - mouse = getEntity('mouse1')
  - mouse.in_trap = true
```

## getFullName

Return the name of an entity, including it's article (ie `a`, or `the`).

If no article is specifies `the` is assumed.

```yaml
---
item: mouse1
name: brown mouse
verbs:
  - examine
before:
  examine(this): print("You see " + getFullName(this) + ".")
---
item: mouse2
name: white mouse
article: 'a'
verbs:
  - examine
before:
  examine(this): print("You see " + getFullName(this) + ".")
---
```

```
$ examine brown mouse
> You see the brown mouse.

$ examine white mouse
> You see a white mouse.
```

### see also
- [getName](#getName)

## getLocation

Return the id of the players current location

```js
getLocation()
```

### see also
- [isAtLocation](#isatlocation)

## getName

Return the name of an entity, or it's id if it doesn't have a name.

```yaml
item: mouse1
name: brown mouse
verbs:
  - examine
before:
  examine(this): print("You see " + getName(this))
```

```
$ examine brown mouse
> You see brown mouse
```

### see also
- [getFullName](#getFullName)

## getMetadata
Returns a metadata object. These are usually properties of the `game` object.

`getMetadata(key)`

```yaml
do:
  - print('name = ' + getMetadata('name'))
  - print('author = ' + getMetadata('author'))
```

## getPlayer

Returns the player object.

```yaml
do:
  - player = getPlayer()
  - print(player.score)

```

## getProperty

Return a game property.  These are usually defined in `properties.yaml`, but you can also define your own.

`getProperty(propertyKey, defaultValue)`

```yaml
---
property: specialStrings
messages:
  hello: "Hello World"
  goodbye: "Goodbye World"
---
rule: everyTurn
afterTurn(): 
  - print(getProperty('specialStrings.messages.hello', "Hi there"))
  - print(getProperty('specialStrings.messages.howAreYou', 'Howdy'))
---
```

```
> Hello World
> Howdy
```

## getScore

Returns the players current score

`getScore()`

### see also
- [score](#score)

## hasTag

Checks if a tag is set on an entity.

`hasTag(entity, tag-name)`

```yaml
room: northRoom
name: north room
tags:
  - start
  - foo
afterTurn():
  - print(hasTag(northRoom, 'foo'))
  - print(hasTag(northRoom, 'bar'))
```

```
$ wait
> true
false
```

### See also
- [setTag](#setTag)
- [delTag](#delTag)

## hide

Sets the hidden tag on an item, hiding it from the player.
Does the reverse of reveal

`hide(item)`

### see also
- [reveal](#reveal)

## isAtLocation

Checks if an item is at a particular location

`isAtLocation(item, room)`

```yaml
when: isAtLocation(mouse, northRoom)
then: print("squeek!")
```

### see also
- [getLocation](#getLocation)

## isCarrying

Returns true if the item is carried by the player

`isCarrying(item)`

### see also
- [isHolding](#isHolding)

## isHolding

Returns true if the item is held by the player

`isHolding(item)`

### see also
- [isCarrying](#isCarrying)

## isInContainer

Return true if an item is in a container.

```yaml
---
item: purse
tags:
  - container
---
item: coin
location: purse
before:
  drop(this): 
    - when: isInContainer(this)
      then: print("You can't drop the coin whilst it is inside the purse")
      otherwise:
        - return(false)
---
```

## isOpenable

Returns true if the item is something that can be opened.
The open/closed status has no effect on this call

`isOpenable(item)`

### see also
- [open](#open)
- [close](#close)

## move

Move an item to another location

`move(item).to(location)`

```js
move(cat).to(kitchen)
```

## not

Performs a boolean `not` operation.

`not(expression)`

### See also
- [and](#and)
- [or](#or)

## obj

Create an object.

```yaml
do: 
  - myObj = obj()
  - myObj.property1 = "Hello"
  - myObj.property2 = 4
```

## open

Open something. Errors if the item is not openable.

`open(item)`

### see also
- [isOpenable](#isOpenable)
- [close](#close)

## openExit

Opens a new exit from a room. Once enabled the appropriate navigation option will be available to the player.

`openExit(room, direction, destination)`

```js
openExit(northRoom, 'south', southRoom)
```

```yaml
item: door
tags:
  - openable
before:
  open(this): openExit(thisRoom, 'south', southRoom)
```

### see also
- [closeExit](#closeexit)

## or

Performs a boolean `or` operation.

`or(expr1, expr2)`

### See also
- [not](#not)
- [and](#and)

## print

Prints a message.

```js
print("Hello World!")
```

### see also
- [say](#say)
- [warn](#warn)
- [error](#error)

## random

Returns a random number between a two values (inclusive)

`random(low, high)`

```yaml
do: 
  - print(random(1, 6))
  - print(random(1, 6))
  - print(random(1, 6))
  - print(random(1, 6))
```

Output
```
3
6
1
4
```

## return

Returns the value of the expression. Can't be used to return early from a function. Used to label the final value in a series of expressions.

`return(expr)`

## reveal

Removes the hidden tag on an item. Makes it visible to the player

```yaml
---
item: diamond
location: rubbish
tags:
  - carryable
  - hidden
---
item: rubbish
description: A pile of stinking rubbish
location: northRoom
after:
  examine(this):
    when: hasTag(diamond,'hidden')
    then: reveal(diamond)
---
```

### see also
- [hide](#hide)

## say

Prints out a message surrounded by quotes.

say(message)

```
say("Hello World")
```

Outputs:
```
"Hello World"
```

### see also
- [print](#say)
- [warn](#warn)
- [error](#error)

## score

Increase the players score by the specified number of points.
Consider using a `once` rule to avoid it repeatedly triggering.

`score(points)`

```yaml
item: ball
name: ball
description: you'll score a point if you pick the ball up!
tags:
  - carryable
after:
  get(this):
    once: score(1)
```

### see also
- [getScore](#getScore)

## setLocation

Sets the location of the player.

`setLocation(newLocation)`

```js
setLocation(northRoom)
```

## setTag

Sets a tag on an entity

`setTag(entity, tag-name)`

```yaml
room: northRoom
name: north room
tags:
  - start
  - foo
afterTurn():
  - print(hasTag(northRoom, 'bar'))
  - setTag(northRoom, 'bar')
  - print(hasTag(northRoom, 'bar'))
```

```
$ wait
> false
true
```

### See also
- [hasTag](#hasTag)
- [delTag](#delTag)


## tick

Force time to pass.  Some verbs are classified as instant (such as look, and examine), and don't force a new turn. `tick` can override this.

```yaml
item: longScroll
name: long scroll
desc: The scroll is *really* long, and time passes as you read it.
after:
  examine(this): tick()
```

## warn

Print a warning message. Indicates that something may have gone wrong with the execution of the game, but the game can still continue.

```js
print("Something does not seem right")
```

- [print](#print)
- [say](#say)
- [error](#error)

