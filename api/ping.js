export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  try {
    const response = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (response.ok) {
      res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
    } else {
      res.status(500).json({ ok: false, status: response.status });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
