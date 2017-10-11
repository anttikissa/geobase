const rjson = require('relaxed-json');

function splitOnFirstSpace(string) {
	const firstSpace = string.indexOf(' ');
	if (firstSpace === -1) {
		return [string, null];
	}
	return [string.substr(0, firstSpace), string.substr(firstSpace + 1)]
}

const protocol = {
	parse: (message) => {
		let [cmd, json] = splitOnFirstSpace(message.trim());

		cmd = cmd.toUpperCase();

		return {
			cmd: cmd.trim(),
			data: json && rjson.parse(json.trim())
		};
	},

	stringify: (cmd, data) => {
		cmd = cmd.trim().toUpperCase();
		if (data != null) {
			return `${cmd} ${JSON.stringify(data)}`;
		} else {
			return cmd;
		}
	}
};

module.exports = protocol;
