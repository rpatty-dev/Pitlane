import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

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

const app = express();
const PORT = 3000;

// Increase payload limits for base64 photo transfers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// API endpoint to parse registration plate and van details using Gemini API
app.post("/api/ocr-numberplate", async (req, res) => {
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
      model: "gemini-3.5-flash",
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
    return res.json(parsedData);

  } catch (error: any) {
    console.error("Error in /api/ocr-numberplate:", error);
    return res.status(500).json({
      error: "Failed to read vehicle plate details",
      details: error.message || error,
    });
  }
});

// API endpoint to parse invoices using Gemini API
app.post("/api/ocr-invoice", async (req, res) => {
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
      You are an automated invoice analysis helper.
      Analyze the attached photo of an invoice or receipt.
      Your task is to extract:
      1. List of parts/items purchased (with name, price, and supplier if available)
      2. Total amount paid
      3. Supplier/vendor name
      4. Any notes about the invoice

      Strictly return a valid JSON object matching this schema:
      {
        "parts": [
          {
            "name": "string (part/item name)",
            "price": 0.00,
            "boughtFrom": "string (supplier/vendor name, empty if not visible)"
          }
        ],
        "totalAmount": 0.00,
        "supplier": "string (supplier/vendor name, empty if not visible)",
        "notes": "string (any additional notes about the invoice)"
      }
    `;

    const textPart = { text: promptText };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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
    return res.json(parsedData);

  } catch (error: any) {
    console.error("Error in /api/ocr-invoice:", error);
    return res.status(500).json({
      error: "Failed to read invoice details",
      details: error.message || error,
    });
  }
});

// API endpoint to detect vehicle bounding box using Gemini
app.post("/api/detect-vehicle", async (req, res) => {
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
      Identify the primary vehicle (van, car, truck) in the photo.
      Return the 2D bounding box coordinates containing ONLY the vehicle, excluding excessive ground, sky, or side background trees/walls.
      Format your output strictly as a JSON object with this schema:
      {
        "box_2d": [ymin, xmin, ymax, xmax]
      }
      where the coordinates are normalized integers in the range [0, 1000].
      If no vehicle is found, return "box_2d": null.
    `;

    const textPart = { text: promptText };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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
    return res.json(parsedData);

  } catch (error: any) {
    console.error("Error in /api/detect-vehicle:", error);
    return res.status(500).json({
      error: "Failed to detect vehicle coordinates",
      details: error.message || error,
    });
  }
});

