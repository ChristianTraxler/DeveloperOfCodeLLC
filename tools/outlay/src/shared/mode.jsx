import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { IconSun, IconMoon } from './Icons.jsx';

const ModeCtx = createContext({ mode: 'light', setMode: () => {} });
export const useMode = () => useContext(ModeCtx);

function readSaved(key) {
  try {
    const v = localStorage.getItem(key);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

// Light and dark modes. Each design opens in its own native mode; a choice is remembered in this browser.
export function ModeProvider({ native, storageKey, themeColors, children }) {
  const [mode, setModeState] = useState(() => readSaved(storageKey) || native);
  useLayoutEffect(() => {
    // The theme lives on the .outlay-root wrapper; only the browser's own scheme (scrollbars) is page wide.
    const wrap = document.querySelector('.outlay-root');
    if (wrap) wrap.dataset.mode = mode;
    document.documentElement.style.colorScheme = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && themeColors) meta.setAttribute('content', themeColors[mode]);
  }, [mode, themeColors]);
  const setMode = useCallback((next) => {
    if (next === mode) return;
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // the choice still applies for this visit
    }
    const commit = () => flushSync(() => setModeState(next));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduce) document.startViewTransition(commit);
    else commit();
  }, [mode, storageKey]);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ModeCtx.Provider value={value}>{children}</ModeCtx.Provider>;
}

export function ModeToggle({ className = '' }) {
  const { mode, setMode } = useMode();
  return (
    <div className={`mode-toggle ${className}`} role="group" aria-label="Color mode">
      <button type="button" aria-pressed={mode === 'light'} aria-label="Light mode" onClick={() => setMode('light')}><IconSun width={18} height={18} /></button>
      <button type="button" aria-pressed={mode === 'dark'} aria-label="Dark mode" onClick={() => setMode('dark')}><IconMoon width={18} height={18} /></button>
    </div>
  );
}
