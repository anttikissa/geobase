const Koa = require('koa');
const websockify = require('koa-websocket');
const app = websockify(new Koa());
const mount = require('koa-mount');

const log = require('./util/log');

const PORT = process.env.GEOBASE_PORT || 3000;

app.use(mount('/kill', async ctx => {
	log('Server terminating...');
	ctx.body = '';
	setTimeout(() => {
		process.exit(0);
	}, 100);
}));

app.ws.use(async (ctx, next) => {
	try {
		await next();
	} catch (err) {
		log('err', err);
	}
});

app.ws.use(require('./connection'));

app.use(require('koa-static')(__dirname + '/public'));

app.listen(PORT, () => {
	log(`Listening at http://localhost:${PORT}/`);
});

// Restart server automatically
const autoexit = require('./autoexit');
autoexit();
