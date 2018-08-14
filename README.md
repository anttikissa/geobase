# Geobase

## Intro

Clients establish a WebSocket connection to the server. They can create,
update, and delete objects. Clients can also listen to changes within a
region. All objects have a type (a string), an id (a number), and a
location (lat + long). Any other properties can be used freely.

## Wire protocol, an example

All communications consist of a command, followed by a space and
JSON-like data. Uses
[relaxed-json](https://github.com/phadej/relaxed-json) to parse the
arguments. The server sends back a statement, following with stringified
JSON (which can also be a string, in case of error messages.)

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

## The client sends commands to the server:

### PING

Says hello to the server.

### GET `{ type, minLat, maxLat, minLong, maxLong }`

Gets all objects of type `type` within the range. Boundaries are
optional.

### LISTEN `{ type, minLat, maxLat, minLong, maxLong }`

Tells server to send changes from this region. If this is the first time
in this session, the server first sends all data from the region with a
sequence of UPDATE statements.

### UPDATE `{ type, id, lat, long, ...data }

Creates or updates an object. CREATE or UPDATE statements are issued to
listening clients.

## The server sends statements to the client:

### PONG

I heard you.

### DATA `[ object1, object2, ... ]`

Response to the GET command.

### UPDATE `{ type: '...', id: ..., timestamp, ...changes }`

Tells a listening client that an object was updated.

### CREATE `{ type: '...', id: ..., timestamp, ...attributes }

Tells a listening client that an object was created.

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

- Make `type` optional - not every application needs them, also would make
the examples simpler.

- Maybe make lat/long into x/y.

- Better error messages for missing/extra parameters etc.

