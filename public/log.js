import { stringify } from './ason.js';

function format(object) {
	if (typeof object === 'string') {
		return object;
	}

	return stringify(object);
}

function appendToLogEl(line) {
	const el = document.querySelector('.log');

	const BUFFER_MAX_LINES = 1000;

	const MARGIN = 10;
	const totallyScrolled = (el.scrollHeight - el.scrollTop) < el.clientHeight + MARGIN;

 	let oldContent = el.textContent.split('\n');
	if (oldContent.length > BUFFER_MAX_LINES) {
		oldContent = oldContent.slice(-BUFFER_MAX_LINES);
	}

	el.textContent = oldContent.join('\n') + line.map(format).join(' ') + '\n';

	if (totallyScrolled) {
		el.scrollTop = el.scrollHeight;
	}
}

export const log = (...args) => {
	const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
	const line = [now, ...args];
	appendToLogEl(line);
	console.log(...line);
};

