// @flow

import test from 'tape';
import sharedb from 'sharedb';

import React, { Suspense } from 'react';
import type { Node } from 'react';
import TestRenderer from 'react-test-renderer';

import { SharedState, SharedStateProvider } from './index';

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function Loading() {
	return <div />;
}

function Mock() {
	return <div />;
}

class ErrorBoundary extends React.Component<
	{ children: Node, onError: Error => void },
	{ hasError: boolean }
> {
	constructor(props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch(error) {
		const { onError } = this.props;
		onError(error);
	}

	render() {
		return this.state.hasError ? <div /> : this.props.children;
	}
}

test('react-sharedb: useSharedReducer works with <Suspense> and component lifecycles to manage the lifetime of sharedb docs.', async assert => {
	// Create a client connection to an in memory sharedb database to simulate
	//  a frontend connection to sharedb running on a server.
	const server = new sharedb.Backend();
	const local = server.connect();
	const remote = server.connect();

	const collection = 'collection';
	const doc_id = 'id:5456563';
	const doc_state = { doc_id };

	// create the doc via the secondary connection
	remote.get(collection, doc_id).create(doc_state);

	// initial render of the react tree
	const { root, unmount, update } = TestRenderer.create(
		<SharedStateProvider connection={local}>
			<Suspense fallback={<Loading />}>
				<SharedState collection={collection} docId={doc_id}>
					{state => <Mock doc_id={state.doc_id} />}
				</SharedState>
			</Suspense>
		</SharedStateProvider>
	);

	{
		const doc = local.getExisting(collection, doc_id);

		assert.ok(doc, 'The share doc exists,');
		assert.equals(doc.version, null, 'has not loaded yet,');
		assert.ok(doc.wantSubscribe, 'and has been subscribed to.');

		const [mock_instance] = root.findAllByType(Mock);

		assert.notOk(
			mock_instance,
			'Rendering <Mock> was suspended while we wait for the document to load from the server.'
		);
	}

	// allow the sharedb server to flush updates
	await sleep(0);

	{
		const [mock_instance] = root.findAllByType(Mock);
		assert.ok(mock_instance, '<Mock> renders after the share doc was created.');

		assert.deepEquals(
			mock_instance.props.doc_id,
			doc_state.doc_id,
			"The doc_id prop on the <Mock> instance is equal to the doc_id on the doc's state."
		);
	}

	update(
		<SharedStateProvider connection={local}>
			<Suspense fallback={<Loading />} />
		</SharedStateProvider>
	);

	{
		const doc = local.getExisting(collection, doc_id);
		assert.ok(doc, 'The share doc still exists after <Mock> unmounts');
		assert.notOk(doc.wantSubscribe, 'but is no longer subscribed to.');
	}

	// allow the sharedb server to flush updates
	await sleep(0);

	assert.notOk(
		local.getExisting(collection, doc_id),
		'After waiting the share doc is no longer in memory.'
	);

	unmount();

	assert.end();
});

test('react-sharedb: useSharedReducer suspends rendering until the document has been created.', async assert => {
	// Create a client connection to an in memory sharedb database to simulate
	//  a frontend connection to sharedb running on a server.
	const server = new sharedb.Backend();
	const local = server.connect();
	const remote = server.connect();

	const collection = 'collection';
	const doc_id = 'id:5456563';
	const doc_state = { doc_id };

	const remote_doc = remote.get(collection, doc_id);

	// initial render of the react tree
	const { root, unmount } = TestRenderer.create(
		<SharedStateProvider connection={local}>
			<Suspense fallback={<Loading />}>
				<SharedState collection={collection} docId={doc_id}>
					{state => <Mock doc_id={state.doc_id} />}
				</SharedState>
			</Suspense>
		</SharedStateProvider>
	);

	// allow the sharedb server to flush updates
	await sleep(0);

	{
		const doc = local.getExisting(collection, doc_id);
		const [mock_instance] = root.findAllByType(Mock);

		assert.ok(doc, 'The doc exists,');
		assert.notEquals(doc.version, null, 'has loaded,');
		assert.equals(doc.type, null, 'but has not been created yet,');
		assert.notOk(mock_instance, 'and rendering of <Mock> is suspended.');
	}

	// create the doc via the secondary connection
	remote_doc.create(doc_state);

	// allow the sharedb server to flush updates
	await sleep(0);

	{
		const doc = local.getExisting(collection, doc_id);
		const [mock_instance] = root.findAllByType(Mock);

		assert.notEquals(doc.type, null, 'The sharedb doc has been created,');
		assert.ok(mock_instance, ' <Mock> has rendered,');
		assert.equals(
			mock_instance.props.doc_id,
			remote_doc.data.doc_id,
			" and the <Mock>'s doc_id prop is equal to the remote doc's doc_id state"
		);
	}

	unmount();
	assert.end();
});

test('react-sharedb: useSharedReducer unsubscribes from a doc and destroys it (removes it from ram) only after the last component that is subscribed to it unmounts.', async assert => {
	// Create a client connection to an in memory sharedb database to simulate
	//  a frontend connection to sharedb running on a server.
	const server = new sharedb.Backend();
	const local = server.connect();
	const remote = server.connect();

	const collection = 'collection';
	const doc_id = 'id:5456563';
	const doc_state = { doc_id };

	// create the doc via the secondary connection
	remote.get(collection, doc_id).create(doc_state);

	// initial render of the react tree
	const { root, unmount, update } = TestRenderer.create(
		<SharedStateProvider connection={local}>
			<Suspense fallback={<Loading />}>
				<SharedState key="0" collection={collection} docId={doc_id}>
					{() => <Mock />}
				</SharedState>
				<SharedState key="1" collection={collection} docId={doc_id}>
					{() => <Mock />}
				</SharedState>
			</Suspense>
		</SharedStateProvider>
	);

	// allow the sharedb server to flush updates
	await sleep(0);

	{
		const doc = local.getExisting(collection, doc_id);
		const mock_instance_count = root.findAllByType(Mock).length;

		assert.ok(doc, 'The doc exists,');
		assert.notEquals(doc.version, null, 'has loaded,');
		assert.notEquals(doc.type, null, 'has been created,');
		assert.equals(mock_instance_count, 2, 'and two <Mock>s have rendered.');
	}

	// update the react tree so that only one of the Mocks unmounts
	update(
		<SharedStateProvider connection={local}>
			<Suspense fallback={<Loading />}>
				<SharedState key="1" collection={collection} docId={doc_id}>
					{() => <Mock />}
				</SharedState>
			</Suspense>
		</SharedStateProvider>
	);

	// allow the sharedb server to flush updates
	await sleep(0);

	{
		const doc = local.getExisting(collection, doc_id);
		const mock_instance_count = root.findAllByType(Mock).length;

		assert.ok(doc, 'The doc still exists,');
		assert.notEquals(doc.version, null, 'is loaded,');
		assert.notEquals(doc.type, null, 'is still created,');
		assert.equals(mock_instance_count, 1, 'and only one <Mock> is rendered.');
	}

	// update the react tree so that the last Mock unmounts
	update(
		<SharedStateProvider connection={local}>
			<Suspense fallback={<Loading />} />
		</SharedStateProvider>
	);

	// allow the sharedb server to flush updates
	await sleep(0);

	{
		const doc = local.getExisting(collection, doc_id);
		const mock_instance_count = root.findAllByType(Mock).length;

		assert.notOk(doc, 'The no longer exists,');
		assert.equals(mock_instance_count, 0, 'and no <Mock>s are rendered.');
	}

	unmount();
	assert.end();
});

test("react-sharedb: useSharedReducer causes a re-render when the doc's state changes due to a remote operation", async assert => {
	// Create a client connection to an in memory sharedb database to simulate
	//  a frontend connection to sharedb running on a server.
	const server = new sharedb.Backend();
	const local = server.connect();
	const remote = server.connect();

	const collection = 'collection';
	const doc_id = 'id:5456563';
	const doc_state = {
		doc_id: doc_id,
		count: 0,
	};

	// create the doc via the secondary connection
	const remote_doc = remote.get(collection, doc_id);
	remote_doc.create(doc_state);

	// initial render of the react tree
	const { root, unmount } = TestRenderer.create(
		<SharedStateProvider connection={local}>
			<Suspense fallback={<Loading />}>
				<SharedState key={doc_id} collection={collection} docId={doc_id}>
					{(state, submit) => <Mock count={state.count} onSubmit={submit} />}
				</SharedState>
			</Suspense>
		</SharedStateProvider>
	);

	// allow the sharedb server to flush updates
	await sleep(0);

	{
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.count,
			0,
			"The <Mock>'s count prop is 0."
		);
	}

	// submit an operation to increment the count property by one
	remote_doc.submitOp({
		p: ['count'],
		na: 1,
	});

	// allow the sharedb server to flush updates
	await sleep(0);

	{
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.count,
			1,
			"The <Mock>'s count prop has been incremented to 1."
		);
	}

	unmount();
	assert.end();
});