// API endpoint to send email notifications
app.post("/api/send-email", async (req, res) => {
  try {
    const { job, user, pdfBase64 } = req.body;

    if (!job) {
      return res.status(400).json({ error: "Missing job data" });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Build email body
    const partsList = job.parts.map((p: any) => 
      `- ${p.name}: £${p.price.toFixed(2)} (${p.boughtFrom})`
    ).join("\n");

    const totalCost = job.parts.reduce((sum: number, p: any) => sum + p.price, 0).toFixed(2);

    const attachments = [];
    if (pdfBase64) {
      attachments.push({
        filename: `Repair_Report_${(job.registrationPlate || "Vehicle").replace(/\s+/g, "_")}.pdf`,
        content: pdfBase64,
        encoding: 'base64'
      });
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER,
      subject: `[FleetTrack] New Repair Logged: ${job.registrationPlate} - ${job.make} ${job.model}`,
      text: `
New job logged by ${user || "Anonymous"}:

Vehicle: ${job.make} ${job.model}
Registration: ${job.registrationPlate}
${job.driver ? `Driver: ${job.driver}` : ""}
Color: ${job.color}
Yard: ${job.yard}
Date In: ${new Date(job.dateIn).toLocaleDateString()}
Status: ${job.status}

Repair Details:
${job.repairDetails}

Parts:
${partsList}

Total Parts Cost: £${totalCost}

---
This is an automated email from Van Mechanic Logger.
      `,
      attachments: attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: %s", info.messageId);

    return res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return res.status(500).json({
      error: "Failed to send email",
      details: error.message || error,
    });
  }
});

import fs from "fs";

// Configure Z drive persistence if mounted, otherwise local workspace fallback
const NETWORK_DIR = "Z:\\Vehicles - Plant\\MechanicUploads";
const isNetworkAvailable = fs.existsSync(NETWORK_DIR);

const DB_DIR = isNetworkAvailable ? NETWORK_DIR : process.cwd();
const DB_PATH = path.join(DB_DIR, "jobs_db.json");
const PHOTOS_DIR = path.join(DB_DIR, "Photos");

// Create Photos directory if it doesn't exist
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

// Serve uploaded photos statically at /uploads
app.use("/uploads", express.static(PHOTOS_DIR));

// Helper to read jobs
function readJobs(): any[] {
  if (!fs.existsSync(DB_PATH)) {
    return [];
  }
  try {
    const data = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading jobs database:", error);
    return [];
  }
}

// Helper to write jobs
function writeJobs(jobs: any[]) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(jobs, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing jobs database:", error);
  }
}

// Incremental directory copy helper
function copyDirIncremental(src: string, dest: string) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyDirIncremental(srcPath, destPath);
    } else {
      let shouldCopy = true;
      if (fs.existsSync(destPath)) {
        const srcStat = fs.statSync(srcPath);
        const destStat = fs.statSync(destPath);
        if (srcStat.size === destStat.size) {
          shouldCopy = false;
        }
      }
      if (shouldCopy) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

// Local backup runner to copy database and photos locally
function runBackup() {
  try {
    const backupBaseDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupBaseDir)) {
      fs.mkdirSync(backupBaseDir, { recursive: true });
    }

    // 1. Backup the JSON database
    if (fs.existsSync(DB_PATH)) {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const dbBackupPath = path.join(backupBaseDir, `jobs_db_backup_${timestamp}.json`);
      fs.copyFileSync(DB_PATH, dbBackupPath);
      console.log(`[Backup] Database backed up locally to ${dbBackupPath}`);
    } else {
      console.warn(`[Backup] Database file not found at: ${DB_PATH}`);
    }

    // 2. Incremental backup of Photos
    const backupPhotosDir = path.join(backupBaseDir, "Photos");
    if (fs.existsSync(PHOTOS_DIR)) {
      if (!fs.existsSync(backupPhotosDir)) {
        fs.mkdirSync(backupPhotosDir, { recursive: true });
      }
      copyDirIncremental(PHOTOS_DIR, backupPhotosDir);
      console.log(`[Backup] Incremental photo backup to local folder completed.`);
    }

    // 3. Keep last 100 database backups to prevent infinite disk growth
    const files = fs.readdirSync(backupBaseDir)
      .filter(f => f.startsWith("jobs_db_backup_") && f.endsWith(".json"))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupBaseDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 100) {
      for (let i = 100; i < files.length; i++) {
        const fileToDelete = path.join(backupBaseDir, files[i].name);
        try {
          fs.unlinkSync(fileToDelete);
          console.log(`[Backup] Deleted old backup file: ${fileToDelete}`);
        } catch (e) {
          console.error(`[Backup] Failed to delete old backup ${fileToDelete}:`, e);
        }
      }
    }
  } catch (error) {
    console.error("[Backup] Error running backup:", error);
  }
}

// Start the 15-minute backup scheduler (15 * 60 * 1000 ms)
const BACKUP_INTERVAL = 15 * 60 * 1000;
setInterval(runBackup, BACKUP_INTERVAL);
// Trigger first backup 5 seconds after startup
setTimeout(runBackup, 5000);


