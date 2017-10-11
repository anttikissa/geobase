const Koa = require('koa');
const websockify = require('koa-websocket');
const app = websockify(new Koa());
const mount = require('koa-mount');

const log = require('./util/log');

const PORT = process.env.GEOBASE_PORT || 3000;

app.use(mount('/hello', async ctx => {
	ctx.body = 'Hello';
}));

app.ws.use(async (ctx, next) => {
	try {
		await next();
	} catch (err) {
		log('err', err);
	}
});

app.ws.use(require('./socket'));

app.use(require('koa-static')(__dirname + '/public'));

app.listen(PORT, () => {
	log(`Listening at http://localhost:${PORT}/`);
});

// Restart server automatically
const autoexit = require('./autoexit');
autoexit();
