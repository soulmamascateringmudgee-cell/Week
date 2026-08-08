/**
 * POST /api/enquiry — takes the event enquiry form and emails it through.
 *
 * Needs two environment variables set in the Vercel project:
 *   RESEND_API_KEY   an API key from resend.com
 *   ENQUIRY_TO       where enquiries land (drizzleandcrunch@outlook.com.au)
 *
 * Optional:
 *   ENQUIRY_FROM     verified sender, defaults to onboarding@resend.dev
 *
 * Until RESEND_API_KEY is set this returns 503 and the front end falls back
 * to showing the phone number and email address, so nothing is silently lost.
 */

const FIELDS = [
  ['name', 'Name'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['date', 'Event date'],
  ['guests', 'Guests'],
  ['location', 'Location'],
  ['kind', 'Event type'],
  ['message', 'Notes']
];

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};

  // honeypot
  if (body.company) return res.status(200).json({ ok: true });

  const name = str(body.name);
  const phone = str(body.phone);
  const email = str(body.email);

  if (!name || !phone || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Name, phone and a valid email are required.' });
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.ENQUIRY_TO;
  if (!key || !to) {
    return res.status(503).json({ error: 'Enquiry email is not configured yet.' });
  }

  const rows = FIELDS.filter(([k]) => str(body[k]))
    .map(
      ([k, label]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#666;white-space:nowrap;vertical-align:top">${label}</td>` +
        `<td style="padding:6px 0"><strong>${esc(str(body[k]))}</strong></td></tr>`
    )
    .join('');

  const html =
    `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#242627">` +
    `<h2 style="font-size:18px;margin:0 0 14px">New event enquiry</h2>` +
    `<table style="border-collapse:collapse">${rows}</table>` +
    `<p style="margin-top:18px;color:#888;font-size:13px">Sent from drizzleandcrunch.com.au</p></div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.ENQUIRY_FROM || 'Drizzle & Crunch <onboarding@resend.dev>',
        to: [to],
        reply_to: email,
        subject: `Event enquiry — ${name}${str(body.date) ? ` — ${str(body.date)}` : ''}`,
        html
      })
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('resend failed', r.status, detail);
      return res.status(502).json({ error: 'Mail service rejected the message.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('enquiry error', err);
    return res.status(500).json({ error: 'Could not send right now.' });
  }
}

function str(v) {
  return typeof v === 'string' ? v.trim().slice(0, 2000) : v == null ? '' : String(v).slice(0, 2000);
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
