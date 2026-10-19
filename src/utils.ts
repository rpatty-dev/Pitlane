// @ts-ignore
import heic2any from "heic2any";
import * as pdfjsLib from "pdfjs-dist";
import { jsPDF } from "jspdf";
import { VanJob } from "./types";

// Set up pdf.js worker - use CDN version matching pdfjs-dist package
pdfjsLib.GlobalWorkerOptions.workerSrc = "//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";

/**
 * Auto-crops document/invoice photos by identifying the white bounding paper box
 * on darker backgrounds, removing unwanted margins/background.
 */
export function autoCropWhitePaper(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Helper to check if pixel is light (white paper background)
  const isLight = (r: number, g: number, b: number) => {
    return r > 175 && g > 175 && b > 175;
  };

  // 1. Scan rows from top to find minY
  let minY = 0;
  for (let y = 0; y < height; y++) {
    let lightCount = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (isLight(data[idx], data[idx + 1], data[idx + 2])) {
        lightCount++;
      }
    }
    if (lightCount / width > 0.07) {
      minY = y;
      break;
    }
  }

  // 2. Scan rows from bottom to find maxY
  let maxY = height - 1;
  for (let y = height - 1; y >= 0; y--) {
    let lightCount = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (isLight(data[idx], data[idx + 1], data[idx + 2])) {
        lightCount++;
      }
    }
    if (lightCount / width > 0.07) {
      maxY = y;
      break;
    }
  }

  // 3. Scan columns from left to find minX
  let minX = 0;
  for (let x = 0; x < width; x++) {
    let lightCount = 0;
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      if (isLight(data[idx], data[idx + 1], data[idx + 2])) {
        lightCount++;
      }
    }
    if (lightCount / height > 0.07) {
      minX = x;
      break;
    }
  }

  // 4. Scan columns from right to find maxX
  let maxX = width - 1;
  for (let x = width - 1; x >= 0; x--) {
    let lightCount = 0;
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      if (isLight(data[idx], data[idx + 1], data[idx + 2])) {
        lightCount++;
      }
    }
    if (lightCount / height > 0.07) {
      maxX = x;
      break;
    }
  }

  const cropW = maxX - minX;
  const cropH = maxY - minY;

  // Verify that the crop region is reasonable (i.e. not collapsed, and cropped some background)
  if (cropW > width * 0.3 && cropH > height * 0.3 && (minX > 2 || maxX < width - 3 || minY > 2 || maxY < height - 3)) {
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");
    if (cropCtx) {
      cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      console.log(`Document auto-cropped: bounds [${minX}, ${minY}] to [${maxX}, ${maxY}]`);
      return cropCanvas;
    }
  }
  return canvas;
}

/**
 * Auto-crops vehicle photos by running a Sobel edge-detection filter
 * and finding the bounding box containing the high-frequency vehicle details
 * (headlights, plates, contours), cropping out plain sky/driveway margins.
 */
