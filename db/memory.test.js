const MemoryDb = require('./memory');

let db;

beforeEach(() => {
	db = new MemoryDb();
});

test('add listener', () => {
	const connection = {};

	const length = (map) => [...map.keys()].length;

	expect(length(db.listeners)).toBe(0);
	db.addListener(connection, { type: 'a', minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
	expect(length(db.listeners)).toBe(1);
	db.addListener(connection, { type: 'a', minLat: 5, maxLat: 15, minLong: 0, maxLong: 10 });
	expect(length(db.listeners)).toBe(1);
	db.removeListener(connection);
	expect(length(db.listeners)).toBe(0);

});

test('add listener params', () => {
	const listener = {};

	expect(() => {
		db.addListener(listener, { type: 123 });
	}).toThrow('type is not of type string: 123');

	expect(() => {
		db.addListener(listener, { type: 'a', minLat: '5.55' });
	}).toThrow('minLat is not of type number: 5.55');


	expect(() => {
		db.addListener(listener, { type: 'a', minLat: 5.55 });
	}).toThrow('maxLat is not of type number: undefined');
});

test('listener is called when object is updated', () => {
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
	db.addListener(listener1, { type: 'a', minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
	db.addListener(listener2, { type: 'a', minLat: 9, maxLat: 10, minLong: 0, maxLong: 10 });
	db.addListener(listener3, { type: 'a', minLat: 5, maxLat: 5, minLong: 5, maxLong: 5 });

	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });

	expect(listener1.onCreate.mock.calls.length).toBe(1);
	expect(listener2.onCreate.mock.calls.length).toBe(0);
	expect(listener3.onCreate.mock.calls.length).toBe(1);

	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello 2' });

	expect(listener1.onCreate.mock.calls.length).toBe(1);
	expect(listener1.onUpdate.mock.calls.length).toBe(1);

	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });

	expect(listener1.onUpdate.mock.calls.length).toBe(2);
});

test('object lifecycle including deletion', () => {
	const listener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn(),
		onDelete: jest.fn()
	};

	db.addListener(listener, { type: 'a', minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

	// Object is created, updated twice, then deleted
	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Moi' });
	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Another' });
	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Third' });
	db.deleteObject({ type: 'a', id: 123 });

	expect(listener.onCreate.mock.calls.length).toBe(1);
	expect(listener.onUpdate.mock.calls.length).toBe(2);
	expect(listener.onDelete.mock.calls.length).toBe(1);
});

test('changing listener bounds', () => {
	const listener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn()
	};

	db.addListener(listener, { type: 'a', minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });
	db.updateObject({ type: 'a', id: 123, lat: 6, long: 5, name: 'Hello 1' });

	expect(listener.onCreate.mock.calls.length).toBe(1);
	expect(listener.onUpdate.mock.calls.length).toBe(1);

	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello 2' });

	expect(listener.onUpdate.mock.calls.length).toBe(2);

	// Change listener bounds so update doesn't get called any more
	db.addListener(listener, { type: 'a', minLat: 0, maxLat: 10, minLong: 7, maxLong: 17 });

	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello 3' });
	expect(listener.onUpdate.mock.calls.length).toBe(2);
});

test('changing only broadcasts changed properties and type and id', () => {
	const listener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn()
	};

	db.addListener(listener, { type: 'a', minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });

	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });
	expect(listener.onCreate.mock.calls.length).toBe(1);
	expect(listener.onCreate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });

	// Not changing anything:
	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });
	expect(listener.onCreate.mock.calls.length).toBe(1);
	expect(listener.onCreate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello' });

	// Adding new property
	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello', orders: 123 });
	expect(listener.onUpdate.mock.calls.length).toBe(1);
	expect(listener.onUpdate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, orders: 123 });

	// Changing existing property
	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'Hello yo', orders: 124 });
	expect(listener.onUpdate.mock.calls.length).toBe(2);
	expect(listener.onUpdate.mock.calls[1][0]).toEqual({ type: 'a', id: 123, name: 'Hello yo', orders: 124 });
});

test('changing object location', () => {
	const region1Listener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn()
	};

	const region2Listener = {
		onCreate: jest.fn(),
		onUpdate: jest.fn()
	};

	db.addListener(region1Listener, { type: 'a', minLat: 0, maxLat: 10, minLong: 0, maxLong: 10 });
	db.addListener(region2Listener, { type: 'a', minLat: 10, maxLat: 20, minLong: 10, maxLong: 20 });

	db.updateObject({ type: 'a', id: 123, lat: 5, long: 5, name: 'X' });

	expect(region1Listener.onCreate.mock.calls.length).toBe(1);

	// Move object within one region
	db.updateObject({ type: 'a', id: 123, lat: 6, long: 5, name: 'New name' });

	expect(region1Listener.onUpdate.mock.calls.length).toBe(1);
	expect(region1Listener.onUpdate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, lat: 6, name: 'New name' });

	// Move object from region to another
	db.updateObject({ type: 'a', id: 123, lat: 15, long: 15, name: 'New name' });

	expect(region1Listener.onUpdate.mock.calls.length).toBe(2);
	expect(region1Listener.onUpdate.mock.calls[1][0]).toEqual({ type: 'a', id: 123, lat: 15, long: 15 });

	// New listener must be called with all object properties
	expect(region2Listener.onUpdate.mock.calls.length).toBe(1);
	expect(region2Listener.onUpdate.mock.calls[0][0]).toEqual({ type: 'a', id: 123, lat: 15, long: 15, name: 'New name' });
});
