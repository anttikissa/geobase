const Koa = require('koa');
const websockify = require('koa-websocket');
const app = websockify(new Koa());
const mount = require('koa-mount');

const log = require('./util/log');

const PORT = process.env.GEOBASE_PORT || 3000;

app.use(mount('/hello', async ctx => {
	ctx.body = 'Hello';
}));

let connections = 0;
let connectionIdx = 0;

app.ws.use(async (ctx) => {
	if (ctx.path !== '/events') {
		// TODO figure out how to reject connections that don't come to /events/
		return;
	}

	connections++;
	connectionIdx++;

	let connectionActive = true;

	let prefix = `[${connectionIdx}]`;

	log(`Got connection, how have ${connections}`);

	let pingIdx = 0;
	function ping() {
		pingIdx++;

		if (!connectionActive) {
			return;
		}

		try {
			ctx.websocket.send('PING ' + pingIdx);
		} catch (err) {
			log(prefix, 'Sending message failed');
			connections--;
			connectionActive = false;
		}

		setTimeout(ping, 1000);
	}

	ctx.websocket.send('HELLO');

	ping();

	ctx.websocket.on('message', (message) => {
		log(prefix, message);

		if (message.startsWith('PING')) {
			ctx.websocket.send('PONG');
		}
	});

	ctx.websocket.on('close', (message) => {
		connections--;
		connectionActive = false;
		log(prefix, 'close');
	});
});

app.use(require('koa-static')(__dirname + '/public'));

app.listen(PORT, () => {
	log(`Listening at http://localhost:${PORT}/`);
});

// Restart server automatically
const autoexit = require('./autoexit');
autoexit();