test('react-sharedb: when submitting operations via the submit function returned by useSharedReducer the component will rerender with the new state and the server will receive the operation', async assert => {
	// Create a client connection to an in memory sharedb database to simulate
	//  a frontend connection to sharedb running on a server.
	const server = new sharedb.Backend();
	const local = server.connect();
	const remote = server.connect();

	const collection = 'collection';
	const doc_id = 'id:5456563';
	const doc_state = {
		doc_id: doc_id,
		count: 0,
	};

	// create the doc via the secondary connection
	const remote_doc = remote.get(collection, doc_id);
	remote_doc.subscribe();
	remote_doc.create(doc_state);

	// initial render of the react tree
	const { root, unmount } = TestRenderer.create(
		<SharedStateProvider connection={local}>
			<Suspense fallback={<Loading />}>
				<SharedState key={doc_id} collection={collection} docId={doc_id}>
					{(state, submit) => <Mock count={state.count} onSubmit={submit} />}
				</SharedState>
			</Suspense>
		</SharedStateProvider>
	);

	// allow the sharedb server to flush updates
	await sleep(0);

	{
		//const remote_doc = remote.get(collection, doc_id);
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.count,
			0,
			"The <Mock>'s count prop is 0."
		);

		assert.equals(
			remote_doc.data.count,
			0,
			"And the remote doc's count is also 0"
		);

		// submit an operation to increment the count property by one
		mock_instance.props.onSubmit({
			p: ['count'],
			na: 1,
		});
	}

	// allow the sharedb server to flush updates
	await sleep(0);

	{
		const [mock_instance] = root.findAllByType(Mock);

		assert.equals(
			mock_instance.props.count,
			1,
			"The <Mock>'s count prop is 1,"
		);

		assert.equals(
			remote_doc.data.count,
			1,
			"And the remote doc's count is also 1"
		);
	}

	remote_doc.unsubscribe();
	remote_doc.destroy();

	unmount();
	assert.end();
});

