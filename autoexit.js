const sane = require('sane');

const autoexit = () => {
	const watcher = sane(__dirname, {
		glob: ['**/*.js'],
		ignored: [ 'coverage/**' ]
	});
	watcher.on('change', (path) => {
		console.log('change', path);
		process.exit(2);
	});
};

module.exports = autoexit;
