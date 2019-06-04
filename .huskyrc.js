module.export = {
	hooks: {
		'pre-commit': 'npm run lint lint && pretty-quick --staged',
	},
};
