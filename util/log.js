module.exports = function log(...args) {
	const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
	const line = [now, ...args];
	console.log(...line);
};
