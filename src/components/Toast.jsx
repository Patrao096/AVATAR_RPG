// frontend/src/components/Toast.jsx
//
// Uso:
//   1. Em App.jsx: <ToastProvider>...</ToastProvider>
//   2. Em qualquer componente: const { toast } = useToast();
//      toast.success('Comprou poção!');
//      toast.error('Sem Yuan suficiente');
//      toast.info('5 segundos restantes');
//
// Por que não usar alert?
//   - alert() bloqueia a thread/UI, é feio em mobile, sem animação.
//   - Toast roda em paralelo, some sozinho, empilha bem.

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback se alguém usar fora do provider — não quebra, só vira alert
    return {
      toast: {
        success: (m) => alert('✅ ' + m),
        error:   (m) => alert('❌ ' + m),
        info:    (m) => alert('ℹ️ ' + m),
        warning: (m) => alert('⚠️ ' + m),
      },
    };
  }
  return ctx;
}

let _idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(curr => curr.filter(t => t.id !== id));
  }, []);

  const show = useCallback((kind, message, opts = {}) => {
    const id = ++_idSeq;
    const duration = opts.duration ?? (kind === 'error' ? 5000 : 3500);
    setToasts(curr => [...curr, { id, kind, message, duration }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const toast = {
    success: (m, o) => show('success', m, o),
    error:   (m, o) => show('error', m, o),
    info:    (m, o) => show('info', m, o),
    warning: (m, o) => show('warning', m, o),
    dismiss,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const STYLES = {
  success: { icon: '✅', bg: 'bg-teal-500/15', border: 'border-teal-400/30', text: 'text-teal-200' },
  error:   { icon: '❌', bg: 'bg-red-500/15',  border: 'border-red-400/30',  text: 'text-red-200' },
  info:    { icon: 'ℹ️', bg: 'bg-sky-500/15',  border: 'border-sky-400/30',  text: 'text-sky-200' },
  warning: { icon: '⚠️', bg: 'bg-amber-500/15', border: 'border-amber-400/30', text: 'text-amber-200' },
};

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)] sm:max-w-sm">
      {toasts.map(t => {
        const s = STYLES[t.kind] || STYLES.info;
        return (
          <div key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 backdrop-blur-md
                        ${s.bg} ${s.border} ${s.text} border rounded-xl px-4 py-3
                        shadow-2xl text-sm font-medium toast-enter`}>
            <span className="text-lg leading-none">{s.icon}</span>
            <span className="flex-1 break-words">{t.message}</span>
            <button onClick={() => onDismiss(t.id)}
              className="text-zinc-400 hover:text-white text-xs px-1 -mr-1 leading-none"
              aria-label="Fechar">
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
