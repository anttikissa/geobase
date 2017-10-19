let checkType = require('../util/checkType');

let log = require('../util/log');

// In-memory implementation of database

class MemoryDb {
	// (Internal) return map of all objects
	getObjects(type) {
		if (!this.objects[type]) {
			this.objects[type] = new Map;
		}
		return this.objects[type];
	}

	// Get object
	async getOne(type, id) {
		return this.getObjects(type).get(id);
	}

	// Return array of objects filtered by bounds.
	// If bounds is defined, return only objects within bounds.
	// If excludeBounds is defined, return only object not within excludeBounds.
	async getAll(type, bounds = {}, excludeBounds = undefined) {
		bounds = Object.assign({
			minLat: -Infinity,
			maxLat: Infinity,
			minLong: -Infinity,
			maxLong: Infinity
		}, bounds);
		if (excludeBounds) {
			excludeBounds = Object.assign({
				minLat: -Infinity,
				maxLat: Infinity,
				minLong: -Infinity,
				maxLong: Infinity
			}, excludeBounds);
		}
		const objects = this.getObjects(type);
		const values = [...objects.values()];

		function withinBounds(value, bounds) {
			if (value.lat < bounds.minLat)
				return false;
			if (value.lat > bounds.maxLat)
				return false;
			if (value.long < bounds.minLong)
				return false;
			if (value.long > bounds.maxLong)
				return false;
			return true;
		}
		const filtered = values.filter(value => {
			if (excludeBounds) {
				return withinBounds(value, bounds) && !withinBounds(value, excludeBounds);
			} else {
				return withinBounds(value, bounds);
			}
		});
		return filtered;
	}

	getListeners(type) {
		if (this.listeners[type]) {
			return this.listeners[type];
		}
		return this.listeners[type] = new Map;
	}

	// Return an array of all listener types (so that you can find out all listening properties
	// of a listener without having to know their types)
	getAllListeningTypes() {
		return [...Object.keys(this.listeners)];
	}

	constructor() {
		// Objects and listeners are indexed by type
		this.objects = {};
		this.listeners = {};
	}

	// Let 'listener' to receive updates (.onCreate(), .onUpdate(), .onDelete())
	// from every object whose type is 'type' and that matches the given geographical range.
	// All of the properties 'minLat', 'maxLat', 'minLong', and 'maxLong' are mandatory.
	//
	// If 'listener' is already listening to 'type', its listening profile is updated. In this
	// case, you only need to give the properties that you want to change. ('type', though, is
	// always mandatory.)
	//
	// A listener may have multiple listening profiles, but only one per type. I.e. if you call
	//
	//   listen(listener, 'a', { minLat: 10, maxLat: 20, minLong: 10, maxLong: 20 };
	//   listen(listener, 'a', { minLat: 20, maxLat: 30, minLong: 40, maxLong: 50 };
	//   listen(listener, 'b', { minLat: 10, maxLat: 20, minLong: 10, maxLong: 20 };
	//
	// you end up with two listening profiles for listener:
	//
	//   { type: 'a', minLat: 20, maxLat: 30, minLong: 40, maxLong: 50 }
	//   { type: 'b', minLat: 10, maxLat: 20, minLong: 10, maxLong: 20 }
	//
	// You can query listening profiles by getListeningProfile(listener, type).
	async listen(listener, type, { minLat, maxLat, minLong, maxLong }) {
		function cleanObject(obj) {
			for (let key of Object.keys(obj)) {
				if (obj[key] === undefined) {
					delete obj[key];
				}
			}
		}

		const listenersMap = this.getListeners(type);
		let originalProps = listenersMap.get(listener);
		let props = { type, minLat, maxLat, minLong, maxLong };
		cleanObject(props);

		function check(props) {
			checkType(props.type, 'string', 'type');
			checkType(props.minLat, 'number', 'minLat');
			checkType(props.maxLat, 'number', 'maxLat');
			checkType(props.minLong, 'number', 'minLong');
			checkType(props.maxLong, 'number', 'maxLong');
		}

		let objectsToUpdate;

		if (originalProps) {
			let updatedProps = Object.assign({}, originalProps, props);
			check(updatedProps);
			listenersMap.set(listener, updatedProps);
			objectsToUpdate = await this.getAll(type, updatedProps, originalProps);

		} else {
			check(props);
			listenersMap.set(listener, props);

			// Update the listener asynchronously.
			objectsToUpdate = await this.getAll(type, props);
		}

		if (listener.onUpdate) {
			for (let object of objectsToUpdate) {
				listener.onUpdate(object);
			}
		}
	}