export function autoCropVehicle(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Create an edge map using Sobel operators
  const edges = new Float32Array(width * height);
  
  for (let y = 1; y < height - 1; y += 2) { // Step by 2 for performance
    for (let x = 1; x < width - 1; x += 2) {
      const getGray = (px: number, py: number) => {
        const idx = (py * width + px) * 4;
        return (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
      };

      const val00 = getGray(x - 1, y - 1);
      const val01 = getGray(x, y - 1);
      const val02 = getGray(x + 1, y - 1);
      
      const val10 = getGray(x - 1, y);
      const val12 = getGray(x + 1, y);
      
      const val20 = getGray(x - 1, y + 1);
      const val21 = getGray(x, y + 1);
      const val22 = getGray(x + 1, y + 1);

      const hVal = (val02 + 2 * val12 + val22) - (val00 + 2 * val10 + val20);
      const vVal = (val20 + 2 * val21 + val22) - (val00 + 2 * val01 + val02);
      
      const val = Math.sqrt(hVal * hVal + vVal * vVal);
      edges[y * width + x] = val;
    }
  }

  // Calculate density rows and columns
  const rowDensity = new Float32Array(height);
  const colDensity = new Float32Array(width);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const val = edges[y * width + x];
      rowDensity[y] += val;
      colDensity[x] += val;
    }
  }

  // Find max densities
  let maxRowVal = 0;
  for (let y = 0; y < height; y++) {
    if (rowDensity[y] > maxRowVal) maxRowVal = rowDensity[y];
  }
  let maxColVal = 0;
  for (let x = 0; x < width; x++) {
    if (colDensity[x] > maxColVal) maxColVal = colDensity[x];
  }

  // Measure noise floor (outer 10% margins)
  const marginY = Math.max(5, Math.floor(height * 0.10));
  let sumTopNoise = 0;
  for (let y = 0; y < marginY; y++) sumTopNoise += rowDensity[y];
  const avgTopNoise = sumTopNoise / marginY;

  let sumBottomNoise = 0;
  for (let y = height - marginY; y < height; y++) sumBottomNoise += rowDensity[y];
  const avgBottomNoise = sumBottomNoise / marginY;

  const noiseFloorY = (avgTopNoise + avgBottomNoise) / 2;
  const rowThreshold = noiseFloorY + (maxRowVal - noiseFloorY) * 0.15; // default adaptive contrast ratio

  const marginX = Math.max(5, Math.floor(width * 0.10));
  let sumLeftNoise = 0;
  for (let x = 0; x < marginX; x++) sumLeftNoise += colDensity[x];
  const avgLeftNoise = sumLeftNoise / marginX;

  let sumRightNoise = 0;
  for (let x = width - marginX; x < width; x++) sumRightNoise += colDensity[x];
  const avgRightNoise = sumRightNoise / marginX;

  const noiseFloorX = (avgLeftNoise + avgRightNoise) / 2;
  const colThreshold = noiseFloorX + (maxColVal - noiseFloorX) * 0.15;

  let minY = 0;
  for (let y = 0; y < height; y++) {
    if (rowDensity[y] > rowThreshold) {
      minY = y;
      break;
    }
  }

  let maxY = height - 1;
  for (let y = height - 1; y >= 0; y--) {
    if (rowDensity[y] > rowThreshold) {
      maxY = y;
      break;
    }
  }

  let minX = 0;
  for (let x = 0; x < width; x++) {
    if (colDensity[x] > colThreshold) {
      minX = x;
      break;
    }
  }

  let maxX = width - 1;
  for (let x = width - 1; x >= 0; x--) {
    if (colDensity[x] > colThreshold) {
      maxX = x;
      break;
    }
  }

  // Add 5% padding so we don't cut off mirrors/bumpers
  const padX = Math.floor(width * 0.05);
  const padY = Math.floor(height * 0.05);
  minX = Math.max(0, minX - padX);
  maxX = Math.min(width - 1, maxX + padX);
  minY = Math.max(0, minY - padY);
  maxY = Math.min(height - 1, maxY + padY);

  const cropW = maxX - minX;
  const cropH = maxY - minY;

  // Only crop if the cropped box is reasonable and we cut off significant margins
  if (cropW > width * 0.4 && cropH > height * 0.4 && (minX > 10 || maxX < width - 10 || minY > 10 || maxY < height - 10)) {
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");
    if (cropCtx) {
      cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      console.log(`Vehicle auto-cropped: [${minX}, ${minY}] to [${maxX}, ${maxY}]`);
      return cropCanvas;
    }
  }

  return canvas;
}

/**
 * Compresses an image file to a higher resolution base64 string to stay under Firestore document limits (1MB)
 * and ensure fast Gemini processing. Now supports HEIC/HEIF, PDF, and automatic white paper document cropping.
 */
