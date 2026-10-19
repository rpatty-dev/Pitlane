import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazily initialize GoogleGenAI to prevent startup crashes if key is missing
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 parameter" });
    }

    const ai = getGenAI();

    const imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: imageBase64,
      },
    };

    const promptText = `
      You are an automated number plate recognition (ANPR) and vehicle analysis helper.
      Analyze the attached photo of a van/car. 
      Your task is to identify and extract the registration number plate, the make, model, color of the vehicle, and provide a confidence rating (0.0 to 1.0) for the reading.
      Also note any visual observations (e.g., dented bumper, pristine, touch-ups needed, work details, standard van, etc.) in a short description.

      Strictly return a valid JSON object matching this schema:
      {
        "registrationPlate": "string (uppercase, formatted nicely e.g., 'AA12 ABC' or 'DA60YUR', empty if not readable)",
        "make": "string (brand/make of van e.g., 'Ford', 'Mercedes', 'Vauxhall', empty if not visible)",
        "model": "string (model e.g., 'Transit', 'Vivaro', 'Sprinter', empty if not visible)",
        "color": "string (color e.g., 'White', 'Silver', 'Blue', empty if not visible)",
        "confidence": 0.95,
        "description": "string (brief summary of any damage, state or touch up details visible)"
      }
    `;

    const textPart = { text: promptText };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Gemini returned an empty response");
    }

    const parsedData = JSON.parse(responseText);
    return res.status(200).json(parsedData);

  } catch (error: any) {
    console.error("Error in OCR function:", error);
    return res.status(500).json({
      error: "Failed to read vehicle plate details",
      details: error.message || error,
    });
  }
}
