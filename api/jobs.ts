import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// Helper to upload image to ImgBB (Free API Key)
async function uploadToImgBB(base64Data: string, filename: string): Promise<string | null> {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    console.warn("Missing IMGBB_API_KEY environment variable. Skipping cloud upload.");
    return null;
  }

  try {
    const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    const base64Raw = matches ? matches[2] : base64Data;

    const formData = new FormData();
    formData.append('image', base64Raw);
    formData.append('name', filename);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`ImgBB upload failed (${response.status}):`, errText);
      throw new Error(`ImgBB upload failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.data && data.data.url) {
      return data.data.url;
    }
    console.error("ImgBB upload returned error:", data);
    return null;
  } catch (error) {
    console.error("ImgBB upload error:", error);
    return null;
  }
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

  // Gracefully fallback if KV is not yet linked
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.warn("Vercel KV environment variables missing. Returning 500 so client uses local storage fallback.");
    if (req.method === 'GET') return res.status(200).json([]);
    return res.status(500).json({ error: "Database not configured yet" });
  }

  // GET: Fetch jobs list (or deleted list if ?deleted=true)
  if (req.method === 'GET') {
    try {
      const showDeleted = req.query?.deleted === 'true';
      const key = showDeleted ? 'van_jobs_deleted' : 'van_jobs_list';
      const jobs = await kv.get<any[]>(key) || [];
      jobs.sort((a, b) => new Date(b.dateIn || b.deletedAt || b.updatedAt || 0).getTime() - new Date(a.dateIn || a.deletedAt || a.updatedAt || 0).getTime());
      return res.status(200).json(jobs);
    } catch (err: any) {
      console.error('KV GET error:', err);
      return res.status(200).json([]);
    }
  }

  // POST: Create or Update job
  if (req.method === 'POST') {
    try {
      const job = req.body;
      
      // If photos contain base64, attempt to upload to ImgBB (failure is non-fatal)
      if (job.photos && Array.isArray(job.photos)) {
        job.photos = await Promise.all(job.photos.map(async (photo: any) => {
          if (photo.base64Data && photo.base64Data.startsWith("data:image")) {
            try {
              const imgUrl = await uploadToImgBB(photo.base64Data, `${photo.category || 'other'}_${photo.id}`);
              if (imgUrl) {
                return { ...photo, base64Data: imgUrl, isUploading: false };
              }
            } catch (uploadErr) {
              console.warn("ImgBB upload failed for photo, keeping base64:", uploadErr);
            }
          }
          return { ...photo, isUploading: false };
        }));
      }

      const now = new Date().toISOString();
      const isNew = !job.id || job.id.startsWith("local_");
      const { action, ...jobData } = job;

      // Soft delete action — move to deleted bin
      if (action === 'delete') {
        const { id: delId, deletedBy, deletedAt: dAt } = jobData as any;
        if (!delId) return res.status(400).json({ error: 'Missing id' });
        const activeJobs = await kv.get<any[]>('van_jobs_list') || [];
        const jobToDelete = activeJobs.find(j => j.id === delId);
        if (!jobToDelete) return res.status(404).json({ error: 'Job not found' });
        const remainingJobs = activeJobs.filter(j => j.id !== delId);
        const deletedJobs = await kv.get<any[]>('van_jobs_deleted') || [];
        deletedJobs.push({
          ...jobToDelete,
          deletedAt: dAt || new Date().toISOString(),
          deletedBy: deletedBy || 'Unknown',
          history: [...(jobToDelete.history || []), {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: dAt || new Date().toISOString(),
            action: 'Record Deleted',
            user: deletedBy || 'Unknown',
            details: 'Moved to deleted records archive'
          }]
        });
        await kv.set('van_jobs_list', remainingJobs);
        await kv.set('van_jobs_deleted', deletedJobs);
        return res.status(200).json({ success: true });
      }

      // Restore action — move from deleted bin back to active
      if (action === 'restore') {
        const { id: restoreId, restoredBy } = jobData as any;
        if (!restoreId) return res.status(400).json({ error: 'Missing id' });
        const deletedJobs = await kv.get<any[]>('van_jobs_deleted') || [];
        const jobToRestore = deletedJobs.find(j => j.id === restoreId);
        if (!jobToRestore) return res.status(404).json({ error: 'Deleted job not found' });
        const remainingDeleted = deletedJobs.filter(j => j.id !== restoreId);
        const activeJobs = await kv.get<any[]>('van_jobs_list') || [];
        const restoredJob = {
          ...jobToRestore,
          deletedAt: undefined,
          deletedBy: undefined,
          updatedAt: new Date().toISOString(),
          history: [...(jobToRestore.history || []), {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            action: 'Record Restored',
            user: restoredBy || 'Unknown',
            details: 'Restored from deleted records archive'
          }]
        };
        activeJobs.push(restoredJob);
        await kv.set('van_jobs_deleted', remainingDeleted);
        await kv.set('van_jobs_list', activeJobs);
        return res.status(200).json(restoredJob);
      }

      // Permanent delete action (admin only)
      if (action === 'permanent_delete') {
        const { id: permId } = jobData as any;
        if (!permId) return res.status(400).json({ error: 'Missing id' });
        const deletedJobs = await kv.get<any[]>('van_jobs_deleted') || [];
        const remaining = deletedJobs.filter(j => j.id !== permId);
        await kv.set('van_jobs_deleted', remaining);
        return res.status(200).json({ success: true });
      }

      // Normal create/update
      const saveData = jobData;
      
      const newId = isNew ? Math.random().toString(36).substring(2, 12) : saveData.id || Math.random().toString(36).substring(2, 12);
      
      const finalJob = {
        id: newId,
        ...saveData,
        createdAt: isNew ? now : (saveData.createdAt || now),
        updatedAt: now
      };

      // Retrieve existing, update, save back
      const jobs = await kv.get<any[]>('van_jobs_list') || [];
      const existingIndex = jobs.findIndex(j => j.id === newId);
      
      if (existingIndex >= 0) {
        jobs[existingIndex] = finalJob;
      } else {
        jobs.push(finalJob);
      }
      
      await kv.set('van_jobs_list', jobs);
      return res.status(200).json(finalJob);
    } catch (err: any) {
      console.error("KV POST error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE: legacy hard delete (soft delete now done via POST action)
  if (req.method === 'DELETE') {
    try {
      const urlParts = req.url?.split('/') || [];
      const id = urlParts[urlParts.length - 1]?.split('?')[0];
      if (!id || id === 'jobs') {
        return res.status(400).json({ error: 'Missing job ID' });
      }
      const jobs = await kv.get<any[]>('van_jobs_list') || [];
      const updatedJobs = jobs.filter(j => j.id !== id);
      await kv.set('van_jobs_list', updatedJobs);
      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error('KV DELETE error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