export async function compressImage(
  file: File, 
  maxWidth: number = 2048, 
  maxHeight: number = 2048, 
  category?: string
): Promise<{ base64Data: string; mimeType: string }> {
  console.log("Processing file:", file.name, "type:", file.type, "category:", category);
  
  // Handle PDF files first
  const isPDF = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
  if (isPDF) {
    try {
      console.log("Processing PDF file");
      const arrayBuffer = await file.arrayBuffer();
      console.log("PDF file loaded, size:", arrayBuffer.byteLength);
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log("PDF document loaded, pages:", pdf.numPages);
      
      const page = await pdf.getPage(1); // Get first page of PDF
      console.log("Page loaded");
      
      const scale = 1.5; // Scale down a bit for performance
      const viewport = page.getViewport({ scale });
      console.log("Viewport size:", viewport.width, "x", viewport.height);
      
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Failed to get canvas 2D context");
      }
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      console.log("Rendering PDF to canvas...");
      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      console.log("PDF rendered to canvas");
      
      let finalCanvas = canvas;
      if (category === "invoice") {
        finalCanvas = autoCropWhitePaper(canvas);
      }

      // Convert to compressed jpeg
      const dataUrl = finalCanvas.toDataURL("image/jpeg", 0.85);
      const base64Parts = dataUrl.split(",");
      const mimeType = base64Parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
      const base64Data = base64Parts[1];
      
      console.log("PDF conversion complete, base64 length:", base64Data.length);
      return { base64Data, mimeType };
    } catch (error) {
      console.error("PDF conversion failed with detailed error:", error);
      throw new Error(`Failed to process PDF file: ${(error as Error).message}`);
    }
  }

  let processedFile = file;
  const isHEIC = 
    file.name.toLowerCase().endsWith(".heic") || 
    file.name.toLowerCase().endsWith(".heif") || 
    file.type === "image/heic" || 
    file.type === "image/heif";

  if (isHEIC) {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.8
      });
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      processedFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
        type: "image/jpeg",
      });
    } catch (error) {
      console.error("HEIC conversion failed, trying standard fallback:", error);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(processedFile);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions keeping aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas 2D context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        (async () => {
          let finalCanvas = canvas;
          if (category === "invoice") {
            finalCanvas = autoCropWhitePaper(canvas);
          } else if (category === "front" || category === "back" || category === "work_done") {
            try {
              const tempBase64 = canvas.toDataURL("image/jpeg", 0.90).split(",")[1];
              const response = await fetch("/api/detect-vehicle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageBase64: tempBase64, mimeType: "image/jpeg" })
              });
              if (response.ok) {
                const resData = await response.json();
                if (resData.box_2d) {
                  const [ymin, xmin, ymax, xmax] = resData.box_2d;
                  let minX = Math.floor((xmin / 1000) * width);
                  let minY = Math.floor((ymin / 1000) * height);
                  let maxX = Math.floor((xmax / 1000) * width);
                  let maxY = Math.floor((ymax / 1000) * height);

                  // Add 5% padding safety margins
                  const padX = Math.floor(width * 0.05);
                  const padY = Math.floor(height * 0.05);
                  minX = Math.max(0, minX - padX);
                  maxX = Math.min(width - 1, maxX + padX);
                  minY = Math.max(0, minY - padY);
                  maxY = Math.min(height - 1, maxY + padY);

                  const cropW = maxX - minX;
                  const cropH = maxY - minY;

                  if (cropW > width * 0.2 && cropH > height * 0.2) {
                    const cropCanvas = document.createElement("canvas");
                    cropCanvas.width = cropW;
                    cropCanvas.height = cropH;
                    const cropCtx = cropCanvas.getContext("2d");
                    if (cropCtx) {
                      cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
                      finalCanvas = cropCanvas;
                      console.log("Vehicle semantically cropped using Gemini:", resData.box_2d);
                    }
                  }
                } else {
                  finalCanvas = autoCropVehicle(canvas);
                }
              } else {
                finalCanvas = autoCropVehicle(canvas);
              }
            } catch (err) {
              console.warn("Gemini semantic crop failed, falling back to Sobel edge-crop:", err);
              finalCanvas = autoCropVehicle(canvas);
            }
          }

          // Convert to compressed jpeg
          const dataUrl = finalCanvas.toDataURL("image/jpeg", 0.85);
          const base64Parts = dataUrl.split(",");
          const mimeType = base64Parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
          const base64Data = base64Parts[1];

          resolve({ base64Data, mimeType });
        })().catch(reject);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Standard categories list for job photos
 */
export const PHOTO_CATEGORIES = [
  { value: 'front', label: 'Front Photo (reads plate)' },
  { value: 'back', label: 'Back Photo (reads plate)' },
  { value: 'invoice', label: 'Invoice / Parts Photo' },
  { value: 'work_done', label: 'Work Done Photo' },
  { value: 'touch_up', label: 'Touch Up / Detailing' },
  { value: 'other', label: 'Other' }
] as const;

