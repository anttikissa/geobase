window.$ = (...args) => document.querySelector(...args);

// $('.log').addEventListener('scroll', (ev) => {
// 	const el = $('.log');
//
// 	$('.info1').textContent = 'scrollTop ' + el.scrollTop;
// 	$('.info2').textContent = 'scrollHeight ' + el.scrollHeight;
// 	$('.info3').textContent = 'diff ' + (el.scrollHeight - el.scrollTop);
// 	console.log(el.clientHeight, 'client');
// });

import { log } from './log.js';

const ws = new WebSocket(`ws://${location.host}/events`);

window.ws = ws;

function send(message) {
	ws.send(message);
	log('>', message);
}

ws.onopen = (ev) => {
	log('WebSocket open');
	// send('PING');
};

ws.onmessage = (ev) => {
	log('<', ev.data);
	if (ev.data.startsWith('PING')) {
		send('PONG ' + ev.data.slice(5));
	}
};

ws.onclose = (status) => {
	log('WebSocket close');
	// TODO make a better reconnect mechanism
	setTimeout(() => {
		window.location.reload()
	}, 2000);
};

ws.onerror = (err) => {
	log('WebSocket error', err);
};

const history = [];
let currentHistoryPos = 0;

// Input
const cmd = $('.cmd');
cmd.addEventListener('keyup', (ev) => {
	if (ev.keyCode === 13) {
		send(cmd.value);
		history.push(cmd.value);
		currentHistoryPos = history.length;

		cmd.value = '';
	}

	console.log(ev.keyCode);

	if (ev.keyCode === 38) {
		currentHistoryPos--;
		if (history[currentHistoryPos]) {
			cmd.value = history[currentHistoryPos];
		}
		if (currentHistoryPos < 0) {
			currentHistoryPos = 0;
		}
	}

	if (ev.keyCode === 40) {
		currentHistoryPos++;
		if (history[currentHistoryPos]) {
			cmd.value = history[currentHistoryPos];
		} else {
			cmd.value = '';
			currentHistoryPos = history.length;
		}
	}
});

cmd.focus();