test.skip('react-sharedb: useSharedReducer suspends rendering of an already rendered component when the doc id changes.', async assert => {
	// Create a client connection to an in memory sharedb database to simulate
	//  a frontend connection to sharedb running on a server.
	const server = new sharedb.Backend();
	const local = server.connect();
	const remote = server.connect();

	const collection = 'collection';
	const doc_id_0 = 'id:5456563';
	const doc_id_1 = 'id:8099109';

	const doc_0_state = { doc_id: doc_id_0 };
	const doc_1_state = { doc_id: doc_id_1 };

	// create both docs via the secondary connection
	remote.get(collection, doc_id_0).create(doc_0_state);
	remote.get(collection, doc_id_1).create(doc_1_state);

	// initial render of the react tree
	const { root, update, unmount } = TestRenderer.create(
		<ErrorBoundary onError={err => assert.end(err)}>
			<SharedStateProvider connection={local}>
				<Suspense fallback={<Loading />}>
					<SharedState collection={collection} docId={doc_id_0}>
						{(state, submit) => <Mock state={state} onSubmit={submit} />}
					</SharedState>
				</Suspense>
			</SharedStateProvider>
		</ErrorBoundary>
	);

	// allow the sharedb server to flush updates
	await sleep(0);

	{
		const [loading] = root.findAllByType(Loading);
		const [mock] = root.findAllByType(Mock);

		assert.notOk(!!loading, '<Loading> is no longer rendered,');
		assert.ok(!!mock, '<Mock> has rendered,');
		assert.deepEquals(
			mock.props.state,
			doc_0_state,
			'and the state prop is equal to the state of the first doc.'
		);
	}

	update(
		<ErrorBoundary onError={err => assert.end(err)}>
			<SharedStateProvider connection={local}>
				<Suspense fallback={<Loading />}>
					<SharedState collection={collection} docId={doc_id_1}>
						{(state, submit) => <Mock state={state} onSubmit={submit} />}
					</SharedState>
				</Suspense>
			</SharedStateProvider>
		</ErrorBoundary>
	);

	{
		const [loading] = root.findAllByType(Loading);
		const [mock] = root.findAllByType(Mock);

		assert.notOk(
			!!mock,
			'After updating <SharedState> with the second doc id the rendering of <Mock> was suspended'
		);
		//assert.deepEquals( mock_instance.props.state, doc_0_state, 'and the state prop is equal to the state of the first doc.' );
		assert.ok(
			!!loading,
			"and <Suspense> has rendered <Loading> in it's place."
		);
	}

	// allow the sharedb server to flush updates
	await sleep(0);

	// {
	// 	const [ loading ] = root.findAllByType( Loading );
	// 	const [ mock ] = root.findAllByType( Mock );

	// 	assert.notOk( !!loading, 'After allowing sharedb to load the new document <Loading> is no longer rendered,');
	// 	assert.ok( !!mock, '<Mock> has loaded in it\'s place,' );
	// 	assert.deepEquals( mock.props.state, doc_1_state, 'and <Mock> has the state of the second doc.' );
	// }

	unmount();

	assert.end();
});

