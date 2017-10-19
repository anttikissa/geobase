const MemoryDb = require('./memory');
const log = console.log;

let db;

beforeEach(() => {
	db = new MemoryDb();
});

const mapSize = (map) => [...map.keys()].length;

test('listen', async () => {
	const connection = {};
	const connection2 = {};

	expect(mapSize(db.getListeners('a'))).toBe(0);

	db.listen(connection, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
	expect(mapSize(db.getListeners('a'))).toBe(1);

	db.listen(connection, 'a', { minLat: 5, maxLat: 15, minLong: 0, maxLong: 10 });
	expect(mapSize(db.getListeners('a'))).toBe(1);

	db.listen(connection2, 'a', { minLat: 5, maxLat: 15, minLong: 0, maxLong: 10 });
	expect(mapSize(db.getListeners('a'))).toBe(2);

	db.stopListening(connection, 'a');
	expect(mapSize(db.getListeners('a'))).toBe(1);

	db.stopListening(connection2, 'a');
	expect(mapSize(db.getListeners('a'))).toBe(0);
});

test('getListeningProfile', async () => {
	const connection = {};

	db.listen(connection, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

	expect(db.getListeningProfile(connection, 'a')).toEqual({ type: 'a', minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
});

test('listen with existing data', async () => {
	await db.updateObject({ type: 'a', id: 1, lat: 5, long: 5, name: 'X' });
	await db.updateObject({ type: 'a', id: 2, lat: 15, long: 5, name: 'Y' });
	await db.updateObject({ type: 'a', id: 3, lat: 7, long: 7, name: 'Z' });

	const connection = {
		onUpdate: jest.fn()
	};

	await db.listen(connection, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

	expect(connection.onUpdate.mock.calls.length).toBe(2);
	expect(connection.onUpdate.mock.calls[0][0]).toEqual({ type: 'a', id: 1, lat: 5, long: 5, name: 'X' });
	expect(connection.onUpdate.mock.calls[1][0]).toEqual({ type: 'a', id: 3, lat: 7, long: 7, name: 'Z' });
});

test('listen that changes listener props', async () => {
	const connection = {};

	db.listen(connection, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
	expect(db.getListeningProfile(connection, 'a')).toEqual({ type: 'a', minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

	db.listen(connection, 'a', { minLat: -5, maxLong: 5 });
	expect(db.getListeningProfile(connection, 'a')).toEqual({ type: 'a', minLat: -5, maxLat: 10, minLong: 0, maxLong: 5 });
});

test('listen with existing data and changing properties', async () => {
	await db.updateObject({ type: 'a', id: 1, lat: 5, long: 5, name: 'X' });
	await db.updateObject({ type: 'a', id: 2, lat: 8, long: 7, name: 'Y' });
	await db.updateObject({ type: 'a', id: 3, lat: 11, long: 7, name: 'Z' });
	await db.updateObject({ type: 'a', id: 4, lat: 11, long: 12, name: 'W' });

	const connection = {
		onUpdate: jest.fn()
	};

	await db.listen(connection, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

	expect(connection.onUpdate.mock.calls.length).toBe(2);
	expect(connection.onUpdate.mock.calls[0][0]).toEqual({ type: 'a', id: 1, lat: 5, long: 5, name: 'X' });
	expect(connection.onUpdate.mock.calls[1][0]).toEqual({ type: 'a', id: 2, lat: 8, long: 7, name: 'Y' });

	await db.listen(connection, 'a', { minLat: 6, maxLat: 12, minLong: 7, maxLong: 15 });

	expect(connection.onUpdate.mock.calls.length).toBe(4);
	expect(connection.onUpdate.mock.calls[2][0]).toEqual({ type: 'a', id: 3, lat: 11, long: 7, name: 'Z' });
	expect(connection.onUpdate.mock.calls[3][0]).toEqual({ type: 'a', id: 4, lat: 11, long: 12, name: 'W' });
});

test('listen parameter check', async () => {
	const listener = {};

	// TODO wonder if Jest can do this one day
	function expectPromiseToRejectWithMessage(promise, message) {
		promise.then(fail).catch(err => {
			expect(err.message).toBe(message);
		});
	}

	expectPromiseToRejectWithMessage(
		db.listen(listener, 123, {}),
		'type is not of type string: 123'
	);

	expectPromiseToRejectWithMessage(db.listen(listener, 'a', { minLat: '5.55' }),
		'minLat is not of type number: 5.55'
	);

	expectPromiseToRejectWithMessage(db.listen(listener, 'a', { minLat: 5.55 }),
		'maxLat is not of type number: undefined'
	);

	// Updating an existing listener, the changing property is checked:
	db.listen(listener, 'a', { minLat: 0, maxLat: 1, minLong: 0, maxLong: 1 });
	expectPromiseToRejectWithMessage(
		db.listen(listener, 'a', { maxLong: 'hello' }),
		'maxLong is not of type number: hello'
	);
});

test('getAllListeningTypes (internal)', async() => {
	let listener = {};

	expect(db.getAllListeningTypes()).toEqual([]);

	db.listen(listener, 'a', { minLat: 0, maxLat: 1, minLong: 0, maxLong: 1 });
	expect(db.getAllListeningTypes()).toEqual(['a']);

	db.listen(listener, 'b', { minLat: 0, maxLat: 1, minLong: 0, maxLong: 1 });
	expect(db.getListeningProfile(listener, 'b')).not.toBe(undefined);
	expect(db.getAllListeningTypes()).toEqual(['a', 'b']);

	// Even if the last listener stops listening, the type stays
	db.stopListening(listener, 'b');
	expect(db.getListeningProfile(listener, 'b')).toBe(undefined);
	expect(db.getAllListeningTypes()).toEqual(['a', 'b']);

});

test('getOne', async () => {
	expect(await db.getOne('a', 2)).toEqual(undefined);
	await db.updateObject({ type: 'a', id: 2, lat: 3, long: 4 });
	expect(await db.getOne('a', 2)).toEqual({ type: 'a', id: 2, lat: 3, long: 4 });
	await db.updateObject({ type: 'a', id: 2, lat: 3, long: 5 });
	expect(await db.getOne('a', 2)).toEqual({ type: 'a', id: 2, lat: 3, long: 5 });
	await db.deleteObject({ type: 'a', id: 2 });
	expect(await db.getOne('a', 2)).toEqual(undefined);
});

test('deleteObject', async () => {
	db.deleteObject({ type: 'a', id: 2 });
});

test('getAll', async () => {
	await db.updateObject({ type: 'a', id: 1, lat: 5, long: 5 });
	await db.updateObject({ type: 'a', id: 2, lat: 6, long: 6 });
	await db.updateObject({ type: 'a', id: 3, lat: 60, long: 60 });
	await db.updateObject({ type: 'b', id: 3, lat: 6, long: 7 });

	expect(await db.getAll('a')).toEqual([
		{ type: 'a', id: 1, lat: 5, long: 5 },
		{ type: 'a', id: 2, lat: 6, long: 6 },
		{ type: 'a', id: 3, lat: 60, long: 60 }
	]);

	expect(await db.getAll('b')).toEqual([
		{ type: 'b', id: 3, lat: 6, long: 7 }
	]);

	expect(await db.getAll('a', { minLong: 5.5 }))
	.toEqual([
		{ type: 'a', id: 2, lat: 6, long: 6 },
		{ type: 'a', id: 3, lat: 60, long: 60 }
	]);

	expect(await db.getAll('a', { minLat: 5.5 }))
	.toEqual([
		{ type: 'a', id: 2, lat: 6, long: 6 },
		{ type: 'a', id: 3, lat: 60, long: 60 }
	]);

	expect(await db.getAll('a', { maxLat: 5.5 }))
	.toEqual([{ type: 'a', id: 1, lat: 5, long: 5 }]);

	expect(await db.getAll('a', { maxLong: 20 }))
	.toEqual([
		{ type: 'a', id: 1, lat: 5, long: 5 },
		{ type: 'a', id: 2, lat: 6, long: 6 }
	]);

	await db.updateObject({ type: 'a', id: 3, lat: 4.7, long: 7 });

	// Combine multiple filters
	expect(await db.getAll('a', { minLat: 4.5, maxLat: 5.5, minLong: 4.9, maxLong: 7.2  }))
	.toEqual([
		{ type: 'a', id: 1, lat: 5, long: 5 },
		{ type: 'a', id: 3, lat: 4.7, long: 7 }
	]);

});

test('listener is called when object is updated', async () => {
	const listener1 = {
		onCreate: jest.fn(),
		onUpdate: jest.fn()
	};

	const listener2 = {
		onCreate: jest.fn(),
		onUpdate: jest.fn()
	};

	const listener3 = {
		onCreate: jest.fn(),
		onUpdate: jest.fn()
	};

	// Listeners 1 and 3 are within the bounds (3 quite strictly)
	db.listen(listener1, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
	db.listen(listener2, 'a', { minLat: 9, maxLat: 10, minLong: 0, maxLong: 10 });
	db.listen(listener3, 'a', { minLat: 5, maxLat: 5, minLong: 5, maxLong: 5 });

	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });

	expect(listener1.onCreate.mock.calls.length).toBe(1);
	expect(listener2.onCreate.mock.calls.length).toBe(0);
	expect(listener3.onCreate.mock.calls.length).toBe(1);

	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello 2' });

	expect(listener1.onCreate.mock.calls.length).toBe(1);
	expect(listener1.onUpdate.mock.calls.length).toBe(1);

	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });

	expect(listener1.onUpdate.mock.calls.length).toBe(2);
});

test('object lifecycle including deletion', async () => {
	const listener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn(),
		onDelete: jest.fn()
	};

	db.listen(listener, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

	// Object is created, updated twice, then deleted
	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Moi' });
	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Another' });
	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Third' });

	expect(mapSize(await db.getObjects('a'))).toBe(1);
	await db.deleteObject({ type: 'a', id: 123 });

	expect(mapSize(await db.getObjects('a'))).toBe(0);
	// This ensures it gets created again
	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Third' });

	expect(listener.onCreate.mock.calls.length).toBe(2);
	expect(listener.onUpdate.mock.calls.length).toBe(2);
	expect(listener.onDelete.mock.calls.length).toBe(1);
});

test('changing listener bounds', async () => {
	const listener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn()
	};

	db.listen(listener, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });
	await db.updateObject({ type: 'a', id: 123, lat: 6, long: 5, name: 'Hello 1' });

	expect(listener.onCreate.mock.calls.length).toBe(1);
	expect(listener.onUpdate.mock.calls.length).toBe(1);

	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello 2' });

	expect(listener.onUpdate.mock.calls.length).toBe(2);

	// Change listener bounds so update doesn't get called any more
	db.listen(listener, 'a', { minLat: 0, maxLat: 10, minLong: 7, maxLong: 17 });

	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello 3' });
	expect(listener.onUpdate.mock.calls.length).toBe(2);
});

test('changing only broadcasts changed properties and type and id', async () => {
	const listener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn()
	};

	db.listen(listener, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });
	expect(listener.onCreate.mock.calls.length).toBe(1);
	expect(listener.onCreate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });

	// Not changing anything:
	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });
	expect(listener.onCreate.mock.calls.length).toBe(1);
	expect(listener.onCreate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });

	// Adding new property
	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello', orders: 123 });
	expect(listener.onUpdate.mock.calls.length).toBe(1);
	expect(listener.onUpdate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, orders: 123 });

	// Changing existing property
	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello yo', orders: 124 });
	expect(listener.onUpdate.mock.calls.length).toBe(2);
	expect(listener.onUpdate.mock.calls[1][0]).toEqual({ type: 'a', id: 123, name: 'Hello yo', orders: 124 });
});

