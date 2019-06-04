module.export = {
	hooks: {
		'pre-commit': 'npm run lint && pretty-quick --staged',
	},
};
