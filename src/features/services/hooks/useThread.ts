import { collection, query, where } from 'firebase/firestore';
import { useCallback, useMemo, useState } from 'react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { sendMessageSafely } from '../../../services/chatService';
import type { ChatMessage } from '../../../types';
import { useFirestoreQuery } from '../../community/hooks/useFirestoreQuery';

interface OutboxItem { key: string; text: string; state: 'sending' | 'failed' }

/** Live two-person thread with an outbox so unsent messages show as sending/failed and can be retried. */
export function useThread(otherId: string | null) {
  const { user } = useAuth();
  const uid = user?.uid;
  const roomId = uid && otherId ? [uid, otherId].sort().join('_') : null;
  // Sorted client-side to avoid a composite index; the array-contains clause is required by the chats read rule.
  const { data, loading, error, source } = useFirestoreQuery<ChatMessage>(
    () => (roomId && uid
      ? query(collection(db, 'chats'), where('roomId', '==', roomId), where('participants', 'array-contains', uid))
      : null),
    [roomId, uid],
    'chats',
  );
  const messages = useMemo(
    () => [...data].sort((a, b) => (a.timestamp?.seconds ?? Infinity) - (b.timestamp?.seconds ?? Infinity)),
    [data],
  );

  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const deliver = useCallback(async (key: string, text: string) => {
    if (!uid || !otherId) return;
    const ok = await sendMessageSafely(uid, otherId, text);
    setOutbox(o => (ok ? o.filter(m => m.key !== key) : o.map(m => (m.key === key ? { ...m, state: 'failed' } : m))));
  }, [uid, otherId]);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const key = crypto.randomUUID();
    setOutbox(o => [...o, { key, text: trimmed, state: 'sending' }]);
    return deliver(key, trimmed);
  }, [deliver]);

  const retry = useCallback((key: string) => {
    const item = outbox.find(m => m.key === key);
    if (!item) return;
    setOutbox(o => o.map(m => (m.key === key ? { ...m, state: 'sending' } : m)));
    return deliver(key, item.text);
  }, [outbox, deliver]);

  return { messages, outbox, send, retry, loading, error, source };
}
