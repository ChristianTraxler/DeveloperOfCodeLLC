import React, { useEffect } from 'react';
import { useData } from '../data/DataContext.jsx';

export default function Toast() {
  const { toast, dismissToast } = useData();
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(dismissToast, toast.tone === 'error' ? 6000 : 3400);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast ? <div key={toast.id} className={`toast ${toast.tone === 'error' ? 'toast-error' : ''}`}>{toast.message}</div> : null}
    </div>
  );
}
