// @flow
import test from 'tape';
import sharedb from 'sharedb';
import React, { Suspense, useRef } from 'react';
import { useSharedState } from './useSharedState';
import TestRenderer, { act } from 'react-test-renderer';
import { SharedStateProvider } from './SharedStateProvider';

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function Loading() {
	return <div />;
}

function Mock() {
	return <div />;
}

test('react-sharedb: useSharedState projector correctly filters the state', async assert => {
	// Create a client connection to an in memory sharedb database to simulate
	//  a frontend connection to sharedb running on a server.
	const server = new sharedb.Backend();
	const local = server.connect();
	const remote = server.connect();

	const collection = 'collection';
	const doc_id = 'id:5456563';
	const doc_state = {
		doc_id: doc_id,
		count1: 0,
	};

	// create the doc via the secondary connection
	const remote_doc = remote.get(collection, doc_id);
	remote_doc.subscribe();
	remote_doc.create(doc_state);

	const MockWrapper = () => {
		const [count1, submit] = useSharedState(
			collection,
			doc_id,
			({ count1 }) => count1
		);

		return <Mock count1={count1} onSubmit={submit} />;
	};

	let renderer = {};

	act(() => {
		// initial render of the react tree
		renderer = TestRenderer.create(
			<SharedStateProvider connection={local}>
				<Suspense fallback={<Loading />}>
					<MockWrapper />
				</Suspense>
			</SharedStateProvider>
		);
	});

	const { root, unmount } = renderer;

	// allow the sharedb server to flush updates
	await act(() => sleep(0));

	{
		//const remote_doc = remote.get(collection, doc_id);
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.count1,
			0,
			"The <Mock>'s count1 prop is 0."
		);

		act(() => {
			mock_instance.props.onSubmit({
				p: ['count1'],
				oi: 1,
			});
		});
	}

	// allow the sharedb server to flush updates
	await act(() => sleep(0));

	{
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.count1,
			1,
			"The <Mock>'s count prop is 1,"
		);

		assert.equals(
			remote_doc.data.count1,
			1,
			"And the remote doc's count is also 1"
		);
	}

	remote_doc.unsubscribe();
	remote_doc.destroy();

	unmount();
	assert.end();
});

test('react-sharedb: useSharedState updating projected array tuple', async assert => {
	// Create a client connection to an in memory sharedb database to simulate
	//  a frontend connection to sharedb running on a server.
	const server = new sharedb.Backend();
	const local = server.connect();
	const remote = server.connect();

	const collection = 'collection';
	const doc_id = 'id:5456563';
	const doc_state = {
		doc_id: doc_id,
		prop1: 0,
		prop2: '',
		prop3: '',
	};

	// create the doc via the secondary connection
	const remote_doc = remote.get(collection, doc_id);
	remote_doc.subscribe();
	remote_doc.create(doc_state);

	const MockWrapper = () => {
		const [items, submit] = useSharedState(
			collection,
			doc_id,
			({ prop1, prop2 }) => [prop1, prop2]
		);

		const render_count_ref = useRef(0);

		render_count_ref.current++;

		return (
			<Mock
				items={items}
				getRenderCount={() => render_count_ref.current}
				onSubmit={submit}
			/>
		);
	};

	let renderer = {};

	act(() => {
		// initial render of the react tree
		renderer = TestRenderer.create(
			<SharedStateProvider connection={local}>
				<Suspense fallback={<Loading />}>
					<MockWrapper />
				</Suspense>
			</SharedStateProvider>
		);
	});

	const { root, unmount } = renderer;

	// allow the sharedb server to flush updates
	await act(() => sleep(0));

	{
		//const remote_doc = remote.get(collection, doc_id);
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.getRenderCount(),
			1,
			'Rendered exactly 1 time'
		);

		// submit an operation to change a prop
		act(() => {
			mock_instance.props.onSubmit({
				p: ['prop1'],
				oi: 1,
			});
		});
	}

	await act(() => sleep(0));

	{
		//const remote_doc = remote.get(collection, doc_id);
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.getRenderCount(),
			2,
			'Rendered exactly 2 times'
		);

		assert.equals(
			mock_instance.props.items[0],
			1,
			'Updated the value correctly'
		);

		act(() => {
			mock_instance.props.onSubmit({
				p: ['prop3'],
				oi: 1,
			});
		});
	}

	await act(() => sleep(0));

	{
		//const remote_doc = remote.get(collection, doc_id);
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.getRenderCount(),
			2,
			'Rendered exactly 2 times after updating non-projected value.'
		);
	}

	remote_doc.unsubscribe();
	remote_doc.destroy();

	unmount();
	assert.end();
});

