// @flow

import sharedb from 'sharedb/lib/client';
import type { Node } from 'react';
import React, { createContext, useEffect, useRef, useState } from 'react';

type SharedStateProviderProps =
	| {|
			websocket?: WebSocket,
			children: Node,
	  |}
	| {|
			connection: ShareDb$Connection,
			children: Node,
	  |};

type ShareDb$Doc$events = 'create' | 'op' | 'del' | 'load' | 'error';

type ShareDb$Doc = {
	// instance properties
	+type: string | null,
	+version: number | null,
	+data: mixed,

	// instance methods
	+subscribe: (?(error?: any) => void) => void,
	+submitOp: (mixed, ?(error?: any) => void) => void,
	+create: (state?: mixed) => void,
	+destroy: () => void,
	+unsubscribe: () => void,

	// event emitter stuff
	+addListener: (ShareDb$Doc$events, () => void) => void,
	+removeListener: (ShareDb$Doc$events, () => void) => void,
	+once: (ShareDb$Doc$events, () => void) => void,

	_status: 'pending' | 'resolved' | 'rejected',
	_promise?: Promise<void>,
	_error?: mixed,
	_subscription_ref_count: number,
};

type ShareDb$Connection = {
	+get: (string, string) => ShareDb$Doc,
	+getExisting: (string, string) => ?ShareDb$Doc,
	+close: () => void,
	+bindToSocket: WebSocket => void,
};

export function SharedStateProvider(props: SharedStateProviderProps): Node {
	const connection = props.connection || null;
	const websocket = props.websocket || null;
	const children = props.children;

	if (process.env.NODE_ENV !== 'production') {
		// eslint-disable-next-line react-hooks/rules-of-hooks
		const first_conn_ref = useRef(connection);

		if (!first_conn_ref.current) {
			if (connection) {
				// eslint-disable-next-line no-console
				console.warn(
					'<SharedStateProvider>: received `connection` but was not present on first render'
				);
			}
		} else {
			if (!connection) {
				// eslint-disable-next-line no-console
				console.warn(
					'<SharedStateProvider>: received `connection` on first render but was not present'
				);
			} else if (first_conn_ref.current !== connection) {
				// eslint-disable-next-line no-console
				console.warn(
					'<SharedStateProvider>: received different `connection` than first render'
				);
			}
		}
	}

	const [managed_conn, setConn] = useState<?ShareDb$Connection>(null);

	useEffect(() => {
		if (!connection) {
			// create a managed connection and bind it to a dummy websocket
			const managed_conn: ShareDb$Connection = new sharedb.Connection({
				close: () => {},
				readyState: 3,
			});
			setConn(managed_conn);

			return () => {
				// TODO: figure out how to properly clean up the connection
				// TODO: maybe bypass delayed calls to destroy docs?
				managed_conn.close();
				setConn(null);
			};
		}
	}, [connection]);

	useEffect(() => {
		if (managed_conn && websocket) {
			managed_conn.bindToSocket(websocket);
		}
	}, [managed_conn, websocket]);

	if (!connection && !managed_conn) {
		// can't render the provider and children until we have a connection
		return null;
	}
	return (
		<ShareContext.Provider value={connection || managed_conn}>
			{children}
		</ShareContext.Provider>
	);
}

export const ShareContext = createContext<?ShareDb$Connection>();
