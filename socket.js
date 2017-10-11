const log = require('./util/log');

let connections = 0;
let connectionIdx = 0;

class Connection {
	constructor(ws) {
		this.ws = ws;

		connections++;

		this.idx = connectionIdx++;
		this.active = true;
		this.prefix = `[${this.idx}]`;

		log(this.prefix, `connected (${connections} clients connected)`);

		this.ws.on('message', (message) => this.onMessage(message));
		this.ws.on('close', (status) => this.onClose(status));

		this.hello();

		this.pingIdx = 0;
		this.ping();
	}

	onMessage(message) {
		log(this.prefix, message);

		if (message.startsWith('PING')) {
			this.send('PONG');
		}
	}

	onClose(status) {
		// Status tends to be 1006
		connections--;
		this.active = false;
		log(this.prefix, 'closed');
	}

	send(message) {
		if (!this.active) {
			log(this.prefix, 'Cannot send to closed socket');
			return;
		}

		try {
			this.ws.send(message);
		} catch (err) {
			log(this.prefix, 'Sending message failed');
			connections--;
			this.active = false;
		}
	}

	ping() {
		if (!this.active) {
			return;
		}

		this.send('PING ' + this.pingIdx++);
		setTimeout(() => {
			this.ping();
		}, 1000);
	}

	hello() {
		this.send('HELLO');
	}
}

module.exports = async (ctx) => {
	if (ctx.path !== '/events') {
		log('Unknown socket connection. No idea what to do with this');

		// TODO figure out how to reject connections that don't come to /events/
		return;
	}

	new Connection(ctx.websocket);
};