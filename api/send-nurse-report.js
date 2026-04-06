/**
 * POST /api/send-nurse-report
 *
 * Sends the nurse schedule PDF by email using Resend.
 *
 * Required env vars:
 *   RESEND_API_KEY   — your Resend API key (https://resend.com)
 *   RESEND_FROM      — verified sender address, e.g. "Eimed <reportes@eimed.com>"
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, nurseName, month, pdfBase64, filename } = req.body ?? {};

  if (!to || !nurseName || !pdfBase64) {
    return res.status(400).json({ error: 'Faltan parámetros: to, nurseName, pdfBase64' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM || 'Eimed <reportes@eimed.com>';

  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY no configurada en el servidor.' });
  }

  const safeFilename = filename || `turnos-${nurseName.replace(/\s+/g, '-')}-${month}.pdf`;

  const body = {
    from,
    to: [to],
    subject: `Calendario de Turnos — ${nurseName} — ${month}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
        <h2 style="color:#2563eb;margin-bottom:4px">Calendario de Turnos</h2>
        <p style="margin:0 0 16px;color:#555">${month}</p>
        <p>Estimada <strong>${nurseName}</strong>,</p>
        <p>Adjunto encontrará su calendario de turnos para el mes de <strong>${month}</strong>.</p>
        <p style="margin-top:24px;color:#555;font-size:13px">
          — Equipo Eimed
        </p>
      </div>
    `,
    attachments: [
      {
        filename: safeFilename,
        content: pdfBase64,
      },
    ],
  };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[send-nurse-report] Resend error:', errorText);
      return res.status(502).json({ error: `Resend: ${errorText}` });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[send-nurse-report] fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
}