/**
 * Default list of vehicle inspection checklist items derived from R001 MOT Vehicle check list.xlsx
 */
export const DEFAULT_CHECKLIST = [
  // Interior checks
  { name: "Seats and seat belts", category: "Interior" },
  { name: "Warning lamps", category: "Interior" },
  { name: "Switches (position lamp, headlamp, hazards)", category: "Interior" },
  { name: "View to front, wipers and washers", category: "Interior" },
  { name: "Brake controls, servo operation", category: "Interior" },
  { name: "Steering wheel and column", category: "Interior" },
  { name: "Doors, mirrors, horn", category: "Interior" },
  { name: "Speedometer, driver controls (Class 5 only)", category: "Interior" },
  { name: "Vehicle clean", category: "Interior" },
  { name: "No rust", category: "Interior" },

  // Exterior checks
  { name: "Registration plates", category: "Exterior" },
  { name: "Lamps, registration plate lamps", category: "Exterior" },
  { name: "Indicators, hazards", category: "Exterior" },
  { name: "Headlamps & aim", category: "Exterior" },
  { name: "Stop lamps, fog lamps, reflectors", category: "Exterior" },
  { name: "Wheels, tyres", category: "Exterior" },
  { name: "Shock absorbers", category: "Exterior" },
  { name: "Mirrors, wiper blades, fuel tank cap", category: "Exterior" },
  { name: "Glazing (Class 5 only)", category: "Exterior" },
  { name: "Doors, boot lid, loading doors, bonnet", category: "Exterior" },
  { name: "Towbars", category: "Exterior" },
  { name: "No sharp edges", category: "Exterior" },
  { name: "General condition of body", category: "Exterior" },

  // Under bonnet checks
  { name: "Vehicle structure", category: "Under Bonnet" },
  { name: "Braking systems", category: "Under Bonnet" },
  { name: "Exhaust systems, fuel system", category: "Under Bonnet" },
  { name: "Speed limiter (if applicable)", category: "Under Bonnet" },
  { name: "Steering & power steering components", category: "Under Bonnet" },
  { name: "Suspension components", category: "Under Bonnet" },
  { name: "Battery fastened tight", category: "Under Bonnet" },

  // Under vehicle checks
  { name: "Steering including power steering", category: "Under Vehicle" },
  { name: "Drive shafts if applicable", category: "Under Vehicle" },
  { name: "Suspension, shock absorbers", category: "Under Vehicle" },
  { name: "Wheel bearings", category: "Under Vehicle" },
  { name: "Wheels & tyres", category: "Under Vehicle" },
  { name: "Brake systems & mechanical components", category: "Under Vehicle" },
  { name: "Exhaust system", category: "Under Vehicle" },
  { name: "Fuel system & fuel tank", category: "Under Vehicle" },
  { name: "Structure, general vehicle condition", category: "Under Vehicle" },
  { name: "Droplinks", category: "Under Vehicle" },
  { name: "Ball joints", category: "Under Vehicle" },
  { name: "Track rod ends", category: "Under Vehicle" }
] as const;