test('react-sharedb: useSharedState updating directly projected array in doc state', async assert => {
	// Create a client connection to an in memory sharedb database to simulate
	//  a frontend connection to sharedb running on a server.
	const server = new sharedb.Backend();
	const local = server.connect();
	const remote = server.connect();

	const collection = 'collection';
	const doc_id = 'id:5456563';
	const doc_state = {
		doc_id: doc_id,
		list: [],
		prop1: '',
	};

	// create the doc via the secondary connection
	const remote_doc = remote.get(collection, doc_id);
	remote_doc.subscribe();
	remote_doc.create(doc_state);

	const MockWrapper = () => {
		const [list, submit] = useSharedState(
			collection,
			doc_id,
			({ list }) => list
		);

		const render_count_ref = useRef(0);

		render_count_ref.current++;

		return (
			<Mock
				list={list}
				getRenderCount={() => render_count_ref.current}
				onSubmit={submit}
			/>
		);
	};

	let renderer = {};

	act(() => {
		// initial render of the react tree
		renderer = TestRenderer.create(
			<SharedStateProvider connection={local}>
				<Suspense fallback={<Loading />}>
					<MockWrapper />
				</Suspense>
			</SharedStateProvider>
		);
	});

	const { root, unmount } = renderer;

	// allow the sharedb server to flush updates
	await act(() => sleep(0));

	{
		//const remote_doc = remote.get(collection, doc_id);
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.getRenderCount(),
			1,
			'Rendered exactly 1 time'
		);

		// submit an operation to add item to list
		act(() => {
			mock_instance.props.onSubmit({
				p: ['list', 0],
				li: 0,
			});
		});
	}

	// allow the sharedb server to flush updates
	await act(() => sleep(0));

	{
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.getRenderCount(),
			2,
			'Rendered exactly 2 times'
		);

		assert.equals(
			mock_instance.props.list[0],
			0,
			'Adding an item to the list.'
		);

		// submit an operation to add item to list
		act(() => {
			mock_instance.props.onSubmit({
				p: ['list', 1],
				li: 1,
			});
		});
	}

	// allow the sharedb server to flush updates
	await act(() => sleep(0));

	{
		const [mock_instance] = root.findAllByType(Mock);

		// assert.comment(JSON.stringify(remote_doc.data.list));
		// assert.comment(JSON.stringify(mock_instance.props));

		assert.equals(
			mock_instance.props.getRenderCount(),
			3,
			'Rendered exactly 3 times'
		);

		assert.equals(
			mock_instance.props.list[1],
			1,
			'Adding a second item to the list.'
		);

		// submit an operation to add item to list
		act(() => {
			mock_instance.props.onSubmit({
				p: ['list', 1],
				ld: 1,
			});
		});
	}

	{
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.getRenderCount(),
			4,
			'Rendered exactly 4 times'
		);

		assert.equals(
			mock_instance.props.list[1],
			undefined,
			'Removing an item from the list.'
		);

		act(() => {
			mock_instance.props.onSubmit({
				p: ['prop1'],
				oi: 1,
			});
		});
	}

	await act(() => sleep(0));

	{
		//const remote_doc = remote.get(collection, doc_id);
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.getRenderCount(),
			4,
			'Rendered exactly 4 times after updating non-projected value.'
		);
	}

	remote_doc.unsubscribe();
	remote_doc.destroy();

	unmount();
	assert.end();
});

