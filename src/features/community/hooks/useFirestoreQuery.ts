import { useEffect, useState } from 'react';
import { onSnapshot, type Query } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../../lib/firebase';

export interface QueryState<T> {
  data: T[];
  loading: boolean;
  error: unknown;
  /** 'cache' until the server confirms, so widgets can show stale data without flicker. */
  source: 'live' | 'cache';
}

/** Live Firestore list. `build` returns null to stay idle (e.g. signed out); `deps` re-subscribe it. */
export function useFirestoreQuery<T>(build: () => Query | null, deps: unknown[], path: string): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({ data: [], loading: true, error: null, source: 'cache' });

  useEffect(() => {
    const q = build();
    // Intentional synchronous resets: when the query changes (or goes idle) the previous results must be
    // replaced immediately so stale rows never show against a new query.
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ data: [], loading: false, error: null, source: 'cache' });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(s => ({ ...s, loading: true }));
    return onSnapshot(
      q,
      snap => setState({
        data: snap.docs.map(d => ({ id: d.id, ...d.data() }) as T),
        loading: false,
        error: null,
        source: snap.metadata.fromCache ? 'cache' : 'live',
      }),
      error => {
        handleFirestoreError(error, OperationType.LIST, path);
        setState(s => ({ ...s, loading: false, error }));
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
