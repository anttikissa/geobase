module.exports = function(object, type, name) {
	if (typeof object !== type) {
		if (name) {
			throw new Error(`${name} is not of type ${type}: ${object}`);
		} else {
			throw new Error(`Object is not of type ${type}: ${object}`);
		}
	}
};
