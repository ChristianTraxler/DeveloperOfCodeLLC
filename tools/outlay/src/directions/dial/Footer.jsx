import React, { useState } from 'react';
import { useData } from '../../data/DataContext.jsx';

export default function Footer() {
  const { mode, resetDemo, signOut, session } = useData();
  const [confirm, setConfirm] = useState(false);
  return (
    <footer className="tone-dark d-footer">
      <div className="wrap">
        <p className="d-footer-word" aria-hidden="true">Outlay</p>
        <div className="d-footer-grid">
          <div>
            <p className="d-label">Developer of Code, LLC</p>
            <p className="d-fine">The studio&rsquo;s expense ledger: every receipt, renewal and client cost in one place.</p>
          </div>
          {mode === 'supabase' ? (
            <div>
              <p className="d-label">Synced with Supabase</p>
              <p className="d-fine">Signed in as {session?.user?.email || 'you'}.</p>
              <div className="d-footer-actions"><button type="button" className="btn-text" onClick={() => signOut()}>Sign out</button></div>
            </div>
          ) : (
            <div>
              <p className="d-label">Preview mode</p>
              <p className="d-fine">Entries and receipts save in this browser only. Add your Supabase keys to sync across devices.</p>
              <div className="d-footer-actions">
                {confirm ? (
                  <>
                    <span>Clear every entry?</span>
                    <button type="button" className="btn-text" onClick={() => { setConfirm(false); resetDemo('empty').catch(() => {}); }}>Yes, clear it</button>
                    <button type="button" className="btn-text" onClick={() => setConfirm(false)}>Keep everything</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn-text" onClick={() => resetDemo('sample').catch(() => {})}>Restore sample data</button>
                    <button type="button" className="btn-text" onClick={() => setConfirm(true)}>Start with an empty ledger</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <p className="d-fine d-footer-small">&copy; {new Date().getFullYear()} Developer of Code, LLC</p>
      </div>
    </footer>
  );
}