test('changing object location', async () => {
	const region1Listener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn()
	};

	const region2Listener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn()
	};

	db.listen(region1Listener, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
	db.listen(region2Listener, 'a', { minLat: 10, maxLat: 20, minLong: 10, maxLong: 20 });

	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'X' });

	expect(region1Listener.onCreate.mock.calls.length).toBe(1);

	// Move object within one region.
	await db.updateObject({ type: 'a', id: 123, lat: 6, long: 5, name: 'New name', age: 20 });

	expect(region1Listener.onUpdate.mock.calls.length).toBe(1);
	expect(region1Listener.onUpdate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, lat: 6, name: 'New name', age: 20 });

	// Move object from region to another, change its name at the same time
	await db.updateObject({ type: 'a', id: 123, lat: 15, long: 15, name: 'Name 2' });

	expect(region1Listener.onUpdate.mock.calls.length).toBe(2);
	expect(region1Listener.onUpdate.mock.calls[1][0]).toEqual({ type: 'a', id: 123, lat: 15, long: 15, name: 'Name 2' });

	// New listener must be called with all object properties, including those that it had before
	expect(region2Listener.onUpdate.mock.calls.length).toBe(1);
	expect(region2Listener.onUpdate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, lat: 15, long: 15, name: 'Name 2', age: 20 });
});

