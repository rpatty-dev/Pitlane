import type { VercelRequest, VercelResponse } from '@vercel/node';

async function uploadToImgBB(base64Data: string, filename: string): Promise<string | null> {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    console.error("Missing IMGBB_API_KEY env variable on Vercel");
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { base64Data, filename } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: "Missing base64Data" });
    }

    const name = filename || `upload_${Date.now()}`;
    const url = await uploadToImgBB(base64Data, name);
    
    if (!url) {
      return res.status(500).json({ error: "Image upload failed" });
    }

    return res.status(200).json({ url });
  } catch (err: any) {
    console.error("Upload handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