test.skip('react-sharedb: useSharedReducer suspends rendering if a document is deleted while a component is subscribed to it.', async assert => {
	try {
		// Create a client connection to an in memory sharedb database to simulate
		//  a frontend connection to sharedb running on a server.
		const server = new sharedb.Backend();
		const local = server.connect();
		const remote = server.connect();

		const collection = 'collection';
		const doc_id = 'id:5456563';

		// create the doc via the secondary connection
		remote.get(collection, doc_id).create({});

		// initial render of the react tree
		const { root, unmount, update } = TestRenderer.create(
			<SharedStateProvider connection={local}>
				<Suspense fallback={<Loading />}>
					<SharedState collection={collection} docId={doc_id}>
						{(state, submit) => <Mock state={state} onSubmit={submit} />}
					</SharedState>
				</Suspense>
			</SharedStateProvider>
		);

		await TestRenderer.act(async () => {
			// allow the sharedb server to flush updates
			await sleep(0);

			// now delete the document via the secondary connection
			remote.get(collection, doc_id).del();

			// allow the sharedb server to flush updates
			await sleep(0);
		});

		{
			const doc = local.getExisting(collection, doc_id);
			const [mock_instance] = root.findAllByType(Mock);
			const [loading_instance] = root.findAllByType(Loading);

			assert.ok(doc, 'The share doc exists,');
			assert.notEquals(doc.version, null, 'is loaded,');
			assert.equals(doc.type, null, 'is deleted ( or at least not created ),');
			assert.notOk(!!mock_instance, "and <Mock>'s rendering is suspended");
			assert.ok(
				!!loading_instance,
				'and <Suspense> has fallen back to <Loading> in place of <Mock>.'
			);
		}

		unmount();
		assert.end();
	} catch (e) {
		assert.end(e);
	}
});