test('react-sharedb: useSharedState updating projected plain object tuple', async assert => {
	// Create a client connection to an in memory sharedb database to simulate
	//  a frontend connection to sharedb running on a server.
	const server = new sharedb.Backend();
	const local = server.connect();
	const remote = server.connect();

	const collection = 'collection';
	const doc_id = 'id:5456563';
	const doc_state = {
		doc_id: doc_id,
		prop1: 0,
		prop2: '',
		prop3: '',
	};

	// create the doc via the secondary connection
	const remote_doc = remote.get(collection, doc_id);
	remote_doc.subscribe();
	remote_doc.create(doc_state);

	const MockWrapper = () => {
		const [{ prop1, prop2 }, submit] = useSharedState(
			collection,
			doc_id,
			({ prop1, prop2 }) => ({ prop1, prop2 })
		);

		const render_count_ref = useRef(0);

		render_count_ref.current++;

		return (
			<Mock
				prop1={prop1}
				prop2={prop2}
				getRenderCount={() => render_count_ref.current}
				onSubmit={submit}
			/>
		);
	};

	let renderer = {};

	act(() => {
		// initial render of the react tree
		renderer = TestRenderer.create(
			<SharedStateProvider connection={local}>
				<Suspense fallback={<Loading />}>
					<MockWrapper />
				</Suspense>
			</SharedStateProvider>
		);
	});

	const { root, unmount } = renderer;

	// allow the sharedb server to flush updates
	await act(() => sleep(0));

	{
		//const remote_doc = remote.get(collection, doc_id);
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.getRenderCount(),
			1,
			'Rendered exactly 1 time'
		);

		// submit an operation to change a prop
		act(() => {
			mock_instance.props.onSubmit({
				p: ['prop1'],
				oi: 1,
			});
		});
	}

	await act(() => sleep(0));

	{
		//const remote_doc = remote.get(collection, doc_id);
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.getRenderCount(),
			2,
			'Rendered exactly 2 time'
		);

		assert.equals(
			mock_instance.props.prop1,
			1,
			'The property was properly updated',
		)

		act(() => {
			mock_instance.props.onSubmit({
				p: ['prop3'],
				oi: 1,
			});
		});
	}

	await act(() => sleep(0));

	{
		//const remote_doc = remote.get(collection, doc_id);
		const [ mock_instance ] = root.findAllByType( Mock );

		assert.equals(
			mock_instance.props.getRenderCount(),
			2,
			'Rendered exactly 2 times after updating non-projected value'
		);
	}

	remote_doc.unsubscribe();
	remote_doc.destroy();

	unmount();
	assert.end();
});

test('react-sharedb: useSharedState updating directly projected object in doc state', async assert => {
	// Create a client connection to an in memory sharedb database to simulate
	//  a frontend connection to sharedb running on a server.
	const server = new sharedb.Backend();
	const local = server.connect();
	const remote = server.connect();

	const collection = 'collection';
	const doc_id = 'id:5456563';
	const doc_state = {
		doc_id: doc_id,
		thing: {
			prop1: 'one',
			prop2: 0,
			prop3: '',
		}
	};

	// create the doc via the secondary connection
	const remote_doc = remote.get(collection, doc_id);
	remote_doc.subscribe();
	remote_doc.create(doc_state);

	const MockWrapper = () => {
		const [{ prop1, prop2 }, submit] = useSharedState(
			collection,
			doc_id,
			({ thing }) => thing,
		);

		const render_count_ref = useRef(0);

		render_count_ref.current++;

		return (
			<Mock
				prop1={prop1}
				prop2={prop2}
				getRenderCount={() => render_count_ref.current}
				onSubmit={submit}
			/>
		);
	};

	let renderer = {};

	act(() => {
		// initial render of the react tree
		renderer = TestRenderer.create(
			<SharedStateProvider connection={local}>
				<Suspense fallback={<Loading />}>
					<MockWrapper />
				</Suspense>
			</SharedStateProvider>
		);
	});

	const { root, unmount } = renderer;

	// allow the sharedb server to flush updates
	await act(() => sleep(0));

	{
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.getRenderCount(),
			1,
			'Rendered exactly 1 time'
		);

		// submit an operation to change a prop
		act(() => {
			mock_instance.props.onSubmit({
				p: ['thing', 'prop1'],
				oi: 'two',
			});
		});
	}

	await act(() => sleep(0));

	{
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.prop1,
			'two',
			'The prop was updated.'
		)

		assert.equals(
			mock_instance.props.getRenderCount(),
			2,
			'Rendered exactly 2 times'
		);

		// submit op but don't change prop - make sure there's no re-render
		act(() => {
			mock_instance.props.onSubmit({
				p: ['thing', 'prop2'],
				oi: 0,
			});
		});
	}

	await act(() => sleep(0));

	{
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.getRenderCount(),
			2,
			'Rendered exactly 2 times'
		);
	}

	remote_doc.unsubscribe();
	remote_doc.destroy();

	unmount();
    assert.end();
});
