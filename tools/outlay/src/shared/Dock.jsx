import React from 'react';
import { useData } from '../data/DataContext.jsx';
import { useScrolledPast } from './hooks.js';
import ScrollTop from './ScrollTop.jsx';
import { IconPlus } from './Icons.jsx';

// Phone dock: a log button once the hero is behind you, plus the scroll-to-top button.
export default function Dock() {
  const { ui } = useData();
  const visible = useScrolledPast(560);
  return (
    <>
      <button type="button" className={`dock-log btn ${visible ? 'is-visible' : ''}`} onClick={() => ui.openEditor()}
        tabIndex={visible ? 0 : -1} aria-hidden={visible ? undefined : true}>
        <IconPlus />Log an expense
      </button>
      <ScrollTop />
    </>
  );
}
