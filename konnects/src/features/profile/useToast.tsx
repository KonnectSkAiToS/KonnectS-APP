import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string }

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const STYLES: Record<ToastKind, string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-rose-600 text-white',
  info: 'bg-slate-800 text-white',
};

/** Small self-contained toast: render <ToastHost /> once and call toast.success/error/info. */
export function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((cur) => cur.filter((t) => t.id !== id)), []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setItems((cur) => [...cur.slice(-2), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 4000);
  }, [dismiss]);

  const toast: ToastApi = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  };

  const ToastHost = (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[300] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 text-xs font-bold shadow-2xl ${STYLES[t.kind]}`}
          >
            {t.kind === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : t.kind === 'error' ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  return { toast, ToastHost };
}
