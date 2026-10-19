import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Camera, Sparkles, Loader2, DollarSign, Calendar, MapPin, Tag, PlusCircle, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { VanJob, PartReplacement, PhotoItem, ChecklistItem } from "../types";
import { compressImage, PHOTO_CATEGORIES, DEFAULT_CHECKLIST } from "../utils";

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: Omit<VanJob, "id" | "createdAt" | "updatedAt" | "history"> & { id?: string }) => Promise<void>;
  editingJob?: VanJob | null;
  fleet: any[];
}

export default function AddJobModal({ isOpen, onClose, onSave, editingJob, fleet }: AddJobModalProps) {
  // Main form states
  const [yard, setYard] = useState<'Armagh' | 'Banbridge'>('Armagh');
  const [dateIn, setDateIn] = useState<string>("");
  const [registrationPlate, setRegistrationPlate] = useState("");
  const [mileage, setMileage] = useState<string>("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [driver, setDriver] = useState("");
  const [status, setStatus] = useState<VanJob["status"]>("pending");
  const [repairDetails, setRepairDetails] = useState("");

  // Sub-items states
  const [parts, setParts] = useState<PartReplacement[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  // Local helper states for adding a part
  const [newPartName, setNewPartName] = useState("");
  const [newPartBoughtFrom, setNewPartBoughtFrom] = useState("");
  const [newPartPrice, setNewPartPrice] = useState("");

  // Fleet Autocomplete state
  const [matchingFleet, setMatchingFleet] = useState<any[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<'info' | 'vehicle' | 'parts' | 'checklist' | 'photos'>('info');

  // Autocomplete search hook
  useEffect(() => {
    if (!registrationPlate.trim() || !fleet) {
      setMatchingFleet([]);
      return;
    }
    const search = registrationPlate.toUpperCase().replace(/\s+/g, "");
    const matches = fleet.filter(v => 
      v.registrationPlate.toUpperCase().replace(/\s+/g, "").includes(search)
    );
    setMatchingFleet(matches.slice(0, 5));
  }, [registrationPlate, fleet]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Sync editingJob if provided
  useEffect(() => {
    if (editingJob) {
      setYard(editingJob.yard);
      setDateIn(editingJob.dateIn);
      setRegistrationPlate(editingJob.registrationPlate);
      setMileage(editingJob.mileage !== undefined && editingJob.mileage !== null ? String(editingJob.mileage) : "");
      setMake(editingJob.make);
      setModel(editingJob.model);
      setColor(editingJob.color);
      setDriver(editingJob.driver || "");
      setStatus(editingJob.status);
      setRepairDetails(editingJob.repairDetails);
      setParts(editingJob.parts);
      setPhotos(editingJob.photos);
      setChecklist(
        editingJob.checklist || 
        DEFAULT_CHECKLIST.map(item => ({
          name: item.name,
          category: item.category,
          status: 'unchecked',
          comments: ''
        }))
      );
    } else {
      // Set defaults for new entry
      setYard('Armagh');
      const todayStr = new Date().toISOString().split('T')[0];
      setDateIn(todayStr);
      setRegistrationPlate("");
      setMileage("");
      setMake("");
      setModel("");
      setColor("");
      setDriver("");
      setStatus("pending");
      setRepairDetails("");
      setParts([]);
      setPhotos([]);
      setChecklist(
        DEFAULT_CHECKLIST.map(item => ({
          name: item.name,
          category: item.category,
          status: 'unchecked',
          comments: ''
        }))
      );
    }
    setActiveTab('info');
  }, [editingJob, isOpen]);

  if (!isOpen) return null;

  // Add Part handler
  const handleAddPart = () => {
    if (!newPartName) return;
    const priceNum = parseFloat(newPartPrice) || 0;
    const newPart: PartReplacement = {
      id: Math.random().toString(36).substring(2, 9),
      name: newPartName,
      boughtFrom: newPartBoughtFrom || "Unknown Supplier",
      price: priceNum
    };
    setParts([...parts, newPart]);
    setNewPartName("");
    setNewPartBoughtFrom("");
    setNewPartPrice("");
  };

  const handleRemovePart = (id: string) => {
    setParts(parts.filter(p => p.id !== id));
  };

  // Photo Upload Handler with HEIC support inside compressImage and background cloud uploads
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, defaultCategory: PhotoItem["category"] = "other") => {
    if (!e.target.files) return;
    const fileList = Array.from(e.target.files) as File[];

    for (const file of fileList) {
      const tempId = Math.random().toString(36).substring(2, 9);
      try {
        setScanMessage(`Compressing image: ${file.name}...`);
        const { base64Data, mimeType } = await compressImage(file, 2048, 2048, defaultCategory);
        const dataUrl = `data:${mimeType};base64,${base64Data}`;
        
        const newPhoto: PhotoItem = {
          id: tempId,
          base64Data: dataUrl,
          mimeType,
          category: defaultCategory,
          uploadedAt: new Date().toISOString(),
          notes: file.name,
          isUploading: true
        };

        // Add to state instantly so mechanics see thumbnail + spinner
        setPhotos(prev => [...prev, newPhoto]);

        // Fire asynchronous background upload
        (async () => {
          try {
            const response = await fetch("/api/upload-photo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                base64Data: dataUrl,
                filename: `${defaultCategory}_${tempId}`,
                registrationPlate: registrationPlate
              })
            });

            if (!response.ok) throw new Error("Upload response not OK");
            const data = await response.json();
            
            // Swap base64 with direct hosted URL link
            setPhotos(prev => prev.map(p => p.id === tempId ? {
              ...p,
              base64Data: data.url,
              isUploading: false
            } : p));
          } catch (err) {
            console.error("Image background upload failed:", err);
            // Remove uploading state but keep preview and suffix notes
            setPhotos(prev => prev.map(p => p.id === tempId ? {
              ...p,
              isUploading: false,
              notes: `${p.notes} (Upload Error)`
            } : p));
          }
        })();

      } catch (err) {
        console.error("Failed to process file:", err);
        alert(`Failed to process file: ${(err as Error).message || "Please try another file."}`);
      }
    }
    setScanMessage("");
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos(photos.filter(p => p.id !== id));
  };

  const handlePhotoCategoryChange = (id: string, category: PhotoItem["category"]) => {
    setPhotos(photos.map(p => p.id === id ? { ...p, category } : p));
  };

  // Helper to resolve base64 data regardless of whether photo.base64Data is a data-URL or a remote HTTP URL
  const getPhotoBase64 = async (photo: PhotoItem): Promise<string> => {
    if (photo.base64Data.startsWith("data:")) {
      const parts = photo.base64Data.split(",");
      return parts[1] || parts[0];
    }
    if (photo.base64Data.startsWith("http://") || photo.base64Data.startsWith("https://")) {
      const res = await fetch(photo.base64Data);
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const parts = result.split(",");
          resolve(parts[1] || parts[0]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return photo.base64Data;
  };

  // AI Numberplate OCR Scanner
  const scanPhotoWithAI = async (photo: PhotoItem) => {
    setIsScanning(true);
    setScanMessage("Gemini AI is scanning number plate and identifying van details...");
    
    try {
      const rawBase64 = await getPhotoBase64(photo);
      
      const response = await fetch("/api/ocr-numberplate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: rawBase64,
          mimeType: photo.mimeType
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || "OCR Server request failed");
      }

      const data = await response.json();

      if (data.registrationPlate) setRegistrationPlate(data.registrationPlate);
      if (data.make) setMake(data.make);
      if (data.model) setModel(data.model);
      if (data.color) setColor(data.color);
      if (data.description && !repairDetails) {
        setRepairDetails(prev => prev ? prev + "\n" + data.description : data.description);
      }

      // Switch to Vehicle tab to show populated values
      setActiveTab('vehicle');
      alert(`AI Scan Complete!\nFound plate: ${data.registrationPlate || "None"}\nMake: ${data.make || "Unknown"}\nModel: ${data.model || "Unknown"}`);

    } catch (err: any) {
      console.error(err);
      alert("AI reading failed: " + (err.message || "Unknown error"));
    } finally {
      setIsScanning(false);
      setScanMessage("");
    }
  };

  // AI Invoice OCR Scanner
  const scanInvoiceWithAI = async (photo: PhotoItem) => {
    setIsScanning(true);
    setScanMessage("Gemini AI is scanning invoice and extracting parts...");
    
    try {
      const rawBase64 = await getPhotoBase64(photo);
      
      const response = await fetch("/api/ocr-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: rawBase64,
          mimeType: photo.mimeType
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || "OCR Server request failed");
      }

      const data = await response.json();

      // Add extracted parts to the parts list
      if (data.parts && Array.isArray(data.parts)) {
        const newParts = data.parts.map((part: any) => {
          let rawPrice = part.price;
          if (typeof rawPrice === 'string') {
            // Strip out currency symbols, commas or whitespace
            rawPrice = rawPrice.replace(/[^0-9.]/g, '');
          }
          const parsedPrice = parseFloat(rawPrice);
          return {
            id: Math.random().toString(36).substring(2, 9),
            name: (part.name || "Unknown Part").replace(/S\+F/g, "S2F"),
            price: !isNaN(parsedPrice) ? parsedPrice : 0,
            boughtFrom: part.boughtFrom || data.supplier || "Unknown Supplier"
          };
        });
        setParts(prev => [...prev, ...newParts]);
      }

      // Switch to Parts tab to show populated values
      setActiveTab('parts');
      alert(`AI Invoice Scan Complete!\nAdded ${data.parts?.length || 0} parts!\nTotal Amount: £${data.totalAmount?.toFixed(2) || "0.00"}`);

    } catch (err: any) {
      console.error(err);
      alert("AI invoice reading failed: " + (err.message || "Unknown error"));
    } finally {
      setIsScanning(false);
      setScanMessage("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationPlate.trim()) {
      alert("Please enter a Registration Plate. (Tip: Upload a front/back photo to scan with AI!)");
      setActiveTab('vehicle');
      return;
    }

    setIsSaving(true);
    try {
      // Replace S+F with S2F in part names
      const processedParts = parts.map(p => ({
        ...p,
        name: p.name.replace(/S\+F/g, "S2F")
      }));

      await onSave({
        id: editingJob?.id,
        yard,
        dateIn,
        registrationPlate: registrationPlate.toUpperCase().trim(),
        mileage: mileage ? (isNaN(Number(mileage)) ? mileage.trim() : Number(mileage)) : "",
        make: make.trim(),
        model: model.trim(),
        color: color.trim(),
        driver: driver.trim(),
        status,
        repairDetails: repairDetails.trim(),
        parts: processedParts,
        photos,
        checklist
      });
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save job record.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="modal-overlay" className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div id="modal-container" className="bg-white rounded-none shadow-none border border-slate-300 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-sans font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span>{editingJob ? "Edit Repair Report" : "Log New Yard Intake"}</span>
              {!editingJob && <span className="text-[9px] font-mono bg-blue-600 text-white font-bold uppercase tracking-widest px-2 py-0.5 rounded-none flex items-center gap-1 shadow-xs"><Sparkles className="w-3 h-3 text-amber-300" /> AI Active</span>}
            </h3>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-1 font-mono">Record repair faults, auto-fill registration plates, and catalog spent materials.</p>
          </div>
          <button 
            id="modal-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-none border border-slate-200 bg-white hover:border-blue-400 hover:text-blue-600 transition-colors text-slate-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white overflow-x-auto gap-6">
          <button
            id="tab-info"
            type="button"
            onClick={() => setActiveTab('info')}
            className={`py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 cursor-pointer whitespace-nowrap ${
              activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            1. Yard Repair Info
          </button>
          <button
            id="tab-vehicle"
            type="button"
            onClick={() => setActiveTab('vehicle')}
            className={`py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 cursor-pointer whitespace-nowrap ${
              activeTab === 'vehicle' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            2. Vehicle {registrationPlate && `(${registrationPlate.toUpperCase()})`}
          </button>
          <button
            id="tab-parts"
            type="button"
            onClick={() => setActiveTab('parts')}
            className={`py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 cursor-pointer whitespace-nowrap ${
              activeTab === 'parts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            3. Parts Replaced {parts.length > 0 && `(${parts.length})`}
          </button>
          <button
            id="tab-checklist"
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 cursor-pointer whitespace-nowrap ${
              activeTab === 'checklist' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            4. MOT Checklist {checklist.filter(c => c.status !== 'unchecked').length > 0 && `(${checklist.filter(c => c.status !== 'unchecked').length}/${checklist.length})`}
          </button>
          <button
            id="tab-photos"
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 cursor-pointer whitespace-nowrap ${
              activeTab === 'photos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            5. Attachments {photos.length > 0 && `(${photos.length})`}
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col">
          
          {/* Scanning Status Banner */}
          {isScanning && (
            <div className="mb-6 bg-blue-600 text-white rounded-none p-4 flex items-center justify-between border border-blue-500 shadow-xs">
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-blue-200 animate-spin" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider">{scanMessage}</span>
              </div>
              <span className="text-[9px] text-blue-200 uppercase tracking-widest font-black">Processing</span>
            </div>
          )}

          {/* TAB 1: Yard & Repair Info */}
          {activeTab === 'info' && (
            <div className="space-y-5 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 font-mono">Select Yard Location</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      id="opt-yard-armagh"
                      type="button"
                      onClick={() => setYard('Armagh')}
                      className={`py-3 px-4 rounded-none border font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        yard === 'Armagh' 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                      Armagh Yard
                    </button>
                    <button
                      id="opt-yard-banbridge"
                      type="button"
                      onClick={() => setYard('Banbridge')}
                      className={`py-3 px-4 rounded-none border font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        yard === 'Banbridge' 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                      Banbridge Yard
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Date Came In</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      id="input-date-in"
                      type="date"
                      value={dateIn}
                      onChange={(e) => setDateIn(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-none pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-blue-600 text-slate-900 font-sans"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Repair Status</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(['pending', 'in_progress', 'completed', 'released'] as const).map((s) => {
                    const active = status === s;
                    return (
                      <button
                        id={`opt-status-${s}`}
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={`py-2.5 px-3 rounded-none border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          active 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {s.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Detailed Repair Notes</label>
                <textarea
                  id="input-repair-details"
                  rows={6}
                  value={repairDetails}
                  onChange={(e) => setRepairDetails(e.target.value)}
                  placeholder="Describe the diagnostics, faults, and overall repairs done (e.g., Replaced alternator, front bumper touch-ups, bleed brakes)."
                  className="w-full bg-slate-50 border border-slate-200 rounded-none px-4 py-3 text-xs focus:outline-none focus:border-blue-600 text-slate-900 leading-relaxed"
                ></textarea>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-150">
                <button
                  id="btn-next-vehicle"
                  type="button"
                  onClick={() => setActiveTab('vehicle')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 border border-blue-600 text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  Next: Vehicle Details
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Vehicle Details & Plate Recognition */}
          {activeTab === 'vehicle' && (
            <div className="space-y-5 flex-1">
              <div className="bg-blue-50/20 rounded-none p-5 border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex gap-3 items-start">
                  <div className="p-3 bg-white rounded-none text-blue-600 border border-blue-200">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">AI License Plate Recognition</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-lg leading-relaxed">
                      Upload a front or back photo of the van in tab 4, then click "Scan with AI" to instantly fill in plate, make, model, and color.
                    </p>
                  </div>
                </div>
                <button
                  id="btn-nav-photos"
                  type="button"
                  onClick={() => setActiveTab('photos')}
                  className="px-4 py-2.5 bg-white hover:bg-blue-50 border border-blue-200 rounded-none text-[10px] font-bold text-blue-700 uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer font-mono"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Go to Photos Upload
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Registration Plate</label>
                  <div className="relative">
                    <input
                      id="input-reg-plate"
                      type="text"
                      value={registrationPlate}
                      onChange={(e) => setRegistrationPlate(e.target.value)}
                      required
                      placeholder="e.g. AB12 CDE"
                      className="w-full bg-slate-50 border border-slate-200 rounded-none px-4 py-3 text-xs focus:outline-none focus:border-blue-600 text-slate-900 font-mono font-bold uppercase tracking-widest"
                    />
                    
                    {matchingFleet.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 shadow-lg z-40 max-h-48 overflow-y-auto">
                        {matchingFleet.map((v) => (
                          <button
                            key={v.registrationPlate}
                            type="button"
                            onClick={() => {
                              setRegistrationPlate(v.registrationPlate);
                              setDriver(v.driver || "");
                              
                              // Parse make and model from vehicle name
                              const parts = v.vehicle.split(" ");
                              const guessedMake = parts[0];
                              const guessedModel = parts.slice(1).join(" ");
                              
                              setMake(guessedMake);
                              setModel(guessedModel);
                              setMatchingFleet([]);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-xs border-b border-slate-100 last:border-0 flex items-center justify-between cursor-pointer"
                          >
                            <div>
                              <span className="font-mono font-bold text-slate-900 mr-2">{v.registrationPlate}</span>
                              <span className="text-slate-500">
                                {v.vehicle}{v.driver ? ` - ${v.driver}` : ""}
                              </span>
                            </div>
                            {v.driver && (
                              <span className="text-[9px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-none font-sans font-bold uppercase tracking-wider">
                                Driver: {v.driver}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 font-sans">Type to search your active fleet or scan with AI.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Van Mileage (Miles)</label>
                  <input
                    id="input-mileage"
                    type="number"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    placeholder="e.g. 125400"
                    className="w-full bg-slate-50 border border-slate-200 rounded-none px-4 py-3 text-xs focus:outline-none focus:border-blue-600 text-slate-900 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5 font-sans">Optional odometer reading on intake.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Driver</label>
                  <input
                    id="input-driver"
                    type="text"
                    value={driver}
                    onChange={(e) => setDriver(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-50 border border-slate-200 rounded-none px-4 py-3 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Exterior Color</label>
                  <input
                    id="input-color"
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. White"
                    className="w-full bg-slate-50 border border-slate-200 rounded-none px-4 py-3 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Vehicle Make (Brand)</label>
                  <input
                    id="input-make"
                    type="text"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="e.g. Ford"
                    className="w-full bg-slate-50 border border-slate-200 rounded-none px-4 py-3 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Vehicle Model</label>
                  <input
                    id="input-model"
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Transit"
                    className="w-full bg-slate-50 border border-slate-200 rounded-none px-4 py-3 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-150">
                <button
                  id="btn-back-info"
                  type="button"
                  onClick={() => setActiveTab('info')}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  id="btn-next-parts"
                  type="button"
                  onClick={() => setActiveTab('parts')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  Next: Part Replacements
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Part Replacements */}
          {activeTab === 'parts' && (
            <div className="space-y-5 flex-1">
              {/* Add Part Form Block */}
              <div className="bg-slate-50/50 border border-slate-200 rounded-none p-5">
                <h4 className="font-bold text-[10px] uppercase tracking-wider text-blue-600 mb-4 flex items-center gap-2 font-mono">
                  <PlusCircle className="w-4 h-4 text-blue-500" />
                  Add a Part Replacement / Material
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Part Name</label>
                    <input
                      id="input-new-part-name"
                      type="text"
                      value={newPartName}
                      onChange={(e) => setNewPartName(e.target.value)}
                      placeholder="e.g. Starter Motor"
                      className="w-full bg-white border border-slate-200 rounded-none px-3 py-2 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Bought From</label>
                    <input
                      id="input-new-part-supplier"
                      type="text"
                      value={newPartBoughtFrom}
                      onChange={(e) => setNewPartBoughtFrom(e.target.value)}
                      placeholder="e.g. Euro Car Parts"
                      className="w-full bg-white border border-slate-200 rounded-none px-3 py-2 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                    />
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Price (£)</label>
                      <input
                        id="input-new-part-price"
                        type="number"
                        step="0.01"
                        value={newPartPrice}
                        onChange={(e) => setNewPartPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white border border-slate-200 rounded-none px-3 py-2 text-xs focus:outline-none focus:border-blue-600 text-slate-900 font-mono"
                      />
                    </div>
                    <button
                      id="btn-add-part-sub"
                      type="button"
                      onClick={handleAddPart}
                      className="px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-none transition-colors cursor-pointer shadow-xs flex items-center justify-center"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Added Parts Table */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-mono">Logged Materials / Parts list</label>
                {parts.length === 0 ? (
                  <div className="border border-slate-200 rounded-none p-8 text-center text-slate-400 text-xs">
                    No parts added to this repair file yet.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-none overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider text-[9px] font-mono">
                          <th className="p-3">Component / Part</th>
                          <th className="p-3">Supplier Bought From</th>
                          <th className="p-3 text-right">Cost</th>
                          <th className="p-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parts.map((p) => (
                          <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/30">
                            <td className="p-3 font-bold text-slate-800">{p.name}</td>
                            <td className="p-3 text-slate-500">{p.boughtFrom}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">£{p.price.toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <button
                                id={`btn-delete-part-${p.id}`}
                                type="button"
                                onClick={() => handleRemovePart(p.id)}
                                className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                title="Remove Part"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-150">
                <button
                  id="btn-back-vehicle"
                  type="button"
                  onClick={() => setActiveTab('vehicle')}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  id="btn-next-checklist"
                  type="button"
                  onClick={() => setActiveTab('checklist')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  Next: MOT Checklist
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: MOT Checklist */}
          {activeTab === 'checklist' && (
            <div className="space-y-6 flex-1">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    R001 MOT Vehicle Inspection Checklist
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 font-sans">
                    Go through the vehicle inspection items derived from the MOT Checklist. Mark each item as **Pass**, **Fail**, or leave **Unchecked**. You can append defects or comments directly.
                  </p>
                </div>
                <button
                  id="btn-checklist-pass-all"
                  type="button"
                  onClick={() => {
                    const updated = checklist.map(item => ({
                      ...item,
                      status: 'pass' as const
                    }));
                    setChecklist(updated);
                  }}
                  className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-none text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0 self-start sm:self-center"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Pass All Items
                </button>
              </div>

              {/* Grouped Checklist Grid */}
              <div className="space-y-8 max-h-[50vh] overflow-y-auto pr-2 border border-slate-100 p-2 bg-slate-50/20">
                {(['Interior', 'Exterior', 'Under Bonnet', 'Under Vehicle'] as const).map((cat) => {
                  const items = checklist.filter((item) => item.category === cat);
                  return (
                    <div key={cat} className="space-y-3">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-1.5 font-mono flex items-center justify-between">
                        <span>{cat} Checks ({items.filter(i => i.status !== 'unchecked').length}/{items.length})</span>
                        <button
                          id={`btn-pass-all-cat-${cat.replace(/\s+/g, '-').toLowerCase()}`}
                          type="button"
                          onClick={() => {
                            const updated = checklist.map(item => {
                              if (item.category === cat) {
                                return { ...item, status: 'pass' as const };
                              }
                              return item;
                            });
                            setChecklist(updated);
                          }}
                          className="px-2 py-0.5 bg-green-50 hover:bg-green-150 hover:text-green-800 text-green-700 border border-green-200 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Pass All {cat}
                        </button>
                      </h5>
                      <div className="space-y-2">
                        {items.map((item) => {
                          const globalIndex = checklist.findIndex(c => c.name === item.name);
                          return (
                            <div key={item.name} className="flex flex-col md:flex-row items-stretch md:items-center justify-between p-3 bg-white border border-slate-200 gap-3 hover:bg-slate-50/30">
                              <span className="text-xs font-bold text-slate-700 flex-1">{item.name}</span>
                              
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mt-1 sm:mt-0 flex-1 sm:flex-none">
                                {/* Pass/Fail/Unchecked Controls */}
                                <div className="flex bg-slate-100 p-0.5 border border-slate-200 w-full sm:w-auto justify-between">
                                  {(['pass', 'fail', 'unchecked'] as const).map((st) => {
                                    const active = item.status === st;
                                    let btnStyle = "text-slate-400 hover:text-slate-700";
                                    if (active) {
                                      if (st === 'pass') btnStyle = "bg-green-600 text-white font-bold";
                                      if (st === 'fail') btnStyle = "bg-red-600 text-white font-bold";
                                      if (st === 'unchecked') btnStyle = "bg-slate-400 text-white font-bold";
                                    }
                                    return (
                                      <button
                                        id={`btn-checklist-status-${globalIndex}-${st}`}
                                        key={st}
                                        type="button"
                                        onClick={() => {
                                          const updated = [...checklist];
                                          updated[globalIndex].status = st;
                                          setChecklist(updated);
                                        }}
                                        className={`flex-1 sm:flex-none px-3.5 py-2 sm:py-1 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-none ${btnStyle}`}
                                      >
                                        {st}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Comments / Defects input */}
                                <input
                                  id={`input-checklist-comments-${globalIndex}`}
                                  type="text"
                                  placeholder={item.status === 'fail' ? "Describe defect..." : "Add comments..."}
                                  value={item.comments || ""}
                                  onChange={(e) => {
                                    const updated = [...checklist];
                                    updated[globalIndex].comments = e.target.value;
                                    setChecklist(updated);
                                  }}
                                  className={`border rounded-none px-2.5 py-2 sm:py-1 text-[11px] w-full sm:w-48 focus:outline-none focus:border-blue-600 ${
                                    item.status === 'fail' ? 'border-red-300 bg-red-50/20 text-red-900' : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-150">
                <button
                  id="btn-back-parts-cl"
                  type="button"
                  onClick={() => setActiveTab('parts')}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  id="btn-next-photos-cl"
                  type="button"
                  onClick={() => setActiveTab('photos')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  Next: Photos & Invoices
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Photos, Invoices & OCR Activation */}
          {activeTab === 'photos' && (
            <div className="space-y-5 flex-1">
              {/* Photo Upload Zones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Invoice Upload Card */}
                <div className="border-2 border-dashed border-green-200 hover:border-green-400 rounded-none p-6 text-center transition-colors relative bg-green-50/5">
                  <input
                    id="input-invoice-uploader"
                    type="file"
                    multiple
                    accept="image/*,.heic,.heif,.pdf,application/pdf"
                    onChange={(e) => handlePhotoUpload(e, "invoice")}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Camera className="w-8 h-8 mx-auto text-green-550 mb-2" />
                  <h5 className="font-bold text-[11px] uppercase tracking-wider text-slate-900">Upload Invoices & Receipts</h5>
                  <p className="text-[9px] text-slate-400 mt-1 leading-relaxed uppercase font-semibold">
                    Automatically crops background margins & reads parts with AI.
                  </p>
                </div>

                {/* General Photo Upload Card */}
                <div className="border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-none p-6 text-center transition-colors relative bg-blue-50/5">
                  <input
                    id="input-photo-uploader"
                    type="file"
                    multiple
                    accept="image/*,.heic,.heif"
                    onChange={(e) => handlePhotoUpload(e, "other")}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Camera className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                  <h5 className="font-bold text-[11px] uppercase tracking-wider text-slate-900">Upload Vehicle & Work Photos</h5>
                  <p className="text-[9px] text-slate-400 mt-1 leading-relaxed uppercase font-semibold">
                    For license plates, repair steps, and inspections.
                  </p>
                </div>
              </div>

              {/* Uploaded Photos Grid */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-mono">Uploaded Gallery ({photos.length})</label>
                {photos.length === 0 ? (
                  <div className="border border-slate-200 rounded-none p-8 text-center text-slate-400 text-xs">
                    No images uploaded yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {photos.map((photo) => {
                      const isFrontOrBack = photo.category === 'front' || photo.category === 'back';
                      return (
                        <div key={photo.id} className="border border-slate-200 rounded-none overflow-hidden flex flex-col bg-white shadow-xs relative group">
                          {/* Image Container */}
                          <div className="h-44 bg-slate-50 relative overflow-hidden flex items-center justify-center">
                            <img
                              src={photo.base64Data}
                              alt="Log view"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            
                            {/* Loading / Uploading Overlay */}
                            {photo.isUploading && (
                              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2 z-10">
                                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                                <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-slate-300">Uploading...</span>
                              </div>
                            )}
                            
                            {/* Remove Button Overlay */}
                            <button
                              id={`btn-remove-photo-${photo.id}`}
                              type="button"
                              onClick={() => handleRemovePhoto(photo.id)}
                              className="absolute top-2 right-2 p-1.5 bg-slate-900/90 hover:bg-slate-900 text-white rounded-none shadow-xs transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Delete Photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* OCR Sparkle Button Overlay for Front/Back/Invoice Category */}
            {(isFrontOrBack || photo.category === 'invoice') && (
              <button
                id={`btn-ai-ocr-${photo.id}`}
                type="button"
                onClick={() => photo.category === 'invoice' ? scanInvoiceWithAI(photo) : scanPhotoWithAI(photo)}
                disabled={isScanning}
                className="absolute bottom-2 inset-x-2 py-1.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-none text-[9px] font-mono font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1 backdrop-blur-xs disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                {photo.category === 'invoice' ? 'Read Invoice with Gemini AI' : 'Read Plate with Gemini AI'}
              </button>
            )}
                          </div>

                          {/* Image Controls */}
                          <div className="p-3 border-t border-slate-100 bg-slate-50/30 flex-1 flex flex-col justify-between">
                            <div className="mb-2">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1 font-mono">Photo Category</label>
                              <select
                                id={`select-photo-cat-${photo.id}`}
                                value={photo.category}
                                onChange={(e) => handlePhotoCategoryChange(photo.id, e.target.value as any)}
                                className="w-full bg-white border border-slate-200 rounded-none py-1.5 px-2 text-[11px] focus:outline-none focus:border-blue-600 text-slate-700 font-sans"
                              >
                                {PHOTO_CATEGORIES.map((cat) => (
                                  <option key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <p className="text-[10px] text-slate-400 font-mono truncate">{photo.notes}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200">
                <button
                  id="btn-back-checklist"
                  type="button"
                  onClick={() => setActiveTab('checklist')}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Back
                </button>
                {(() => {
                  const hasPhotosUploading = photos.some(p => p.isUploading);
                  return (
                    <button
                      id="btn-save-job"
                      type="submit"
                      disabled={isSaving || hasPhotosUploading}
                      className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving Record...
                        </>
                      ) : hasPhotosUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading Photos...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          {editingJob ? "Update Repair Report" : "Save Repairs & Release Record"}
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