export async function generateJobPDF(job: VanJob, activeUser: string = "Mechanic"): Promise<string> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Color Palette
  const primaryColor = [15, 23, 42]; // Slate-900
  const secondaryColor = [71, 85, 105]; // Slate-600
  const lightBg = [248, 250, 252]; // Slate-50
  const borderGrey = [226, 232, 240]; // Slate-200

  // 1. Header Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("FLEETTRACK", 15, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("VEHICLE REPAIR & INSPECTION REPORT", 15, 22);

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text(`Report ID: ${job.id || "N/A"}`, 195, 15, { align: "right" });
  doc.text(`Printed: ${new Date().toLocaleString()}`, 195, 19, { align: "right" });

  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.4);
  doc.line(15, 24, 195, 24);

  let currentY = 28;

  // 2. Metadata Box
  // 2. Metadata Box (Outline only for ink efficiency)
  doc.rect(15, currentY, 180, 16, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text("YARD LOCATION", 18, currentY + 5);
  doc.text("DATE LOGGED", 63, currentY + 5);
  doc.text("CURRENT STATUS", 108, currentY + 5);
  doc.text("LOGGED BY", 153, currentY + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`${job.yard} Yard`, 18, currentY + 11);
  doc.text(new Date(job.dateIn).toLocaleDateString(), 63, currentY + 11);
  doc.text(job.status.replace('_', ' ').toUpperCase(), 108, currentY + 11);
  
  const loggedBy = job.history && job.history.length > 0 ? job.history[0].user : activeUser;
  doc.text(loggedBy, 153, currentY + 11);

  currentY += 21;

  // 3. Vehicle Details & Registration Plate Row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text("VEHICLE DETAILS", 18, currentY + 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`${job.make} ${job.model} ${job.color ? `(${job.color})` : ""}`, 18, currentY + 7);

  // Fallback to find driver name from fleetData if not saved in job
  const getDriverName = () => {
    if (job.driver) return job.driver;
    return "";
  };
  const driverName = getDriverName();

  if (driverName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`Driver: ${driverName}`, 18, currentY + 11);
  }

  // Draw license plate outline box (ink efficient)
  doc.setDrawColor(15, 23, 42); // Black/Slate
  doc.setLineWidth(0.6);
  doc.rect(145, currentY, 50, 12, "D");

  // License plate text
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(job.registrationPlate || "NO REG", 170, currentY + 7.5, { align: "center" });

  if (job.mileage !== undefined && job.mileage !== null && job.mileage !== "") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    const mileageStr = typeof job.mileage === 'number' ? job.mileage.toLocaleString() : job.mileage;
    doc.text(`Mileage: ${mileageStr} miles`, 195, currentY + 16, { align: "right" });
  }

  // Reset text color & font
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.2);

  currentY += 17;

  // Draw tiny divider line
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.line(15, currentY, 195, currentY);

  currentY += 4;

  // 4. Repair Description (Outline only)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("REPAIR DESCRIPTION & WORK PERFORMED", 15, currentY);

  currentY += 3;
  const descriptionText = job.repairDetails || "No detailed repair log was documented.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  
  const splitDescription = doc.splitTextToSize(descriptionText, 172);
  const descHeight = Math.max(12, splitDescription.length * 4.5 + 4);
  
  doc.rect(15, currentY, 180, descHeight, "D"); // border outline only
  doc.text(splitDescription, 19, currentY + 4.5);

  currentY += descHeight + 5;

  // 5. Parts Table (Outlines only)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("PARTS REPLACED & SPEND TRACKING", 15, currentY);

  currentY += 3;
  
  if (job.parts.length === 0) {
    doc.rect(15, currentY, 180, 8, "D");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("No part replacements were documented for this record.", 19, currentY + 5);
    currentY += 12;
  } else {
    // Table Header (Outline only)
    doc.rect(15, currentY, 180, 6, "D");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("PART NAME / COMPONENT", 18, currentY + 4);
    doc.text("SUPPLIER", 95, currentY + 4);
    doc.text("PRICE", 192, currentY + 4, { align: "right" });

    let tableY = currentY + 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    job.parts.forEach(part => {
      doc.rect(15, tableY, 180, 6.5, "D");
      
      doc.setFont("helvetica", "bold");
      doc.text(part.name, 18, tableY + 4.5);
      
      doc.setFont("helvetica", "normal");
      doc.text(part.boughtFrom || "-", 95, tableY + 4.5);
      
      doc.setFont("helvetica", "bold");
      doc.text(`£${part.price.toFixed(2)}`, 192, tableY + 4.5, { align: "right" });
      
      tableY += 6.5;
    });

    // Draw total row (Outline only)
    doc.rect(15, tableY, 180, 7.5, "D");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("TOTAL PARTS COST:", 120, tableY + 5);
    
    const totalPartsCost = job.parts.reduce((sum, p) => sum + p.price, 0);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.text(`£${totalPartsCost.toFixed(2)}`, 192, tableY + 5.2, { align: "right" });

    currentY = tableY + 12;
  }  // 6. MOT Checklist Summary Section
  const checklist = job.checklist || [];
  if (checklist.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("MOT CHECKLIST VERIFICATION SUMMARY", 15, currentY);

    currentY += 3;
    const checkedCount = checklist.filter(i => i.status !== 'unchecked').length;
    const passedCount = checklist.filter(i => i.status === 'pass').length;
    const failedItems = checklist.filter(i => i.status === 'fail');

    let checklistBoxHeight = 12;
    if (failedItems.length > 0) {
      checklistBoxHeight += 4 + Math.ceil(failedItems.length / 2) * 4.5;
    }

    doc.rect(15, currentY, 180, checklistBoxHeight, "D");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`Inspection Status: ${checkedCount} of ${checklist.length} items checked`, 18, currentY + 5);
    doc.text(`Pass Rate: ${passedCount} Passed, ${failedItems.length} Failed`, 100, currentY + 5);

    if (failedItems.length > 0) {
      doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
      doc.line(18, currentY + 8, 192, currentY + 8);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(185, 28, 28); // Red-700
      doc.text("CRITICAL FAILURES DETECTED:", 18, currentY + 12);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      failedItems.forEach((item, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const xPos = col === 0 ? 18 : 100;
        const yPos = currentY + 16.5 + row * 4.5;
        doc.text(`• ${item.name} ${item.comments ? `(${item.comments})` : ""}`, xPos, yPos);
      });
    } else {
      doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
      doc.line(18, currentY + 8, 192, currentY + 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(4, 120, 87); // Green-700
      doc.text("✓ All inspected items passed verification. No steering, suspension, or braking defects reported.", 18, currentY + 12);
    }

    currentY += checklistBoxHeight + 5;
  }

  // 7. Photos Section - Side-by-side layout
  const invoicePhotos = job.photos.filter(p => p.category === 'invoice');
  const otherPhotos = job.photos.filter(p => p.category !== 'invoice');
  
  if (job.photos.length > 0) {
    // Check if we will overflow the page height. Left side-by-side takes 118mm height.
    if (currentY + 118 > 275) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("PHOTOS & ATTACHMENTS", 15, currentY);
    currentY += 3;

    // LEFT Column: Invoice (Max size)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("INVOICES & PARTS RECEIPTS (UNFILTERED / CONTAINED)", 15, currentY + 2);

    if (invoicePhotos.length > 0) {
      const photo = invoicePhotos[0];
      try {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY + 4, 100, 110, "F");
        doc.rect(15, currentY + 4, 100, 110, "D");
        // Render full image scaled down inside container
        doc.addImage(photo.base64Data, "JPEG", 16.5, currentY + 5.5, 97, 107);
      } catch (err) {
        console.warn("Failed to render invoice image in PDF:", err);
      }
    } else {
      doc.setFillColor(250, 250, 250);
      doc.rect(15, currentY + 4, 100, 110, "F");
      doc.rect(15, currentY + 4, 100, 110, "D");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(160);
      doc.text("No invoice receipt uploaded", 45, currentY + 55);
    }

    // RIGHT Column: Vehicle & Work Photos
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("VEHICLE & WORK PHOTOS", 125, currentY + 2);

    let yPos = currentY + 4;
    otherPhotos.slice(0, 4).forEach(photo => {
      try {
        doc.setFillColor(248, 250, 252);
        doc.rect(125, yPos, 55, 24, "F");
        doc.rect(125, yPos, 55, 24, "D");
        doc.addImage(photo.base64Data, "JPEG", 126.5, yPos + 1.5, 52, 21);
      } catch (err) {
        console.warn("Failed to render photo in PDF:", err);
      }
      yPos += 28;
    });

    currentY += 118;
  }

  // 8. Sign-off Section - Locked to the bottom of the page (y = 258)
  if (currentY > 255) {
    doc.addPage();
  }
  currentY = 258;

  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.setLineWidth(0.3);
  doc.line(15, currentY, 195, currentY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("MECHANIC SIGN-OFF:", 15, currentY + 5);
  doc.text("MANAGER / DRIVER SIGN-OFF:", 110, currentY + 5);

  doc.setDrawColor(180);
  doc.line(15, currentY + 14, 85, currentY + 14);
  doc.line(110, currentY + 14, 180, currentY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text("Signed", 15, currentY + 17);
  doc.text("Date", 70, currentY + 17);
  doc.text("Signed", 110, currentY + 17);
  doc.text("Date", 165, currentY + 17);

  // Return base64 string
  const pdfOutput = doc.output("datauristring");
  const base64Only = pdfOutput.split(",")[1];
  return base64Only;
}
