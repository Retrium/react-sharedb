// @flow
import { useCallback, useContext } from 'react'

import { ShareContext } from './SharedStateProvider'

export function useSharedStateCreator() {
	const connection = useContext(ShareContext);

	if( !connection ) {
		throw new Error('The useSharedStateCreator hook must be mounted under a <SharedStateProvider>. Add a <SharedStateProvider> further up the react tree.');
	}

	return useCallback(
		(collection: string, doc_id: string, state?: mixed) => {
			connection.get(collection, doc_id).create(state);
		},
		[ connection ]
	);
}
