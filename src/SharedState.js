//@flow

import type { Node } from 'react';

import { useSharedState } from './index';

type SharedStateProps = {
	collection: string,
	docId: string,
	children: (any, (mixed) => Promise<void>) => Node,
};

export function SharedState({
	collection,
	docId,
	children,
}: SharedStateProps): Node {
	const [state, submit] = useSharedState(collection, docId);
	return children(state, submit);
}
