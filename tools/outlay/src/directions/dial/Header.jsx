import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../../data/DataContext.jsx';
import { IconPlus, IconMenu, IconClose, IconArrowLeft, IconLogOut } from '../../shared/Icons.jsx';
import { ModeToggle } from '../../shared/mode.jsx';

const LINKS = [['ledger', 'Ledger'], ['income', 'Income'], ['spending', 'Spending'], ['billable', 'Billable'], ['recurring', 'Recurring'], ['taxes', 'Taxes']];

export function BrandMark() {
  return (
    <svg className="d-brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return <line key={i} x1={16 + 11.4 * Math.sin(a)} y1={16 - 11.4 * Math.cos(a)} x2={16 + 13.2 * Math.sin(a)} y2={16 - 13.2 * Math.cos(a)} stroke="currentColor" strokeWidth={i % 3 === 0 ? 1.6 : 0.9} strokeLinecap="round" />;
      })}
      <path d="M16 16 L11.6 10.2 M16 16 L22.4 13.4" style={{ stroke: 'rgb(var(--steel))' }} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.7" style={{ fill: 'rgb(var(--orange))' }} />
    </svg>
  );
}

export default function Header() {
  const { ui, mode, signOut } = useData();
    const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu]);

  return (
    <header className="d-header is-solid">
      <div className="d-header-row">
        <a href="#top" className="d-brand"><span className="d-doc">{'</DOC>'}</span><span className="d-brand-div" /><span className="d-brand-label">Outlay</span></a>
        <nav className="d-nav" aria-label="Sections">
          {LINKS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        </nav>
        <ModeToggle />
        <button type="button" className="btn btn-primary d-header-cta" onClick={() => ui.openEditor()}><IconPlus />Log an expense</button>
        <button type="button" className="icon-btn d-menu-btn" onClick={() => setMenu(true)} aria-label="Open the section menu" aria-expanded={menu}><IconMenu /></button>
        <a href="/admin/" className="d-pill" aria-label="Back to hub"><IconArrowLeft width={16} height={16} /><span className="lbl">Hub</span></a>
        {mode === 'supabase' ? <button type="button" className="d-pill" onClick={() => signOut()} aria-label="Sign out"><IconLogOut width={16} height={16} /><span className="lbl">Sign out</span></button> : null}
      </div>
      {menu ? createPortal(
        <div className="d-menu tone-light" role="dialog" aria-modal="true" aria-label="Sections">
          <div className="d-menu-top">
            <span className="d-brand"><BrandMark /><span className="d-brand-word">Outlay</span></span>
            <button type="button" className="icon-btn" onClick={() => setMenu(false)} aria-label="Close the menu" autoFocus><IconClose /></button>
          </div>
          <nav aria-label="Sections">
            <ol>{LINKS.map(([id, label]) => <li key={id}><a href={`#${id}`} onClick={() => setMenu(false)}>{label}</a></li>)}</ol>
          </nav>
          <div className="d-menu-actions">
            <button type="button" className="btn btn-primary" onClick={() => { setMenu(false); ui.openEditor(); }}><IconPlus />Log an expense</button>
            <a href="/admin/" className="btn btn-quiet"><IconArrowLeft width={18} height={18} />Back to the Admin Hub</a>
          </div>
        </div>,
        document.querySelector('.outlay-root') || document.body,
      ) : null}
    </header>
  );
}
