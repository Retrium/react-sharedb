
import test from 'tape';

import React, { useState, useEffect, useCallback } from 'react';
import TestRenderer from 'react-test-renderer';

const SubscriptionThing = () => {

}

const Child = () => {
	return <div />;
};

const App = ({ children }) => {
	const [count, setCount] = useState(0);
	const submit = useCallback(() => {
		setCount(count => count + 1);
	}, []);

	return children(count, submit);
};

test.skip("foo", assert => {
	const renderer = TestRenderer.create(
		<App>{(count, submit) => <Child submit={submit} count={count} />}</App>
	);

	const [child] = renderer.root.findAllByType(Child);

	assert.ok(child.props.count === 0, "count is 0");

	child.props.submit();

	assert.ok(child.props.count === 1, "count is 1");

	assert.end();
});
