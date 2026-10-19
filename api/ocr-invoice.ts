import type { VercelRequest, VercelResponse } from "@vercel/node";
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
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
      You are an automated invoice and receipt OCR extraction engine.
      Analyze the attached photo/document of an invoice, order receipt, or store slip.
      
      Instructions:
      1. Carefully extract every individual part, item, line item, or service charge listed.
      2. For EACH part/item, extract its unit price or total item cost as a positive number (float, e.g. 45.50). Remove currency symbols (£, $, €) and commas. If a item price line is listed, parse the exact numeric value carefully.
      3. If individual line item prices are omitted on the slip, but a overall total is given, set the price for the single item to that total price amount.
      4. Extract the overall total invoice amount paid or due as a number.
      5. Identify the store/supplier name (e.g. TPS, Motor Factors, Euro Car Parts, Halfords, Screwfix, etc.).

      Strictly return a valid JSON object matching this schema:
      {
        "parts": [
          {
            "name": "string (clear part/item name or description)",
            "price": 0.00 (float number, e.g. 29.99),
            "boughtFrom": "string (supplier/store name if known, else empty string)"
          }
        ],
        "totalAmount": 0.00 (float number total),
        "supplier": "string (supplier/store name)",
        "notes": "string (brief note or invoice number if visible)"
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
      error: "Failed to read invoice details",
      details: error.message || error,
    });
  }
}
