// api/notify.mjs — "Notify Me" waitlist handler
//
// Receives a sign-up POSTed from notify.html, then sends two emails via Resend:
//   1. A branded confirmation/thank-you email to the person who signed up.
//   2. A notification email to the owner (you), so you have the list.
//
// No npm dependencies — uses the global fetch and the Resend REST API.
//
// Required env var (set in Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY   your Resend API key
// Optional env vars:
//   NOTIFY_FROM      verified sender, e.g. "Developer Of Code, LLC <notify@developerofcode.com>"
//   NOTIFY_TO        owner inbox that receives signup notifications

const FROM = process.env.NOTIFY_FROM || 'Developer Of Code, LLC <notify@developerofcode.com>';
const OWNER = process.env.NOTIFY_TO || 'DeveloperOfCodeLLC@Gmail.com';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC = 'General (no product specified)';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendEmail(apiKey, payload) {
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
  return res.json();
}

function confirmationHtml(firstName, niceProduct) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';
  const line = niceProduct === 'our products'
    ? `You're officially on the list. I'll send you a single email the moment it's ready to buy — no spam, no newsletter, just the launch.`
    : `You're officially on the list for <strong style="color:#ffffff;">${escapeHtml(niceProduct)}</strong>. I'll send you a single email the moment it's ready to buy — no spam, no newsletter, just the one launch note.`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're on the list</title></head>
<body style="margin:0;padding:0;background-color:#0a0e17;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">You're on the list — I'll email you the moment it launches.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0e17;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#161c27;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="height:4px;background-color:#ff4500;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:36px 36px 28px;">
          <p style="margin:0 0 24px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#ff6a33;font-weight:700;">Developer Of Code, LLC</p>
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#f5f5f0;font-weight:800;">You're on the list 🎉</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#c9c9d0;">${greeting}</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#c9c9d0;">${line}</p>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#c9c9d0;">Thanks for the interest — it genuinely means a lot.</p>
          <p style="margin:0 0 2px;font-size:15px;line-height:1.65;color:#f5f5f0;">— Christian Traxler</p>
          <p style="margin:0 0 28px;font-size:13px;line-height:1.6;color:#8b8b93;">Founder, Developer Of Code, LLC</p>
          <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#8b8b93;">Questions? Just reply to this email — it comes straight to me.</p>
          </div>
        </td></tr>
      </table>
      <p style="max-width:520px;margin:20px auto 0;font-size:11px;line-height:1.6;color:#6a6a72;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;text-align:center;">
        Veteran-owned web development &middot; North Carolina, USA<br>
        2019&ndash;2026 &copy; Developer Of Code, LLC. All rights reserved.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

function ownerHtml(name, email, product) {
  const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111111;">
  <h2 style="margin:0 0 12px;">New Notify-Me signup</h2>
  <table cellpadding="6" cellspacing="0" style="font-size:14px;border-collapse:collapse;">
    <tr><td style="color:#666666;">Name</td><td style="font-weight:600;">${escapeHtml(name)}</td></tr>
    <tr><td style="color:#666666;">Email</td><td style="font-weight:600;">${escapeHtml(email)}</td></tr>
    <tr><td style="color:#666666;">Product</td><td style="font-weight:600;">${escapeHtml(product)}</td></tr>
    <tr><td style="color:#666666;">When</td><td>${when}</td></tr>
  </table>
  <p style="font-size:13px;color:#666666;margin-top:16px;">Reply to this email to respond directly to ${escapeHtml(name)}.</p>
  </body></html>`;
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ success: false, message: 'Method not allowed.' }, 405);
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return json({ success: false, message: 'Email service is not configured yet.' }, 500);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ success: false, message: 'Invalid request.' }, 400);
    }

    // Spam honeypot: bots fill this hidden field. Pretend success so they don't retry.
    if (data && data.botcheck) {
      return json({ success: true });
    }

    const name = (data?.name || '').toString().trim().slice(0, 100);
    const email = (data?.email || '').toString().trim().slice(0, 150);
    let product = (data?.product || '').toString().trim().slice(0, 100) || GENERIC;

    if (!name || !EMAIL_RE.test(email)) {
      return json({ success: false, message: 'Please enter your name and a valid email.' }, 400);
    }

    const firstName = name.split(/\s+/)[0];
    const niceProduct = product === GENERIC ? 'our products' : product;
    const subjectTail = niceProduct === 'our products' ? '' : ` for ${niceProduct}`;

    // 1) Confirmation to the signer — this is the one that matters to them.
    try {
      await sendEmail(apiKey, {
        from: FROM,
        to: email,
        reply_to: OWNER,
        subject: `You're on the list${subjectTail} 🎉`,
        html: confirmationHtml(firstName, niceProduct),
      });
    } catch (err) {
      console.error('Confirmation email failed:', err);
      return json({ success: false, message: 'Something went wrong sending your confirmation. Please try again.' }, 502);
    }

    // 2) Notification to the owner — best effort; don't penalize the signer if it fails.
    try {
      await sendEmail(apiKey, {
        from: FROM,
        to: OWNER,
        reply_to: email,
        subject: `New Notify-Me signup: ${product}`,
        html: ownerHtml(name, email, product),
      });
    } catch (err) {
      console.error('Owner notification failed:', err);
    }

    return json({ success: true });
  },
};
