import React from 'react';

// Outlay has no login of its own. With no admin session the data layer sends the browser to the
// admin login; this notice only shows for the moment before that happens (or if it is blocked).
export default function SignIn() {
  return (
    <main id="top" tabIndex={-1} className="signin tone-dark">
      <div className="signin-scrim" aria-hidden="true" />
      <div className="wrap signin-inner">
        <p className="signin-word">Outlay</p>
        <h1 className="signin-title">Sign in to the admin first</h1>
        <p className="signin-note" role="status">Taking you to the admin sign in.</p>
        <a className="btn btn-primary" href="/admin/login.html">Open admin sign in</a>
      </div>
    </main>
  );
}
