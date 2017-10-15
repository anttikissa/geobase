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

	// Return array of objects filtered by bounds (optionally)
	async getAll(type, bounds) {
		const objects = this.getObjects(type);
		const values = [...objects.values()];

		if (!bounds) {
			return values;
		} else {
			const filtered = values.filter(value => {
				if (bounds.hasOwnProperty('minLat') != null && value.lat < bounds.minLat)
					return false;
				if (bounds.hasOwnProperty('maxLat') != null && value.lat > bounds.maxLat)
					return false;
				if (bounds.hasOwnProperty('minLong') != null && value.long < bounds.minLong)
					return false;
				if (bounds.hasOwnProperty('maxLong') != null && value.long > bounds.maxLong)
					return false;
				return true;
			});
			return filtered;
		}
	}

	getListeners(type) {
		if (this.listeners[type]) {
			return this.listeners[type];
		}
		return this.listeners[type] = new Map;
	}

	getAllListeningTypes() {
		return [...Object.keys(this.listeners)];
	}

	constructor() {
		// Objects and listeners are indexed by type
		this.objects = {};
		this.listeners = {};
	}

	// Set up listener 'listener' to receive updates based on type and region.
	// If it already exists, just update its listening profile.
	// When updating an existing listener, you only need to specify the
	// parameters that changed. (And type.)
	addListener(listener, type, { minLat, maxLat, minLong, maxLong }) {
		function cleanObject(obj) {
			for (let key in obj) {
				if (obj[key] === undefined) {
					delete obj[key];
				}
			}
		}

		const listenersMap = this.getListeners(type);
		let existingProps = listenersMap.get(listener);
		let props = { type, minLat, maxLat, minLong, maxLong };
		cleanObject(props);

		function check(props) {
			checkType(props.type, 'string', 'type');
			checkType(props.minLat, 'number', 'minLat');
			checkType(props.maxLat, 'number', 'maxLat');
			checkType(props.minLong, 'number', 'minLong');
			checkType(props.maxLong, 'number', 'maxLong');
		}

		if (existingProps) {
			let updatedProps = Object.assign({}, existingProps, props);
			check(updatedProps);
			listenersMap.set(listener, updatedProps);
		} else {
			check(props);
			listenersMap.set(listener, props);
		}
	}

	getListener(listener, type) {
		return this.getListeners(type).get(listener);
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

	async updateObject(object) {
		checkType(object.type, 'string', 'type');
		checkType(object.id, 'number', 'id');

		let changes = object;
		const existingObject = (await this.getObjects(object.type)).get(object.id);
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

			(await this.getObjects(object.type)).set(object.id, object);
		}

		const objectWasCreated = !existingObject;

		// Object not updated - no need to broadcast
		if (Object.keys(changes).length === 0) {
			return { created: objectWasCreated, moved: objectWasMoved, object: object, changes: changes };
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

	async deleteObject({ type, id }) {
		checkType(type, 'string', 'type');
		checkType(id, 'number', 'id');

		let objects = await this.getObjects(type);
		const object = objects.get(id);

		if (object) {
			for (const [listener, props] of this.getListeners(type)) {
				if (MemoryDb.checkBounds(object, props)) {
					listener.onDelete && listener.onDelete(object);
				}
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
