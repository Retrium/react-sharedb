module.export = {
	hooks: {
		'pre-commit': 'npm lint && pretty-quick --staged',
	},
};
