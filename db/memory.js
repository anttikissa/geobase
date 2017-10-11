let checkType = require('../util/checkType');

// In-memory implementation of database

class MemoryDb {
	getObjects(type) {
		if (this.objects[type]) {
			return this.objects[type];
		}
		return this.objects[type] = new Map;
	}

	getListeners(type) {
		if (this.listeners[type]) {
			return this.listeners[type];
		}
		return this.listeners[type] = new Map;
	}

	constructor() {
		// Objects and listeners are indexed by type
		this.objects = {};
		this.listeners = {};
	}

	// Set up listener 'listener' to receive updates based on type and region.
	// If it already exists, just update its listening profile.
	addListener(listener, type, { minLat, maxLat, minLong, maxLong }) {
		checkType(type, 'string', 'type');
		checkType(minLat, 'number', 'minLat');
		checkType(maxLat, 'number', 'maxLat');
		checkType(minLong, 'number', 'minLong');
		checkType(maxLong, 'number', 'maxLong');

		this.getListeners(type).set(listener, { type, minLat, maxLat, minLong, maxLong });
	}

	removeListener(listener, type) {
		this.getListeners(type).delete(listener);
	}

	static checkBounds(location, props) {
		return props.minLat <= location.lat && location.lat <= props.maxLat &&
			props.minLong <= location.long && location.long <= props.maxLong;
	}

	// Report changed and new properties
	static objectDiff(before, after) {
		let result = {};
		for (const key of Object.keys(after)) {
			if (typeof before[key] === 'undefined' || before[key] !== after[key]) {
				result[key] = after[key];
			}
		}
		return result;
	}

	updateObject(object) {
		checkType(object.type, 'string', 'type');
		checkType(object.id, 'number', 'id');

		let changes = object;
		const existingObject = this.getObjects(object.type).get(object.id);
		let objectWasMoved = false;
		let originalLocation; // Only if we had an object before. Needed if it was moved.
		if (existingObject) {
			changes = MemoryDb.objectDiff(existingObject, object);
			objectWasMoved = typeof changes.lat === 'number' || typeof changes.long === 'number';
			originalLocation = { type: object.type, lat: existingObject.lat, long: existingObject.long };

			Object.assign(existingObject, object);
		} else {
			// New object: must have lat, long to be indexed
			checkType(object.lat, 'number', 'lat');
			checkType(object.long, 'number', 'long');

			this.getObjects(object.type).set(object.id, object);
		}

		const objectWasCreated = !existingObject;

		// Object not updated - no need to broadcast
		if (Object.keys(changes).length === 0) {
			return;
		}

		const changesWithTypeAndId = Object.assign({ type: object.type, id: object.id }, changes);

		for (const [listener, props] of this.getListeners(object.type)) {

			// If object was moved, we need to check the old and new location for listener bounds.
			// And in that case, we don't need to take into account the possibility that object
			// was created.
			if (objectWasMoved) {

				let listenerWithinBoundsNow = MemoryDb.checkBounds(object, props);
				let listenerWithinBoundsBefore = MemoryDb.checkBounds(originalLocation, props);
				if (listenerWithinBoundsNow || listenerWithinBoundsBefore) {
					// When the listener hears about the object first time, i.e. listenerWithinBoundsBefore
					// is not true, we must send them the whole object instead of just the changes.
					listener.onUpdate && listener.onUpdate(listenerWithinBoundsBefore ? changesWithTypeAndId : object);
				}
			} else {
				if (MemoryDb.checkBounds(object, props)) {
					if (objectWasCreated) {
						listener.onCreate && listener.onCreate(object);
					} else {
						listener.onUpdate && listener.onUpdate(changesWithTypeAndId);
					}
				}
			}
		}

		return { created: objectWasCreated, moved: objectWasMoved, object: object, changes: changes };
	}

	deleteObject({ type, id }) {
		checkType(type, 'string', 'type');
		checkType(id, 'number', 'id');

		let objects = this.getObjects(type);
		const object = objects.get(id);

		if (!object) {
			// Don't complain of deleting nonexisting object, but don't broadcast
			// it either (since we don't know its bounds)
			return;
		}

		for (const [listener, props] of this.getListeners(type)) {
			if (MemoryDb.checkBounds(object, props)) {
				listener.onDelete && listener.onDelete(object);
			}
		}

		objects.delete(id);
	}
}

module.exports = MemoryDb;
