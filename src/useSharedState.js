// @flow

import { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { isPlainObject, deepClone } from 'mout/lang';
import { equals as arrayShallowEquals } from 'mout/array';
import { equals as objectShallowEquals } from 'mout/object';
import { identity } from 'mout/function'
import { ShareContext } from './SharedStateProvider';

/** questions
  how should a hard rollback be handled?? should we throw a promise when the doc is being re-fetched?? can we even do this??
 */

export function useSharedState(
	collection: string,
	doc_id: string,
	projector?: any => any,
	deps?: Array<mixed>
): [any, ((any) => any | any) => Promise<void>] {
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
				const has_projector = !!projector;
				const should_clone = true;

				const memo_projector = useCallback(projector || identity, deps);

				const [{ state }, setState] = useState({
					state: has_projector
						? should_clone
							? deepClone(memo_projector(maybe_doc.data))
							: memo_projector(maybe_doc.data)
						: maybe_doc.data,
				});

				const state_ref = useRef(state);

				const dispatch = useCallback(
					(action: any => any | any): Promise<void> => {
						// todo: add validation that prevents submitting ops when the doc has been destroyed
						return new Promise((resolve, reject) => {
							try {
								maybe_doc.submitOp(
									typeof action === 'function'
										? action(maybe_doc.data)
										: action,
									err => {
										if (err) {
											reject(err);
										} else {
											resolve();
										}
									}
								);
							} catch (err) {
								reject(err);
							}
						});
					},
					[maybe_doc]
				);

				useEffect(() => {
					const handle_op = () => {
						if (!has_projector) {
							state_ref.current = maybe_doc.data;
							setState({ state: maybe_doc.data });
							return;
						}

						const projected_state = memo_projector(maybe_doc.data);
						const { current: current_projected_state } = state_ref;

						if (typeof projected_state !== typeof current_projected_state) {
							// rerender
							const state = should_clone
								? deepClone(projected_state)
								: projected_state;

							state_ref.current = state;
							setState({ state });
							return;
						}

						if (
							Array.isArray(projected_state) &&
							Array.isArray(current_projected_state)
						) {
							// if lengths are not the same then rerender
							if (
								!arrayShallowEquals(projected_state, current_projected_state)
							) {
								const state = should_clone
									? deepClone(projected_state)
									: projected_state;

								state_ref.current = state;
								setState({ state });
								return;
							}

							return;
						}

						if (
							isPlainObject(projected_state) &&
							isPlainObject(current_projected_state)
						) {
							// if they have a different amount of keys, rerender:
							if (
								!objectShallowEquals(projected_state, current_projected_state)
							) {
								const state = should_clone
									? deepClone(projected_state)
									: projected_state;

								state_ref.current = state;
								setState({ state });
								return;
							}

							return;
						}

						// if we're here it's likely a number, bool, string, etc. so do an equality check
						if (projected_state !== current_projected_state) {
							// rerender
							setState({ state: projected_state });
							state_ref.current = projected_state;
						}
					};
					maybe_doc.addListener('op', handle_op);

					return () => {
						maybe_doc.removeListener('op', handle_op);
					};
				}, [should_clone, maybe_doc, has_projector, memo_projector]);

				useEffect(() => {
					// increment the subscription ref count to indicate that this component is now subscribed to the doc
					maybe_doc._subscription_ref_count++;

					return () => {
						// if( maybe_doc._status === 'pending' ) {
						// 	return;
						// }
						// todo: delay destroying the doc from ram for a given timeout.

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
