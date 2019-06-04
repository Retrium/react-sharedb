// @flow

import type { Node } from 'react'
import React, {
	createContext,
} from 'react'

type ShareProviderProps = {
	children: Node,
	connection: ShareDb$Connection
}

type ShareDb$Doc$events = 'create' | 'op' | 'del' | 'load' | 'error';

type ShareDb$Doc = {
	// instance properties
	+type: 'string' | null,
	+version: number | null,
	+data: mixed,

	// instance methods
	+subscribe: ( ?(error?: any) => void ) => void,
	+submitOp: (mixed, ?(error?: any) => void) => void,
	+create: (state?: mixed) => void,
	+destroy: () => void,
	+unsubscribe: () => void,

	// event emitter stuff
	+addListener: ( ShareDb$Doc$events, () => void ) => void,
	+removeListener: ( ShareDb$Doc$events, () => void ) => void,
	+once: ( ShareDb$Doc$events, () => void ) => void,

	_status: 'pending' | 'resolved' | 'rejected',
	_promise?: Promise<void>,
	_error?: mixed,
	_subscription_ref_count: number,
}

type ShareDb$Connection = {
	+get: (string, string) => ShareDb$Doc,
	+getExisting: (string, string) => ?ShareDb$Doc,
}

export const ShareContext = createContext<?ShareDb$Connection>();

export function SharedStateProvider({ connection, children }: ShareProviderProps) {

	return (
		<ShareContext.Provider value={ connection } >
			{ children }
		</ShareContext.Provider>
	);
}
