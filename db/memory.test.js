const MemoryDb = require('./memory');

let db;

beforeEach(() => {
	db = new MemoryDb();
});

const mapSize = (map) => [...map.keys()].length;

test('add listener', async () => {
	const connection = {};

	expect(mapSize(db.getListeners('a'))).toBe(0);
	db.addListener(connection, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
	expect(mapSize(db.getListeners('a'))).toBe(1);
	db.addListener(connection, 'a', { minLat: 5, maxLat: 15, minLong: 0, maxLong: 10 });
	expect(mapSize(db.getListeners('a'))).toBe(1);
	db.removeListener(connection, 'a');
	expect(mapSize(db.getListeners('a'))).toBe(0);
});

test('add listener params', async () => {
	const listener = {};

	expect(() => {
		db.addListener(listener, 123, {});
	}).toThrow('type is not of type string: 123');

	expect(() => {
		db.addListener(listener, 'a', { minLat: '5.55' });
	}).toThrow('minLat is not of type number: 5.55');


	expect(() => {
		db.addListener(listener, 'a', { minLat: 5.55 });
	}).toThrow('maxLat is not of type number: undefined');
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
	db.addListener(listener1, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
	db.addListener(listener2, 'a', { minLat: 9, maxLat: 10, minLong: 0, maxLong: 10 });
	db.addListener(listener3, 'a', { minLat: 5, maxLat: 5, minLong: 5, maxLong: 5 });

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

	db.addListener(listener, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

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

	db.addListener(listener, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });
	await db.updateObject({ type: 'a', id: 123, lat: 6, long: 5, name: 'Hello 1' });

	expect(listener.onCreate.mock.calls.length).toBe(1);
	expect(listener.onUpdate.mock.calls.length).toBe(1);

	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello 2' });

	expect(listener.onUpdate.mock.calls.length).toBe(2);

	// Change listener bounds so update doesn't get called any more
	db.addListener(listener, 'a', { minLat: 0, maxLat: 10, minLong: 7, maxLong: 17 });

	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello 3' });
	expect(listener.onUpdate.mock.calls.length).toBe(2);
});

test('changing only broadcasts changed properties and type and id', async () => {
	const listener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn()
	};

	db.addListener(listener, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

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

	db.addListener(region1Listener, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
	db.addListener(region2Listener, 'a', { minLat: 10, maxLat: 20, minLong: 10, maxLong: 20 });

	await db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'X' });

	expect(region1Listener.onCreate.mock.calls.length).toBe(1);

	// Move object within one region
	await db.updateObject({ type: 'a', id: 123, lat: 6, long: 5, name: 'New name' });

	expect(region1Listener.onUpdate.mock.calls.length).toBe(1);
	expect(region1Listener.onUpdate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, lat: 6, name: 'New name' });

	// Move object from region to another
	await db.updateObject({ type: 'a', id: 123, lat: 15, long: 15, name: 'New name' });

	expect(region1Listener.onUpdate.mock.calls.length).toBe(2);
	expect(region1Listener.onUpdate.mock.calls[1][0]).toEqual({ type: 'a', id: 123, lat: 15, long: 15 });

	// New listener must be called with all object properties
	expect(region2Listener.onUpdate.mock.calls.length).toBe(1);
	expect(region2Listener.onUpdate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, lat: 15, long: 15, name: 'New name' });
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

	db.addListener(typeAListener, 'a', { minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
	db.addListener(typeBListener, 'b', { minLat: 5, maxLat: 15, minLong: 5, maxLong: 15 });

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
