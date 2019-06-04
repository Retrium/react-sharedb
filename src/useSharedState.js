// @flow

import { useContext, useEffect, useState, useCallback } from 'react';

import { ShareContext } from './SharedStateProvider';

function useThrower() {
	const [, setState] = useState();
	return function thrower(throwable: mixed) {
		setState(() => {
			throw throwable;
		});
	};
}

/** questions
  how should a hard rollback be handled?? should we throw a promise when the doc is being re-fetched?? can we even do this??
 */

export function useSharedState(
	collection: string,
	doc_id: string
): [any, (mixed) => Promise<void>] {
	const connection = useContext(ShareContext);

	if (!connection) {
		throw new Error(
			'The useSharedReducer hook must be mounted under a <SharedStateProvider>. Add a <SharedStateProvider> further up the react tree.'
		);
	}

	const maybe_doc = connection.getExisting(collection, doc_id);

	if (maybe_doc) {
		switch (maybe_doc._status) {
			case 'pending':
				throw maybe_doc._promise;
			case 'rejected':
				throw maybe_doc._error;
			default: {
				// 'resolved'

				const [{ state }, setState] = useState({ state: maybe_doc.data });
				const dispatch = useCallback(
					action => {
						// todo: allow action to be a function that takes unprojected/unmapped state
						//        and returns an action
						// todo: add validation that prevents submitting ops when the doc has been destroyed

						return new Promise(resolve => {
							maybe_doc.submitOp(action, () => {
								// todo: figure out how errors are to be handled
								resolve();
							});
						});
					},
					[maybe_doc]
				);

				useEffect(() => {
					const handle_op = () => {
						setState({ state: maybe_doc.data });
					};
					maybe_doc.addListener('op', handle_op);

					// increment the subscription ref count to indicate that this component is now subscribed to the doc
					maybe_doc._subscription_ref_count++;

					return () => {
						// if( maybe_doc._status === 'pending' ) {
						// 	return;
						// }
						// todo: delay destroying the doc from ram for a given timeout.
						maybe_doc.removeListener('op', handle_op);

						// decrement the subscription ref count to indicate that this component is no longer subscribed to the doc
						maybe_doc._subscription_ref_count--;

						// if
						if (maybe_doc._subscription_ref_count <= 0) {
							// you have to call unsubscribe before calling destroy otherwise the call
							// to destroy will not clean up the reference to the doc.
							// a newer version of sharedb may solve this problem so we should reevaluate after we upgrade sharedb
							maybe_doc.unsubscribe();
							maybe_doc.destroy();
						}
					};
				}, [maybe_doc]);

				return [state, dispatch];
			}
		}
	} else {
		const doc = connection.get(collection, doc_id);

		const promise = new Promise(resolve => {
			const on_load = () => {
				if (doc.type) {
					doc.removeListener('error', on_error);
					doc._status = 'resolved';
					delete doc._promise;
					resolve();
				} else {
					// todo: after the doc has loaded and while we wait for the document
					//  to be created we should periodically resolve even if the document has not loaded yet.
					//  That way, if there is no longer any hooks waiting for the doc to be created we can clean up.
					const on_create = () => {
						doc.removeListener('error', on_error);

						doc._status = 'resolved';
						delete doc._promise;
						resolve();
					};
					doc.once('create', on_create);
					doc.once('error', () => {
						doc.removeListener('create', on_create);
					});
				}
			};

			const on_error = error => {
				doc._status = 'rejected';
				delete doc._promise;
				doc._error = error;
			};

			doc.once('load', on_load);
			doc.once('error', () => doc.removeListener('load', on_load));
			doc.once('error', on_error);

			doc.subscribe();
		});

		doc._status = 'pending';
		doc._promise = promise;
		doc._subscription_ref_count = 0;

		throw promise;
	}
}
