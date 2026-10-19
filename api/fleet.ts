import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

// Helper to seed fleet data from static JSON to Vercel KV database
async function getSeededFleet(force: boolean = false): Promise<any[]> {
  try {
    const staticFleetPath = path.join(process.cwd(), 'src', 'fleet.json');
    if (fs.existsSync(staticFleetPath)) {
      const data = fs.readFileSync(staticFleetPath, 'utf8');
      const fleet = JSON.parse(data);
      if (force) {
        await kv.set('van_fleet_data', fleet);
      } else {
        const existing = await kv.get<any[]>('van_fleet_data');
        if (!existing || existing.length === 0) {
          await kv.set('van_fleet_data', fleet);
        }
      }
      return fleet;
    }
  } catch (e) {
    console.error("Failed to seed Vercel KV fleet:", e);
  }
  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Gracefully handle local fallback or missing database credentials
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    if (req.method === 'GET') {
      try {
        const staticFleetPath = path.join(process.cwd(), 'src', 'fleet.json');
        if (fs.existsSync(staticFleetPath)) {
          return res.status(200).json(JSON.parse(fs.readFileSync(staticFleetPath, 'utf8')));
        }
      } catch {}
      return res.status(200).json([]);
    }
    return res.status(500).json({ error: "Database credentials not configured" });
  }

  // GET: Fetch fleet list
  if (req.method === 'GET') {
    try {
      const forceSeed = req.query.force_seed === 'true';
      let fleet = null;
      if (forceSeed) {
        fleet = await getSeededFleet(true);
      } else {
        fleet = await kv.get<any[]>('van_fleet_data');
        if (!fleet) {
          fleet = await getSeededFleet();
        }
      }
      return res.status(200).json(fleet);
    } catch (err: any) {
      console.error('KV GET fleet error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: Create or Update a fleet vehicle
  if (req.method === 'POST') {
    try {
      const vehicle = req.body;
      if (!vehicle.registrationPlate) {
        return res.status(400).json({ error: 'Missing registrationPlate' });
      }

      let fleet = await kv.get<any[]>('van_fleet_data');
      if (!fleet) {
        fleet = await getSeededFleet();
      }

      const index = fleet.findIndex((v: any) => 
        v.registrationPlate.toUpperCase().replace(/\s+/g, '') === vehicle.registrationPlate.toUpperCase().replace(/\s+/g, '')
      );

      if (index !== -1) {
        fleet[index] = { ...fleet[index], ...vehicle };
      } else {
        fleet.unshift(vehicle);
      }

      await kv.set('van_fleet_data', fleet);
      return res.status(200).json(vehicle);
    } catch (err: any) {
      console.error('KV POST fleet error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE: Remove a fleet vehicle
  if (req.method === 'DELETE') {
    try {
      const { registrationPlate } = req.body;
      if (!registrationPlate) {
        return res.status(400).json({ error: 'Missing registrationPlate' });
      }

      let fleet = await kv.get<any[]>('van_fleet_data');
      if (!fleet) {
        fleet = await getSeededFleet();
      }

      const cleanTarget = registrationPlate.toUpperCase().replace(/\s+/g, '');
      const initialLength = fleet.length;
      fleet = fleet.filter((v: any) => 
        v.registrationPlate.toUpperCase().replace(/\s+/g, '') !== cleanTarget
      );

      if (fleet.length === initialLength) {
        return res.status(404).json({ error: 'Vehicle not found in fleet roster' });
      }

      await kv.set('van_fleet_data', fleet);
      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error('KV DELETE fleet error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