// GET jobs list
app.get("/api/jobs", (req, res) => {
  try {
    const jobs = readJobs();
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST upload photo instantly
app.post("/api/upload-photo", (req, res) => {
  try {
    const { base64Data, filename, registrationPlate } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: "Missing base64Data" });
    }

    const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: "Invalid base64 format" });
    }

    const ext = matches[1];
    const base64Raw = matches[2];
    
    // Clean and validate registration plate for folder naming
    const plateFolder = (registrationPlate || "UNKNOWN").toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    const jobPhotosDir = path.join(PHOTOS_DIR, plateFolder);
    
    if (!fs.existsSync(jobPhotosDir)) {
      fs.mkdirSync(jobPhotosDir, { recursive: true });
    }

    const name = filename || `upload_${Date.now()}`;
    const fileBase = `${name}.${ext}`;
    const filePath = path.join(jobPhotosDir, fileBase);

    fs.writeFileSync(filePath, Buffer.from(base64Raw, "base64"));
    
    const localUrl = `/uploads/${plateFolder}/${fileBase}`;
    return res.status(200).json({ url: localUrl });
  } catch (error: any) {
    console.error("Local upload-photo API error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// POST save / update job
app.post("/api/jobs", (req, res) => {
  try {
    const job = req.body;
    const jobs = readJobs();
    
    // Clean and validate registration plate for folder naming
    const plateFolder = (job.registrationPlate || "UNKNOWN").toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    const jobPhotosDir = path.join(PHOTOS_DIR, plateFolder);
    
    if (!fs.existsSync(jobPhotosDir)) {
      fs.mkdirSync(jobPhotosDir, { recursive: true });
    }

    // Process and save photos to disk, replacing base64 with static paths
    if (job.photos && Array.isArray(job.photos)) {
      job.photos = job.photos.map((photo: any) => {
        if (photo.base64Data && photo.base64Data.startsWith("data:image")) {
          try {
            const matches = photo.base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const ext = matches[1];
              const base64Data = matches[2];
              const filename = `${photo.category || "other"}_${photo.id}.${ext}`;
              const filePath = path.join(jobPhotosDir, filename);
              
              fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
              
              // Return updated photo object with local static URL
              return {
                ...photo,
                base64Data: `/uploads/${plateFolder}/${filename}`
              };
            }
          } catch (err) {
            console.error("Failed to save photo to disk:", err);
          }
        }
        return photo;
      });
    }

    const now = new Date().toISOString();
    const isNew = !job.id;
    
    if (isNew) {
      job.id = "job_" + Date.now();
      job.createdAt = now;
      job.updatedAt = now;
      jobs.unshift(job);
    } else {
      job.updatedAt = now;
      const index = jobs.findIndex((j: any) => j.id === job.id);
      if (index !== -1) {
        job.createdAt = jobs[index].createdAt; // Preserve original creation timestamp
        jobs[index] = job;
      } else {
        jobs.unshift(job);
      }
    }

    writeJobs(jobs);
    res.json(job);
  } catch (error: any) {
    console.error("Error saving job:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE job
app.delete("/api/jobs/:id", (req, res) => {
  try {
    const { id } = req.params;
    let jobs = readJobs();
    jobs = jobs.filter((j: any) => j.id !== id);
    writeJobs(jobs);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting job:", error);
    res.status(500).json({ error: error.message });
  }
});

const FLEET_DB_PATH = path.join(DB_DIR, "fleet_db.json");

// Helper to read fleet database
function readFleet(): any[] {
  if (!fs.existsSync(FLEET_DB_PATH)) {
    try {
      const staticFleetPath = path.join(process.cwd(), "src", "fleet.json");
      if (fs.existsSync(staticFleetPath)) {
        const data = fs.readFileSync(staticFleetPath, "utf8");
        fs.writeFileSync(FLEET_DB_PATH, data, "utf8");
        return JSON.parse(data);
      }
    } catch (e) {
      console.error("Failed to seed fleet from fleet.json:", e);
    }
    return [];
  }
  try {
    const data = fs.readFileSync(FLEET_DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading fleet database:", error);
    return [];
  }
}

// Helper to write fleet database
function writeFleet(fleet: any[]) {
  try {
    fs.writeFileSync(FLEET_DB_PATH, JSON.stringify(fleet, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing fleet database:", error);
  }
}

// GET fleet list
app.get("/api/fleet", (req, res) => {
  try {
    const fleet = readFleet();
    res.json(fleet);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST save / update fleet vehicle
app.post("/api/fleet", (req, res) => {
  try {
    const vehicle = req.body;
    if (!vehicle.registrationPlate) {
      return res.status(400).json({ error: "Missing registrationPlate" });
    }
    const fleet = readFleet();
    
    const index = fleet.findIndex((v: any) => 
      v.registrationPlate.toUpperCase().replace(/\s+/g, '') === vehicle.registrationPlate.toUpperCase().replace(/\s+/g, '')
    );
    if (index !== -1) {
      fleet[index] = { ...fleet[index], ...vehicle };
    } else {
      fleet.unshift(vehicle);
    }
    
    writeFleet(fleet);
    res.json(vehicle);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE fleet vehicle
app.delete("/api/fleet", (req, res) => {
  try {
    const { registrationPlate } = req.body;
    if (!registrationPlate) {
      return res.status(400).json({ error: "Missing registrationPlate" });
    }
    let fleet = readFleet();
    const cleanTarget = registrationPlate.toUpperCase().replace(/\s+/g, '');
    fleet = fleet.filter((v: any) => 
      v.registrationPlate.toUpperCase().replace(/\s+/g, '') !== cleanTarget
    );
    writeFleet(fleet);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET to trigger backup manually and return status
app.get("/api/backup/trigger", (req, res) => {
  try {
    runBackup();
    res.json({ success: true, message: "Backup completed successfully" });
  } catch (error: any) {
    console.error("Manual backup trigger error:", error);
    res.status(500).json({ error: error.message });
  }
});

const MECHANICS_DB_PATH = path.join(DB_DIR, "mechanics_db.json");

// GET mechanics (returns names only)
app.get("/api/mechanics", (req, res) => {
  try {
    if (!fs.existsSync(MECHANICS_DB_PATH)) {
      return res.json([]);
    }
    const data = fs.readFileSync(MECHANICS_DB_PATH, "utf8");
    const list = JSON.parse(data || "[]");
    return res.json(list.map((m: any) => m.name).sort());
  } catch (err) {
    console.error("Error reading mechanics list:", err);
    return res.status(200).json([]);
  }
});

// POST mechanic (registers new mechanic with passcode)
app.post("/api/mechanics", (req, res) => {
  try {
    const { name, passcode } = req.body;
    if (!name || !passcode) {
      return res.status(400).json({ error: "Missing name or passcode" });
    }
    let list = [];
    if (fs.existsSync(MECHANICS_DB_PATH)) {
      const data = fs.readFileSync(MECHANICS_DB_PATH, "utf8");
      list = JSON.parse(data || "[]");
    }
    if (list.some((m: any) => m.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: "Mechanic already exists" });
    }
    list.push({ name: name.trim(), passcode: String(passcode).trim() });
    fs.writeFileSync(MECHANICS_DB_PATH, JSON.stringify(list, null, 2), "utf8");
    return res.json(list.map((m: any) => m.name).sort());
  } catch (err: any) {
    console.error("Error adding mechanic:", err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE mechanic
app.delete("/api/mechanics", (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Missing name" });
    if (!fs.existsSync(MECHANICS_DB_PATH)) {
      return res.json([]);
    }
    const data = fs.readFileSync(MECHANICS_DB_PATH, "utf8");
    let list = JSON.parse(data || "[]");
    list = list.filter((m: any) => m.name.toLowerCase() !== name.toLowerCase());
    fs.writeFileSync(MECHANICS_DB_PATH, JSON.stringify(list, null, 2), "utf8");
    return res.json(list.map((m: any) => m.name).sort());
  } catch (err: any) {
    console.error("Error deleting mechanic:", err);
    return res.status(500).json({ error: err.message });
  }
});

// PUT mechanic (verifies passcode, returns valid status, no passcodes exposed)
app.put("/api/mechanics", (req, res) => {
  try {
    const { name, passcode } = req.body || {};
    if (!name || !passcode) {
      return res.status(400).json({ error: "Missing name or passcode" });
    }

    // Admin check (hardcoded)
    if (name.toLowerCase() === "admin" && String(passcode) === "526464") {
      return res.json({ valid: true, isAdmin: true });
    }

    if (!fs.existsSync(MECHANICS_DB_PATH)) {
      return res.json({ valid: false, isAdmin: false });
    }

    const data = fs.readFileSync(MECHANICS_DB_PATH, "utf8");
    const list = JSON.parse(data || "[]");
    const mechanic = list.find((m: any) => m.name.toLowerCase() === name.toLowerCase());
    
    if (mechanic && String(mechanic.passcode) === String(passcode)) {
      return res.json({ valid: true, isAdmin: false });
    }
    return res.json({ valid: false, isAdmin: false });
  } catch (err) {
    console.error("Error verifying passcode:", err);
    return res.json({ valid: false, isAdmin: false });
  }
});


// Configure Vite integration for dev server or serve production build
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    // Import Vite dynamically to prevent loading devDependencies in production
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Persistence targets:`);
    console.log(`  - Database: ${DB_PATH}`);
    console.log(`  - Uploads:  ${PHOTOS_DIR}`);
  });
}

setupServer().catch((err) => {
  console.error("Failed to start server:", err);
});
