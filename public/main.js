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
	send('PING');
};

ws.onmessage = (ev) => {
	log('<', ev.data);
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

// Input
const cmd = $('.cmd');
cmd.addEventListener('keypress', (ev) => {
	if (ev.keyCode === 13) {
		send(cmd.value);
		cmd.value = '';
	}
});

cmd.focus();