	getListeningProfile(listener, type) {
		return this.getListeners(type).get(listener);
	}

	stopListening(listener, type) {
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

	// Inform that object identified with `changes.type` and `changes.id` has been
	// updated.
	//
	// Calling updateObject() causes all listeners whose listening bounds include the
	// object's location (either old, or the new location, in case it changed) to be
	// called. If the object didn't exist before, .onCreate() is called; if it did,
	// .onUpdate() is called (regardless of whether the object was within the listener's
	// bounds before the update or not).
	//
	// You can include a version number with the changes (`changes.v`). The version number
	// should be monotonically increasing within a given type. If you don't specify a version,
	// the database will provide come up with one.
	async updateObject(changes) {
		checkType(changes.type, 'string', 'type');
		checkType(changes.id, 'number', 'id');

		if (changes.v) {
			checkType(changes.v, 'number', 'v');
		} else {
			changes.v = Date.now();
		}

		const existingObject = (await this.getObjects(changes.type)).get(changes.id);
		let objectWasMoved = false;
		let originalLocation; // Only if we had an object before. Needed if it was moved.

		// actualChanges will contain the properties that really changed and that will be sent
		// to the listeners that had knowledge of this object before the update.
		//
		// If object was before { type: 'a', id: 1, lat: 5, long: 5, name: 'Hello', age: 10 } and
		// and `changes` was { type: 'a', id: 1, lat: 6, long: 5, name: 'Hello', age: 20 },
		// Then `actualChanges` will become { lat: 6, age: 20 }
		let actualChanges = changes;

		// wholeObject has all of the object's properties. Needed if object's location changes and it
		// acquires a new listener, who needs to be told about the object in whole.
		let wholeObject = changes;

		if (existingObject) {
			actualChanges = MemoryDb.objectDiff(existingObject, changes);

			objectWasMoved = typeof actualChanges.lat === 'number' || typeof actualChanges.long === 'number';

			originalLocation = { type: changes.type, lat: existingObject.lat, long: existingObject.long };

			Object.assign(existingObject, changes);
			wholeObject = existingObject;
		} else {
			// New object: must have lat, long to be indexed
			checkType(changes.lat, 'number', 'lat');
			checkType(changes.long, 'number', 'long');

			(await this.getObjects(changes.type)).set(changes.id, changes);
		}

		const objectWasCreated = !existingObject;

		// Object not updated - no need to broadcast
		if (Object.keys(actualChanges).length === 0) {
			return { created: objectWasCreated, moved: objectWasMoved, object: changes, changes: actualChanges };
		}

		const changesWithTypeAndId = Object.assign({ type: changes.type, id: changes.id }, actualChanges);

		for (const [listener, props] of this.getListeners(changes.type)) {

			// If object was moved, we need to check the old and new location for listener bounds.
			// And in that case, we don't need to take into account the possibility that object
			// was created.
			if (objectWasMoved) {
				let listenerWithinBoundsNow = MemoryDb.checkBounds(changes, props);
				let listenerWithinBoundsBefore = MemoryDb.checkBounds(originalLocation, props);
				if (listenerWithinBoundsNow || listenerWithinBoundsBefore) {
					// When the listener hears about the object first time, i.e. listenerWithinBoundsBefore
					// is not true, we must send them the whole object instead of just the changes.

					listener.onUpdate && listener.onUpdate(listenerWithinBoundsBefore
						? changesWithTypeAndId
						: wholeObject);
				}
			} else {
				if (MemoryDb.checkBounds(changes, props)) {
					if (objectWasCreated) {
						listener.onCreate && listener.onCreate(wholeObject);
					} else {
						listener.onUpdate && listener.onUpdate(changesWithTypeAndId);
					}
				}
			}
		}

		return { created: objectWasCreated, moved: objectWasMoved, object: changes, changes: actualChanges };
	}

	async deleteObject({ type, id }) {
		checkType(type, 'string', 'type');
		checkType(id, 'number', 'id');

		let objects = await this.getObjects(type);
		const object = objects.get(id);

		if (object) {
			for (const [listener, props] of this.getListeners(type)) {
				listener.onDelete && listener.onDelete(object);
			}

			objects.delete(id);
		}

		return {
			type,
			id,
			deleted: object
		};
	}
}

module.exports = MemoryDb;
