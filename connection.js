const log = require('./util/log');
const MemoryDb = require('./db/memory');
const protocol = require('./util/protocol');

const db = new MemoryDb();

let connections = 0;
let connectionIdx = 0;

class Connection {
	get active() {
		return this._active;
	}

	set active(value) {
		this._active = value;
		if (!value) {
			db.stopListening(this);
		}
	}

	constructor(ws) {
		this.ws = ws;

		connections++;

		this.idx = connectionIdx++;
		this.active = true;
		this.prefix = `[${this.idx}]`;

		this.log(`New connection (${connections} clients connected)`);

		this.ws.on('message', (message) => this.onMessage(message));
		this.ws.on('close', (status) => this.onClose(status));

		this.hello();

		this.pingIdx = 0;
		this.ping();
	}

	log(...args) {
		log(this.prefix, ...args);
	}

	async onMessage(message) {
		let parsed;

		try {
			parsed = protocol.parse(message);
		} catch (err) {
			this.send('ERROR', { message: 'Could not parse message', whatYouSaid: message });
			return;
		}

		const { cmd, data } = parsed;

		if (data != null) {
			this.log('<', cmd, data);
		} else {
			this.log('<', cmd);
		}

		await this.handleCommand(cmd, data);
	}

	async handleCommand(cmd, data) {
		try {
			if (cmd === 'PING') {
				this.send('PONG', data);
			} else if (cmd === 'PONG') {
				// Ignore it
			} else if (cmd === 'LISTEN') {
				if (!data) {
					let listeners = db.getAllListeningTypes().map(type => db.getListeningProfile(this, type));
					this.send('OK', listeners.filter(Boolean));
					return;
				}
				if (data && !data.type) {
					throw new Error('type required');
				}

				const { type, ...bounds } = data;

				this.send('OK', "I'll keep you posted, dear.");
				await db.listen(this, type, bounds);

			} else if (cmd === 'GET') {
				const { type, id, ...bounds } = data;
				let result;
				if (id) {
					result = await db.getOne(type, id);
				} else {
					result = await db.getAll(type, bounds);
				}
				this.send(result ? 'DATA' : 'NOTFOUND', result);
			} else if (cmd === 'UPDATE') {
				let result = await db.updateObject(data);
				this.send(result.created ? 'CREATED' : 'UPDATED', result);
			} else if (cmd === 'DELETE') {
				let result = await db.deleteObject(data);
				this.send(result.deleted ? 'DELETED' : 'NOTFOUND', result);
			} else if (cmd === 'TEST') {
				for (var i = 0; i < 10; i++) {
					for (var j = 0; j < 10; j++) {
						await db.updateObject({
							type: 'a',
							id: i * 10 + j,
							lat: i,
							long: j,
							name: `${i} ${j} ${Math.random()}`
						});
					}
				}
			} else {
				this.send('ERROR', { message: 'Unknown command ' + cmd });
			}
		} catch (err) {
			log('err', err);
			this.send('ERROR', { message: 'Could not do that', reason: err.message });
		}
	}

	onCreate(obj) {
		this.send('CREATE', obj);
	}

	onUpdate(obj) {
		this.send('UPDATE', obj);
	}

	onDelete(obj) {
		this.send('DELETE', obj);
	}

	onClose(status) {
		// Status tends to be 1006
		connections--;
		this.active = false;
		this.log('closed');
	}

	send(cmd, data) {
		if (!this.active) {
			this.log('Cannot send to closed socket');
			return;
		}

		if (data != null) {
			this.log('>', cmd, data);
		} else {
			this.log('>', cmd);
		}

		try {
			this.ws.send(protocol.stringify(cmd, data));
		} catch (err) {
			this.log('Sending message failed');
			connections--;
			this.active = false;
		}
	}

	ping() {
		if (!this.active) {
			return;
		}

		this.send('PING', this.pingIdx++);
		setTimeout(() => {
			this.ping();
		}, 10000);
	}

	hello() {
		this.send('HELLO', { message: "How may I serve you?" });
	}
}

async function acceptConnection(ctx) {
	if (ctx.path !== '/events') {
		log('Unknown socket connection. No idea what to do with this');

		// TODO figure out how to reject connections that don't come to /events/
		return;
	}

	new Connection(ctx.websocket);
}

module.exports = acceptConnection;
