# Geobase

## Intro

Clients establish a WebSocket connection to the server. They can create,
update, and delete objects. Clients can also listen to changes within a
region. All objects have an immutable `type` (a string), an immutable
`id` (a number), and increasing version `v`, a `timestamp`, and a
location (`lat` + `long`) that may change. Any other properties can be
used freely.

The `id` determines the object identity within the `type`. Objects with
different types have nothing to do with each other and can therefore
have overlapping types.

The aim is to build a simplest possible efficient system for a large
amount of clients to keep track of geospatially distributed data that
changes often. We're not quite there yet. (See the TODO section.)

## Wire protocol, an example

All communications consist of a command followed by a space and
JSON-like data. [relaxed-json](https://github.com/phadej/relaxed-json)
is used to parse the arguments. The server sends back a statement
following with stringified JSON (which can also be a string, in case of
error messages.)

```
> GET { type: 'x' }
< DATA []
> UPDATE { type: 'x', id: 1, name: 'Joe', lat: 5, long: 5 }
< CREATED
{"created":true,"moved":false,"object":{"type":"x","id":1,"name":"Joe","lat":5,"long":5,"v":1534246018589},"changes":{"type":"x","id":1,"name":"Joe","lat":5,"long":5,"v":1534246018589}}
> UPDATE { type: 'x', id: 1, name: 'Joe', surname: 'Johnson', age: 10
< UPDATED
{"created":false,"moved":false,"object":{"type":"x","id":1,"name":"Joe","surname":"Johnson","age":10,"v":1534246062220},"changes":{"surname":"Johnson","age":10,"v":1534246062220}}
```

Client 1 says:
```
> LISTEN { type: 'partner', minLat: 60, maxLat: 62, minLong: 24, maxLong: 26 }
< OK "I'll keep you posted, dear."
```

Meanwhile, some other client says:
```
> UPDATE { type: 'partner', id: 10, lat: 61, long: 25, name: "Bob's burgers" }
```

Client 1 gets:
```
CREATE {"type":"partner","id":10,"lat":61,"long":25,"name":"Bob's
burgers","v":1534246311133}
```

When clients are updated, only the actually changed values are propagated
to listeners. Client 2:

```
UPDATE { type: 'partner', id: 10, long: 25.012, name: "Bob's burgers", description: 'Great place to be' }
```

Client 1 gets the updated information:
```
UPDATE {"type":"partner","id":10,"long":25.012,"description":"Great place to be","v":1534246397443}
```

You don't need to specify types (though they show up in server-to-client
communication as an empty string):

```
> LISTEN { minLat: 50, maxLat: 70, minLong: 50, maxLong: 70 }
< OK "I'll keep you posted, dear."
> UPDATE { id: 1, name: 'Hello', lat: 60, long: 60 }
< CREATE {"id":1,"name":"Hello","lat":60,"long":60,"type":"","v":1534249726412}
< CREATED
{"created":true,"moved":false,"object":{"id":1,"name":"Hello","lat":60,"long":60,"type":"","v":1534249726412},"changes":{"id":1,"name":"Hello","lat":60,"long":60,"type":"","v":1534249726412}}
```

If an object within your listening area moves outside the area, you will
get an UPDATE statement of the update that caused it to exit the area,
but will no longer be updated about that object's changes as long is it
stays outside the listening area.

If an object update causes it to enter your listening area, you will
receive all of its properties (instead of only the ones that changed,
which is the case normally).

## To test it

```
./start
open http://localhost:3000/
```

## The client sends commands to the server:

For all commands that require the `type` argument, you can leave it out,
in which case the command will behave as if the type were `''`.

### PING / PONG

Used to keep the connection alive.

### GET `{ type, minLat, maxLat, minLong, maxLong }`

Gets all objects of type `type` within the range. Boundaries are
optional: `GET { type: 'x' }` gets all objects of type 'x'.

You can also get an object with its id: `GET { type: 'x', id: 1 }`

### LISTEN `{ type, minLat, maxLat, minLong, maxLong }`

Tells server to send changes from this region. If this is the first time
in this session, the server first sends all data from the region with a
sequence of UPDATE statements. (This might not be optimal. See TODO
list)

A subsequent LISTEN command from the same client does not add a new
listening area, but instead replaces your current one. If your listening
area is enlarged, the server sends you UPDATE statements of the objects
that you didn't previously listen to.

A LISTEN command without arguments tells your listening area, if any.

### UPDATE `{ type, id, lat, long, ...data }`

Creates or updates an object. CREATE or UPDATE statements are issued to
listening clients.

## The server sends statements to the client:

### PING / PONG

Used to keep the connection alive.

### DATA `[ object1, object2, ... ]`

Response to the GET command.

### UPDATE `{ type: '...', id: ..., timestamp, ...changes }`

Tells a listening client that an object was updated.

### CREATE `{ type: '...', id: ..., timestamp, ...attributes }

Tells a listening client that an object was created. Generally a client
should treat this in the same way as an UPDATE command, but sometimes it
may be useful to know which objects were newly created while you were
connected to the server.

### DELETE `{ type: '...', id: ..., timestamp }`

Tells a listening client that an object was deleted.

### UPDATED / CREATED / DELETED

Tells a commanding client that the action was completed.

### ERROR

Something went wrong.

### NOTFOUND

An object was not found. (Might be joined with ERROR some day)

## BUGS / TODO

- Implement persistence.

- The client should be able to catch up with the latest changes with the
  GET command. The GET command should have an argument for the last seen
  timestamp / version and the server should update only the changed
  ones.  Now the client must update the whole dataset they're interested
  in upon reconnect.

- (Make sure that deleted objects are treated right in the above case.)

- There might have been some kind of bug with DELETE statement, not sure
  if my memory serves well

- Maybe make lat/long into x/y.

- Better error messages for missing/extra parameters etc.

