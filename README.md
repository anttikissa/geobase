# Geobase

## Wire protocol, example

```
< UPDATEME { type: 'partner', latMin: 60.12, latMax, 60.45, longMin: 24.85, longMax: 25.41 }
> DATA [
  { type: 'partner', timestamp: '2017-10-11 00:04:37.652Z', id: 526, lat: 60.4, long: 24.91, name: 'Some Place', offersLeft: 3 },
  { type: 'partner', timestamp: '2017-10-11 00:02:37.652Z', id: 627, lat: 60.34, long: 25.1, name: 'Another Place', offersLeft: 3 }
]
> UPDATE { type: 'partner', id: 526, timestamp: '2017-10-11 00:09:40.010Z', offersLeft: 2 }
> CREATE { type: 'partner', id: 948, id: 627, lat: 60.3, long: 25.01, timestamp: '2017-10-11 00:15:00.123Z', offersLeft: 0 }
< UPDATEME { type: 'partner', latMin: 60.22, latMax: 60.55, longMin: 24.85, longMax: 25.41 }
```

## The client sends *commands* to the server:

### PING

Says hello to the server.

### UPDATEME `{ type, latMin, latMax, longMin, longMax }`

Tells server to send changes from this region. If this is the first time in this session, the server first sends all data from the region in a DATA statement.

## The server sends *statements* to the client:

### PONG

I heard you.

### DATA `[ object1, object2, ... ]`

Inform client of an initial set of objects. On each new UPDATEME, a DATA statement is sent with the new objects in the range.

### UPDATE `{ type: '...', id: ..., timestamp, ...changes }`

Update client with changed attributes.

### CREATE `{ type: '...', id: ..., timestamp, ...attributes }

Tell client that an object was created.

### DELETE `{ type: '...', id: ..., timestamp }`

Tell client that an object was deleted.