test('different kinds of objects do not affect each other', async () => {
	const typeAListener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn(),
		onDelete: jest.fn()
	};

	const typeBListener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn(),
		onDelete: jest.fn()
	};

	db.listen(typeAListener, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
	db.listen(typeBListener, 'b', { minLat: 5, maxLat: 15, minLong: 5, maxLong: 15 });

	// Objects with the same ids should live in separate realms
	await db.updateObject({ type: 'a', id: 123, lat: 7, long: 7, name: 'Name A' });
	await db.updateObject({ type: 'b', id: 123, lat: 7, long: 7, name: 'Name B' });
	await db.updateObject({ type: 'c', id: 123, lat: 7, long: 7, name: 'Name C' });

	expect(typeAListener.onCreate.mock.calls.length).toBe(1);
	expect(typeAListener.onCreate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, lat: 7, long: 7, name: 'Name A' });

	expect(typeBListener.onCreate.mock.calls.length).toBe(1);
	expect(typeBListener.onCreate.mock.calls[0][0]).toEqual({ type: 'b', id: 123, lat: 7, long: 7, name: 'Name B' });

	await db.updateObject({ type: 'a', id: 123, lat: 7, long: 8, name: 'Name A', changed: 1 });
	await db.updateObject({ type: 'b', id: 123, lat: 7, long: 9, name: 'Name B', changed: 2 });
	await db.updateObject({ type: 'c', id: 123, lat: 7, long: 6, name: 'Name C', changed: 3 });

	expect(typeAListener.onUpdate.mock.calls.length).toBe(1);
	expect(typeAListener.onUpdate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, long: 8, changed: 1 });
	expect(typeBListener.onUpdate.mock.calls.length).toBe(1);
	expect(typeBListener.onUpdate.mock.calls[0][0]).toEqual({ type: 'b', id: 123, long: 9, changed: 2 });

	await db.deleteObject({ type: 'a', id: 123 });
	expect(typeAListener.onDelete.mock.calls.length).toBe(1);
	expect(typeBListener.onDelete.mock.calls.length).toBe(0);
});
