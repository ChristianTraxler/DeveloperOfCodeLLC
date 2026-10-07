import React, { useEffect, useState } from 'react';
import { useData } from '../../data/DataContext.jsx';
import { useScrolledPast } from '../../shared/hooks.js';
import { IconPlus, IconMenu, IconClose, IconArrowLeft } from '../../shared/Icons.jsx';
import { ModeToggle } from '../../shared/mode.jsx';

const LINKS = [['ledger', 'Ledger'], ['spending', 'Spending'], ['billable', 'Billable'], ['recurring', 'Recurring'], ['taxes', 'Taxes']];

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
  const { ui } = useData();
  const solid = useScrolledPast(30);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu]);

  return (
    <header className={`d-header ${solid ? 'is-solid' : ''}`}>
      <div className="wrap d-header-row">
        <a href="/admin/" className="d-hub-link" aria-label="Back to the Admin Hub"><IconArrowLeft width={18} height={18} /><span>Hub</span></a>
        <a href="#top" className="d-brand"><BrandMark /><span className="d-brand-word">Outlay</span><span className="d-brand-sub">Developer of Code, LLC</span></a>
        <nav className="d-nav" aria-label="Sections">
          {LINKS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        </nav>
        <ModeToggle />
        <button type="button" className="btn btn-primary d-header-cta" onClick={() => ui.openEditor()}><IconPlus />Log an expense</button>
        <button type="button" className="icon-btn d-menu-btn" onClick={() => setMenu(true)} aria-label="Open the section menu" aria-expanded={menu}><IconMenu /></button>
      </div>
      {menu ? (
        <div className="d-menu tone-light" role="dialog" aria-modal="true" aria-label="Sections">
          <div className="d-menu-top">
            <span className="d-brand"><BrandMark /><span className="d-brand-word">Outlay</span></span>
            <button type="button" className="icon-btn" onClick={() => setMenu(false)} aria-label="Close the menu" autoFocus><IconClose /></button>
          </div>
          <nav aria-label="Sections">
            <ol>{LINKS.map(([id, label]) => <li key={id}><a href={`#${id}`} onClick={() => setMenu(false)}>{label}</a></li>)}</ol>
          </nav>
          <a href="/admin/" className="btn btn-quiet"><IconArrowLeft width={18} height={18} />Back to the Admin Hub</a>
          <button type="button" className="btn btn-primary" onClick={() => { setMenu(false); ui.openEditor(); }}><IconPlus />Log an expense</button>
        </div>
      ) : null}
    </header>
  );
}
