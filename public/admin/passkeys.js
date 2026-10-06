// admin/passkeys.js
// Adds a "Passkeys" button + manage dialog to the admin hub header.
// Self-contained: injects its own markup and styles, so it works on any
// admin page that has a #signoutBtn.

const CSS = `
.pk-btn { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 44px; padding: 0 0.9rem; background: transparent;
  color: inherit; border: 1px solid var(--line2, rgba(255,255,255,0.2)); border-radius: 9px; font: inherit; font-size: 0.82rem; cursor: pointer; }
.pk-btn:hover { background: rgba(255,255,255,0.07); }
.pk-dialog { width: min(480px, calc(100vw - 2rem)); padding: 1.4rem; border: 1px solid var(--line2, rgba(255,255,255,0.2));
  border-radius: 14px; background: var(--panel, #0d1322); color: var(--bone, #ece8df); font-family: var(--font-body, system-ui); }
.pk-dialog::backdrop { background: rgba(0,0,0,0.6); }
.pk-dialog h2 { margin: 0 0 0.3rem; font-family: var(--font-display, serif); font-size: 1.2rem; }
.pk-hint { margin: 0 0 1rem; font-size: 0.84rem; color: var(--mute, #98a1b5); line-height: 1.5; }
.pk-list { list-style: none; margin: 0 0 1rem; padding: 0; display: grid; gap: 0.5rem; }
.pk-list li { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.65rem 0.8rem;
  border: 1px solid var(--line, rgba(255,255,255,0.1)); border-radius: 9px; font-size: 0.9rem; }
.pk-meta { display: block; font-size: 0.72rem; color: var(--faint, #626b81); margin-top: 0.15rem; }
.pk-row { display: flex; gap: 0.4rem; }
.pk-row button, .pk-foot button { min-height: 40px; padding: 0 0.8rem; background: transparent; color: inherit; font: inherit; font-size: 0.8rem;
  border: 1px solid var(--line2, rgba(255,255,255,0.2)); border-radius: 8px; cursor: pointer; }
.pk-row button:hover, .pk-foot button:hover:not(:disabled) { background: rgba(255,255,255,0.07); }
.pk-row button.danger:hover { color: var(--danger, #ff6b5e); border-color: var(--danger, #ff6b5e); }
.pk-foot button.primary { background: var(--ember, #ff5a1f); border-color: transparent; color: #070a12; font-weight: 600; }
.pk-foot button:disabled { opacity: 0.6; cursor: not-allowed; }
.pk-btn:focus-visible, .pk-dialog button:focus-visible { outline: 2px solid var(--ember, #ff5a1f); outline-offset: 2px; }
.pk-foot { display: flex; gap: 0.6rem; justify-content: flex-end; }
.pk-msg { min-height: 1.2em; margin: 0 0 0.8rem; font-size: 0.84rem; }
.pk-msg.error { color: var(--danger, #ff6b5e); }
.pk-msg.info { color: var(--mute, #98a1b5); }
@media (max-width: 640px) { .pk-btn .lbl { display: none; } .pk-btn { padding: 0 0.7rem; } }
`;

const isCancel = (err) => /NotAllowed|abort|cancel/i.test((err?.name || '') + ' ' + (err?.message || ''));
const fmt = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';

export function initPasskeys(supabase) {
  if (!window.PublicKeyCredential || !supabase.auth.registerPasskey) return;
  const signout = document.getElementById('signoutBtn');
  if (!signout || document.getElementById('pkBtn')) return;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  const btn = document.createElement('button');
  btn.id = 'pkBtn'; btn.type = 'button'; btn.className = 'pk-btn'; btn.setAttribute('aria-label', 'Manage passkeys');
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15 19 4"/><path d="m18 5 3 3"/><path d="m15 8 2 2"/></svg><span class="lbl">Passkeys</span>';
  signout.before(btn);

  const dlg = document.createElement('dialog');
  dlg.className = 'pk-dialog';
  dlg.setAttribute('aria-labelledby', 'pkTitle');
  dlg.innerHTML = `<h2 id="pkTitle">Passkeys</h2>
    <p class="pk-hint">Sign in with Face ID, Touch ID or a security key. Your password still works as a fallback, so keep it.</p>
    <ul class="pk-list"></ul>
    <p class="pk-msg" role="status" aria-live="polite"></p>
    <div class="pk-foot"><button type="button" class="close">Close</button><button type="button" class="primary add">Add a passkey</button></div>`;
  document.body.append(dlg);

  const list = dlg.querySelector('.pk-list');
  const msg = dlg.querySelector('.pk-msg');
  const add = dlg.querySelector('.add');
  const setMsg = (t, kind = 'error') => { msg.textContent = t; msg.className = 'pk-msg ' + kind; };

  async function render() {
    list.replaceChildren();
    const { data, error } = await supabase.auth.passkey.list();
    if (error) { setMsg(error.message || 'Could not load passkeys.'); return; }
    if (!data.length) { const li = document.createElement('li'); li.textContent = 'No passkeys yet.'; list.append(li); return; }
    for (const pk of data) {
      const li = document.createElement('li');
      const info = document.createElement('div');
      info.textContent = pk.friendly_name || 'Passkey';
      const meta = document.createElement('span');
      meta.className = 'pk-meta';
      meta.textContent = 'Added ' + fmt(pk.created_at) + (pk.last_used_at ? ' · Last used ' + fmt(pk.last_used_at) : '');
      info.append(meta);

      const row = document.createElement('div');
      row.className = 'pk-row';
      const rename = document.createElement('button');
      rename.type = 'button'; rename.textContent = 'Rename';
      rename.onclick = async () => {
        const next = window.prompt('Name this passkey', pk.friendly_name || '');
        if (!next || !next.trim()) return;
        const { error: err } = await supabase.auth.passkey.update({ passkeyId: pk.id, friendlyName: next.trim().slice(0, 120) });
        if (err) setMsg(err.message || 'Rename failed.'); else { setMsg(''); render(); }
      };
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'danger'; del.textContent = 'Remove';
      del.onclick = async () => {
        if (!window.confirm('Remove this passkey? You can still sign in with your password.')) return;
        const { error: err } = await supabase.auth.passkey.delete({ passkeyId: pk.id });
        if (err) setMsg(err.message || 'Remove failed.'); else { setMsg(''); render(); }
      };
      row.append(rename, del);
      li.append(info, row);
      list.append(li);
    }
  }

  btn.addEventListener('click', () => { setMsg(''); dlg.showModal(); render(); });
  dlg.querySelector('.close').addEventListener('click', () => dlg.close());

  add.addEventListener('click', async () => {
    add.disabled = true;
    setMsg('Follow your device prompt…', 'info');
    try {
      const { data, error } = await supabase.auth.registerPasskey();
      if (error) { setMsg(isCancel(error) ? '' : (error.message || 'Could not add passkey.')); return; }
      const label = window.prompt('Name this passkey (e.g. "MacBook Touch ID")', data?.friendly_name || '');
      if (label && label.trim() && data?.id) {
        await supabase.auth.passkey.update({ passkeyId: data.id, friendlyName: label.trim().slice(0, 120) });
      }
      setMsg('Passkey added.', 'info');
      render();
    } catch (e) {
      setMsg(isCancel(e) ? '' : (e?.message || 'Could not add passkey.'));
    } finally {
      add.disabled = false;
    }
  });
}
