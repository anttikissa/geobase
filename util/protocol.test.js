const protocol = require('./protocol');

test('parse message', () => {
	expect(protocol.parse('PING')).toEqual({ cmd: 'PING', data: null });
	expect(protocol.parse('UPDATEME { minLat: 5, maxLat: 5 }')).toEqual({
		cmd: 'UPDATEME', data: { minLat: 5, maxLat: 5 }});
	expect(protocol.parse('  uPdAtEmE  {  type: "x", minLat: 5, maxLat: 5 } ')).toEqual({
		cmd: 'UPDATEME', data: { type: 'x', minLat: 5, maxLat: 5 }});
});

test('stringify command', () => {
	expect(protocol.stringify('pong')).toEqual('PONG');
	expect(protocol.stringify('data', { x: 1, y: 'foo' })).toEqual('DATA {"x":1,"y":"foo"}');
	expect(protocol.stringify('date', new Date('2017-10-11T04:03:54.666Z')))
	.toEqual('DATE "2017-10-11T04:03:54.666Z"');
});