import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

interface Mechanic {
  name: string;
  passcode: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvAvailable = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  // GET: return list of mechanic names only (no passcodes exposed)
  if (req.method === 'GET') {
    if (!kvAvailable) return res.status(200).json([]);
    try {
      const list = await kv.get<Mechanic[]>('mechanics_list') || [];
      return res.status(200).json(list.map(m => m.name).sort());
    } catch {
      return res.status(200).json([]);
    }
  }

  // POST /api/mechanics — add mechanic { name, passcode } (admin only)
  if (req.method === 'POST') {
    if (!kvAvailable) return res.status(503).json({ error: 'Database not available' });
    try {
      const { name, passcode } = req.body;
      if (!name || !passcode) return res.status(400).json({ error: 'Missing name or passcode' });
      const list = await kv.get<Mechanic[]>('mechanics_list') || [];
      if (list.some(m => m.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ error: 'Mechanic already exists' });
      }
      list.push({ name: name.trim(), passcode: String(passcode).trim() });
      await kv.set('mechanics_list', list);
      return res.status(200).json(list.map(m => m.name).sort());
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE: remove mechanic by name
  if (req.method === 'DELETE') {
    if (!kvAvailable) return res.status(503).json({ error: 'Database not available' });
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Missing name' });
      let list = await kv.get<Mechanic[]>('mechanics_list') || [];
      list = list.filter(m => m.name.toLowerCase() !== name.toLowerCase());
      await kv.set('mechanics_list', list);
      return res.status(200).json(list.map(m => m.name).sort());
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // PUT: verify passcode — { name, passcode } → { valid, isAdmin }
  if (req.method === 'PUT') {
    const { name, passcode } = req.body || {};
    if (!name || !passcode) return res.status(400).json({ error: 'Missing name or passcode' });

    // Admin check (hardcoded)
    if (name.toLowerCase() === 'admin' && String(passcode) === '526464') {
      return res.status(200).json({ valid: true, isAdmin: true });
    }

    if (!kvAvailable) return res.status(200).json({ valid: false, isAdmin: false });

    try {
      const list = await kv.get<Mechanic[]>('mechanics_list') || [];
      const mechanic = list.find(m => m.name.toLowerCase() === name.toLowerCase());
      if (mechanic && String(mechanic.passcode) === String(passcode)) {
        return res.status(200).json({ valid: true, isAdmin: false });
      }
      return res.status(200).json({ valid: false, isAdmin: false });
    } catch {
      return res.status(200).json({ valid: false, isAdmin: false });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
