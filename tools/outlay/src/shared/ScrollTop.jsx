import React from 'react';
import { useScrolledPast } from './hooks.js';
import { IconArrowUp } from './Icons.jsx';

export default function ScrollTop() {
  const visible = useScrolledPast(640);
  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    document.getElementById('top')?.focus({ preventScroll: true });
  };
  return (
    <button type="button" className={`fab ${visible ? 'is-visible' : ''}`} onClick={toTop} aria-label="Back to top"
      tabIndex={visible ? 0 : -1} aria-hidden={visible ? undefined : true}>
      <IconArrowUp width={22} height={22} />
    </button>
  );
}
