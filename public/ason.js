//
// ASON - A Simpler Object Notation
//
// Like JSON, but produces more readable output. Rhymes with "mason".
//
// const o = { a: 1, b: [2, 3] };
// JSON.stringify(o) => '{"a":1,"b":[2,3]}'
// ason.stringify(o) => '{ a: 1, b: [2, 3] }'
//
// Also supports some things that JSON.stringify doesn't:
//
// ason.stringify(undefined) => 'undefined'
// ason.stringify(new Date()) => 'new Date("2017-08-29 11:27:45.647Z") ("T" is removed for readability)
// ason.stringify(-0) => '-0'
// ason.stringify(Infinity) => 'Infinity'
// ason.stringify(function(x) { return x; }) => 'function (x) {return x;}'
//
// Symbols are not supported. Yet.
// There is no ason.parse(). Yet.
//

// https://stackoverflow.com/questions/14962018/detecting-and-fixing-circular-references-in-javascript
// fixed to take into account objects without .hasOwnProperty()
function isCyclic(obj) {
	var seenObjects = [];

	function detect(obj) {
		if (obj && typeof obj === 'object') {
			if (seenObjects.indexOf(obj) !== -1) {
				return true;
			}
			seenObjects.push(obj);
			for (var key in obj) {
				if (Object.prototype.hasOwnProperty.call(obj, key) && detect(obj[key])) {
					// console.log(obj, 'cycle at ' + key);
					return true;
				}
			}
		}
		return false;
	}

	return detect(obj);
}

function looksLikeAnIdentifier(string) {
	return (/^[a-zA-Z_][0-9a-zA-Z_]*$/).test(string);
}

function stringifyObject(object) {
	if (object === null) {
		return 'null';
	}

	if (object instanceof Date) {
		return 'new Date(' + JSON.stringify(object.toISOString().replace('T', ' ')) + ')';
	}

	return '{ ' + Object.keys(object).map(key => {
		const stringifiedKey = looksLikeAnIdentifier(key) ? key : JSON.stringify(key);
		const stringifiedValue = stringify(object[key]);
		return `${stringifiedKey}: ${stringifiedValue}`;
	}).join(', ') + ' }';
}

function stringifyArray(array) {
	return '[' + array.map(stringify).join(', ') + ']';
}

function stringifyNumber(number) {
	if (Object.is(number, -0)) {
		return '-0';
	}
	return String(number);
}

export function stringify(any) {
	const type = typeof any;

	// If there are cycles, just produce something.
	if (isCyclic(any)) {
		return require('util').inspect(any);
	}

	if (Array.isArray(any)) {
		return stringifyArray(any);
	} if (type === 'object') {
		return stringifyObject(any);
	} else if (type === 'number') {
		return stringifyNumber(any);
	} else if (type === 'string' || type === 'boolean') {
		return JSON.stringify(any);
	} else if (type === 'undefined') {
		return 'undefined';
	} else if (type === 'function') {
		// Return [Function, "functionName"]
		// which is a bit perverse but valid JavaScript so can be parsed
		return any.name ? `function ${(any.name)}() { /* ... */ }` : 'function() { /* ... */ }';
	}
}
