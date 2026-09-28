// api/consult.mjs — "Book a free consultation" handler
//
// Receives a consultation request POSTed from consult.html, then sends two emails via Resend:
//   1. A notification to the owner (you) with everything the visitor filled in. Reply-To is the
//      visitor, so hitting Reply in your inbox answers them directly.
//   2. A short confirmation to the visitor so they know the request landed.
//
// No npm dependencies — uses the global fetch and the Resend REST API.
//
// Required env var (set in Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY   your Resend API key (the same one /api/notify uses)
// Optional env vars:
//   NOTIFY_FROM      verified sender, e.g. "Developer Of Code, LLC <notify@developerofcode.com>"
//   CONSULT_TO       inbox that receives consultation requests (falls back to NOTIFY_TO)

const FROM = process.env.NOTIFY_FROM || 'Developer Of Code, LLC <notify@developerofcode.com>';
const OWNER = process.env.CONSULT_TO || process.env.NOTIFY_TO || 'DeveloperOfCodeLLC@Gmail.com';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Every field the form sends, in the order it shows up in the owner email.
const FIELDS = [
  ['name', 'Name', 100],
  ['email', 'Email', 150],
  ['phone', 'Phone', 40],
  ['business', 'Business', 120],
  ['topic', 'Looking for', 80],
  ['method', 'Best way to meet', 40],
  ['times', 'Good times', 200],
  ['message', 'Details', 3000],
];

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

function ownerHtml(request) {
  // Eastern time; the zone name switches between EDT and EST with daylight saving.
  const when = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const rows = FIELDS
    .filter(([key]) => request[key])
    .map(([key, label]) => `<tr><td style="color:#666666;vertical-align:top;white-space:nowrap;">${label}</td><td style="font-weight:600;white-space:pre-wrap;">${escapeHtml(request[key])}</td></tr>`)
    .join('\n    ');
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111111;">
  <h2 style="margin:0 0 12px;">New consultation request</h2>
  <table cellpadding="6" cellspacing="0" style="font-size:14px;border-collapse:collapse;">
    ${rows}
    <tr><td style="color:#666666;">Sent</td><td>${when}</td></tr>
  </table>
  <p style="font-size:13px;color:#666666;margin-top:16px;">Reply to this email to respond directly to ${escapeHtml(request.name)}.</p>
  </body></html>`;
}

function confirmationHtml(firstName) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consultation request received</title></head>
<body style="margin:0;padding:0;background-color:#0a0e17;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Got your consultation request. I'll be in touch within one business day.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0e17;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#161c27;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="height:4px;background-color:#ff4500;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:36px 36px 28px;">
          <p style="margin:0 0 24px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#ff6a33;font-weight:700;">Developer Of Code, LLC</p>
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#f5f5f0;font-weight:800;">Your request is in</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#c9c9d0;">${greeting}</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#c9c9d0;">Thanks for reaching out about a free consultation. I read every request myself and will get back to you within one business day to set a time that works.</p>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#c9c9d0;">If anything comes to mind before then, just reply to this email.</p>
          <p style="margin:0 0 2px;font-size:15px;line-height:1.65;color:#f5f5f0;">Christian Traxler</p>
          <p style="margin:0 0 28px;font-size:13px;line-height:1.6;color:#8b8b93;">Founder, Developer Of Code, LLC</p>
          <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#8b8b93;">Prefer the phone? Call or text (828) 781-4674.</p>
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

    const consult = {};
    for (const [key, , max] of FIELDS) {
      consult[key] = (data?.[key] || '').toString().trim().slice(0, max);
    }

    if (!consult.name || !EMAIL_RE.test(consult.email)) {
      return json({ success: false, message: 'Please enter your name and a valid email.' }, 400);
    }

    // 1) Notification to the owner — this is the one that matters, so a failure is an error.
    try {
      await sendEmail(apiKey, {
        from: FROM,
        to: OWNER,
        reply_to: consult.email,
        subject: `Consultation request: ${consult.name}${consult.business ? ` (${consult.business})` : ''}`,
        html: ownerHtml(consult),
      });
    } catch (err) {
      console.error('Consultation notification failed:', err);
      return json({ success: false, message: 'Something went wrong sending your request. Please try again.' }, 502);
    }

    // 2) Confirmation to the visitor — best effort; the request already reached the owner.
    try {
      await sendEmail(apiKey, {
        from: FROM,
        to: consult.email,
        reply_to: OWNER,
        subject: 'Your free consultation request is in',
        html: confirmationHtml(consult.name.split(/\s+/)[0]),
      });
    } catch (err) {
      console.error('Consultation confirmation failed:', err);
    }

    return json({ success: true });
  },
};
