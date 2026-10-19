import { useState, useEffect } from "react";
import { VanJob, HistoryItem } from "./types";
import StatsOverview from "./components/StatsOverview";
import fleetData from "./fleet.json";
import { generateJobPDF } from "./utils";
import JobCard from "./components/JobCard";
import AddJobModal from "./components/AddJobModal";
import JobDetailView from "./components/JobDetailView";
import LoginScreen from "./components/LoginScreen";
import AdminPanelModal from "./components/AdminPanelModal";
import { 
  Wrench, 
  Plus, 
  Search, 
  MapPin, 
  Tag, 
  ChevronRight, 
  Info,
  Layers, 
  FilterX, 
  CheckSquare, 
  AlertCircle,
  LogOut,
  Shield,
  UserCheck
} from "lucide-react";

export default function App() {
  const [jobs, setJobs] = useState<VanJob[]>([]);
  const [deletedJobs, setDeletedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useLocalFallback, setUseLocalFallback] = useState(false);
  const [showDeletedPanel, setShowDeletedPanel] = useState(false);

  // Auth states
  const [loggedInUser, setLoggedInUser] = useState<string | null>(() => {
    return localStorage.getItem("vanlog_user") || null;
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem("vanlog_admin") === "true";
  });
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // Filter & Search states
  const [searchText, setSearchText] = useState("");
  const [selectedYard, setSelectedYard] = useState<"All" | "Armagh" | "Banbridge">("All");
  const [selectedStatus, setSelectedStatus] = useState<"All" | "pending" | "in_progress" | "completed" | "released">("All");

  // Selected details state
  const [selectedJob, setSelectedJob] = useState<VanJob | null>(null);

  // Modal creation/edit states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<VanJob | null>(null);

  // Fleet Roster states
  const [fleet, setFleet] = useState<any[]>([]);

  const fetchFleet = async () => {
    try {
      const response = await fetch("/api/fleet");
      if (!response.ok) throw new Error("Server error");
      const data = await response.json();
      setFleet(data);
    } catch (err) {
      console.warn("Failed to fetch fleet list, using static fallback:", err);
      setFleet(fleetData);
    }
  };

  // Active mechanic name used for automatic auditing
  const activeUser = loggedInUser || "Anonymous Mechanic";

  // Load from local storage helper
  const loadLocalJobs = () => {
    const local = localStorage.getItem("van_jobs");
    if (local) {
      try {
        const parsed = JSON.parse(local);
        setJobs(parsed);
        return parsed;
      } catch (e) {
        console.error("Failed to parse local jobs", e);
      }
    }
    setJobs([]);
    return [];
  };

  // API loader for jobs
  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/jobs");
      if (!response.ok) throw new Error("Server error");
      const data = await response.json();
      setJobs(data);
      setUseLocalFallback(false);
      setError(null);
    } catch (err) {
      console.warn("API load failed, trying local storage fallback:", err);
      setUseLocalFallback(true);
      loadLocalJobs();
    } finally {
      setLoading(false);
    }
  };

  const fetchDeletedJobs = async () => {
    try {
      const response = await fetch("/api/jobs?deleted=true");
      if (!response.ok) return;
      const data = await response.json();
      setDeletedJobs(data);
    } catch {}
  };

  // Firestore real-time listener or local database poller
  useEffect(() => {
    if (!loggedInUser) return;
    setLoading(true);
    fetchJobs();
    fetchFleet();

    // Poll the API server every 5 seconds to keep dashboard up to date
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [loggedInUser]);

  const handleLogin = (userName: string, adminStatus: boolean) => {
    setLoggedInUser(userName);
    setIsAdmin(adminStatus);
    localStorage.setItem("vanlog_user", userName);
    localStorage.setItem("vanlog_admin", adminStatus ? "true" : "false");
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setIsAdmin(false);
    localStorage.removeItem("vanlog_user");
    localStorage.removeItem("vanlog_admin");
    setSelectedJob(null);
  };

  // Local storage save handler helper
  const saveLocalJob = (formData: Omit<VanJob, "id" | "createdAt" | "updatedAt" | "history"> & { id?: string }): VanJob => {
    const now = new Date().toISOString();
    const isNew = !formData.id;
    // Replace S+F with S2F in part names
    const processedParts = formData.parts.map(p => ({
      ...p,
      name: p.name.replace(/S\+F/g, "S2F")
    }));
    const { id, ...saveData } = formData;
    let updatedList = [...jobs];
    let savedJob: VanJob;

    if (isNew) {
      const initialHistory: HistoryItem[] = [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: now,
          action: "Yard Log Created",
          user: activeUser,
          details: `Initially logged into ${formData.yard} Yard with status '${formData.status}' (Offline Fallback)`,
        }
      ];

      if (processedParts.length > 0) {
        initialHistory.push({
          id: Math.random().toString(36).substring(2, 9),
          timestamp: now,
          action: "Parts Logged on Entry",
          user: activeUser,
          details: `Logged ${processedParts.length} parts with total cost £${processedParts.reduce((s, p) => s + p.price, 0).toFixed(2)}`,
        });
      }

      savedJob = {
        ...saveData,
        parts: processedParts,
        id: "local_" + Date.now(),
        createdAt: now,
        updatedAt: now,
        history: initialHistory
      } as any;
      updatedList = [savedJob, ...updatedList];
    } else {
      const existing = jobs.find(j => j.id === id);
      const historyUpdates: HistoryItem[] = [...(existing?.history || [])];

      if (existing) {
        if (existing.status !== formData.status) {
          historyUpdates.push({
            id: Math.random().toString(36).substring(2, 9),
            timestamp: now,
            action: `Status changed from ${existing.status} to ${formData.status}`,
            user: activeUser,
            details: `Yard operations status updated`
          });
        }

        if (existing.yard !== formData.yard) {
          historyUpdates.push({
            id: Math.random().toString(36).substring(2, 9),
            timestamp: now,
            action: `Yard relocated to ${formData.yard}`,
            user: activeUser,
            details: `Relocated from ${existing.yard}`
          });
        }

        if (existing.parts.length !== processedParts.length) {
          const addedParts = processedParts.filter(p => !existing.parts.some(ep => ep.id === p.id));
          if (addedParts.length > 0) {
            historyUpdates.push({
              id: Math.random().toString(36).substring(2, 9),
              timestamp: now,
              action: `${addedParts.length} Parts replaced`,
              user: activeUser,
              details: addedParts.map(ap => `${ap.name} (£${ap.price})`).join(", ")
            });
          }
        }

        historyUpdates.push({
          id: Math.random().toString(36).substring(2, 9),
          timestamp: now,
          action: "Record Details Updated",
          user: activeUser,
          details: "Standard revision on details/photos"
        });
      }

      savedJob = {
        ...saveData,
        parts: processedParts,
        id: id!,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        history: historyUpdates
      } as any;

      updatedList = updatedList.map(j => j.id === id ? savedJob : j);
      if (selectedJob && selectedJob.id === id) {
        setSelectedJob(savedJob);
      }
    }

    setJobs(updatedList);
    localStorage.setItem("van_jobs", JSON.stringify(updatedList));
    return savedJob;
  };

  // Create or Update record (falls back to local storage if offline/missing DB)
  const handleSaveJob = async (formData: Omit<VanJob, "id" | "createdAt" | "updatedAt" | "history"> & { id?: string }) => {
    // Always replace S+F with S2F in part names
    const processedParts = formData.parts.map(p => ({
      ...p,
      name: p.name.replace(/S\+F/g, "S2F")
    }));
    const processedFormData = { ...formData, parts: processedParts };

    if (useLocalFallback) {
      const savedJob = saveLocalJob(processedFormData);
      
      // Generate PDF on client using the local base64 photo data
      let pdfBase64 = null;
      try {
        pdfBase64 = await generateJobPDF(savedJob, activeUser);
      } catch (pdfErr) {
        console.error("Failed to generate PDF for attachment:", pdfErr);
      }

      // Try to send email even with local fallback
      try {
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job: savedJob,
            user: activeUser,
            pdfBase64: pdfBase64
          })
        });
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
      }
      return;
    }

    try {
      const now = new Date().toISOString();
      const isNew = !formData.id;
      
      let historyUpdates: HistoryItem[] = [];
      if (isNew) {
        historyUpdates = [
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: now,
            action: "Yard Log Created",
            user: activeUser,
            details: `Initially logged into ${processedFormData.yard} Yard with status '${processedFormData.status}'`,
          }
        ];

        if (processedParts.length > 0) {
          historyUpdates.push({
            id: Math.random().toString(36).substring(2, 9),
            timestamp: now,
            action: "Parts Logged on Entry",
            user: activeUser,
            details: `Logged ${processedParts.length} parts with total cost £${processedParts.reduce((s, p) => s + p.price, 0).toFixed(2)}`,
          });
        }
      } else {
        const existing = jobs.find(j => j.id === formData.id);
        historyUpdates = [...(existing?.history || [])];

        if (existing) {
          if (existing.status !== processedFormData.status) {
            historyUpdates.push({
              id: Math.random().toString(36).substring(2, 9),
              timestamp: now,
              action: `Status changed from ${existing.status} to ${processedFormData.status}`,
              user: activeUser,
              details: `Yard operations status updated`
            });
          }

          if (existing.yard !== processedFormData.yard) {
            historyUpdates.push({
              id: Math.random().toString(36).substring(2, 9),
              timestamp: now,
              action: `Yard relocated to ${processedFormData.yard}`,
              user: activeUser,
              details: `Relocated from ${existing.yard}`
            });
          }

          if (existing.parts.length !== processedParts.length) {
            const addedParts = processedParts.filter(p => !existing.parts.some(ep => ep.id === p.id));
            if (addedParts.length > 0) {
              historyUpdates.push({
                id: Math.random().toString(36).substring(2, 9),
                timestamp: now,
                action: `${addedParts.length} Parts replaced`,
                user: activeUser,
                details: addedParts.map(ap => `${ap.name} (£${ap.price})`).join(", ")
              });
            }
          }

          historyUpdates.push({
            id: Math.random().toString(36).substring(2, 9),
            timestamp: now,
            action: "Record Details Updated",
            user: activeUser,
            details: "Standard revision on details/photos"
          });
        }
      }

      const payload = {
        ...processedFormData,
        history: historyUpdates
      };

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Save API failed");
      const savedJob = await response.json();

      // Send email if it's a new job
      if (isNew) {
        // Generate PDF on client using the local base64 photo data
        let pdfBase64 = null;
        try {
          pdfBase64 = await generateJobPDF({ ...processedFormData, id: savedJob.id } as any, activeUser);
        } catch (pdfErr) {
          console.error("Failed to generate PDF for attachment:", pdfErr);
        }

        try {
          await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              job: savedJob,
              user: activeUser,
              pdfBase64: pdfBase64
            })
          });
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
          // Don't block the main flow if email fails
        }
      }

      if (isNew) {
        setJobs(prev => [savedJob, ...prev]);
      } else {
        setJobs(prev => prev.map(j => j.id === savedJob.id ? savedJob : j));
        if (selectedJob && selectedJob.id === savedJob.id) {
          setSelectedJob(savedJob);
        }
      }
    } catch (err) {
      console.error("Save API failed, falling back to local storage:", err);
      const savedJob = saveLocalJob(processedFormData);
      if (!formData.id) {
        // Generate PDF on client using the local base64 photo data
        let pdfBase64 = null;
        try {
          pdfBase64 = await generateJobPDF(savedJob, activeUser);
        } catch (pdfErr) {
          console.error("Failed to generate PDF for attachment:", pdfErr);
        }

        try {
          await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              job: savedJob,
              user: activeUser,
              pdfBase64: pdfBase64
            })
          });
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
        }
      }
    }
  };

  // Delete Job handler — soft delete (moves to deleted bin, never hard deletes)
  const handleDeleteJob = async (id: string) => {
    if (!confirm("Move this record to the deleted archive? Admin can restore it later.")) return;

    const now = new Date().toISOString();

    if (useLocalFallback || id.startsWith("local_")) {
      // Local fallback: just remove from view (no true archive in local mode)
      const updatedList = jobs.filter(j => j.id !== id);
      setJobs(updatedList);
      localStorage.setItem("van_jobs", JSON.stringify(updatedList));
      setSelectedJob(null);
      return;
    }

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id, deletedBy: activeUser, deletedAt: now })
      });
      if (!response.ok) throw new Error("Soft delete failed");
      setJobs(prev => prev.filter(j => j.id !== id));
      setSelectedJob(null);
    } catch (err) {
      console.error("Delete API failed:", err);
      alert("Failed to delete record. Please try again.");
    }
  };

  // Restore deleted job (admin only)
  const handleRestoreJob = async (id: string) => {
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", id, restoredBy: activeUser })
      });
      if (!response.ok) throw new Error("Restore failed");
      const restoredJob = await response.json();
      setDeletedJobs(prev => prev.filter(j => j.id !== id));
      setJobs(prev => [restoredJob, ...prev]);
    } catch (err) {
      console.error("Restore failed:", err);
      alert("Failed to restore record.");
    }
  };

  // Permanently delete (admin only)
  const handlePermanentDelete = async (id: string) => {
    if (!confirm("PERMANENTLY delete this record? This CANNOT be undone.")) return;
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "permanent_delete", id })
      });
      if (!response.ok) throw new Error("Permanent delete failed");
      setDeletedJobs(prev => prev.filter(j => j.id !== id));
    } catch (err) {
      console.error("Permanent delete failed:", err);
      alert("Failed to permanently delete record.");
    }
  };

  // Update Status directly from details page
  const handleStatusChange = async (id: string, newStatus: VanJob["status"]) => {
    const existing = jobs.find(j => j.id === id);
    if (!existing) return;

    const now = new Date().toISOString();
    const updatedHistory: HistoryItem[] = [
      ...(existing.history || []),
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: now,
        action: `Status set to ${newStatus.replace('_', ' ')}`,
        user: activeUser,
        details: `Direct status transition update`
      }
    ];

    const updatedJob = {
      ...existing,
      status: newStatus,
      updatedAt: now,
      history: updatedHistory
    };

    if (useLocalFallback || id.startsWith("local_")) {
      const updatedList = jobs.map(j => j.id === id ? updatedJob : j);
      setJobs(updatedList);
      localStorage.setItem("van_jobs", JSON.stringify(updatedList));
      setSelectedJob(updatedJob);
      return;
    }

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedJob)
      });
      if (!response.ok) throw new Error("Status change failed");
      const savedJob = await response.json();
      setJobs(prev => prev.map(j => j.id === savedJob.id ? savedJob : j));
      setSelectedJob(savedJob);
    } catch (err) {
      console.error("Status update failed, applying locally:", err);
      const updatedList = jobs.map(j => j.id === id ? updatedJob : j);
      setJobs(updatedList);
      localStorage.setItem("van_jobs", JSON.stringify(updatedList));
      setSelectedJob(updatedJob);
    }
  };


  // Filter computation
  const filteredJobs = jobs.filter((job) => {
    // Resolve driver name (saved driver or fleet fallback)
    const getDriverName = (j: VanJob) => {
      if (j.driver) return j.driver;
      const normalizedReg = (j.registrationPlate || "").toUpperCase().replace(/\s+/g, "");
      const match = fleet.find(v => v.registrationPlate.toUpperCase().replace(/\s+/g, "") === normalizedReg);
      return match ? match.driver : "";
    };
    const driverName = getDriverName(job);

    const matchesSearch = 
      job.registrationPlate.toLowerCase().includes(searchText.toLowerCase()) ||
      job.make.toLowerCase().includes(searchText.toLowerCase()) ||
      job.model.toLowerCase().includes(searchText.toLowerCase()) ||
      job.repairDetails.toLowerCase().includes(searchText.toLowerCase()) ||
      driverName.toLowerCase().includes(searchText.toLowerCase());

    const matchesYard = selectedYard === "All" || job.yard === selectedYard;
    const matchesStatus = selectedStatus === "All" || job.status === selectedStatus;

    return matchesSearch && matchesYard && matchesStatus;
  });

  // Render LoginScreen if not authenticated
  if (!loggedInUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/40 font-sans text-slate-900 antialiased">
      
      {/* Top Header - Pure Editorial White & Blue Theme */}
      <header className="bg-white border-b border-slate-200 py-5 px-6 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-none shadow-xs">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-slate-900 uppercase">VanLog // Yard</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">Armagh & Banbridge repair engine</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2.5 bg-blue-50/50 border border-blue-100 px-3 py-1.5 rounded-none justify-center sm:justify-start">
              <UserCheck className="w-4 h-4 text-blue-500" />
              <div className="flex flex-col text-left">
                <span className="text-[8px] text-blue-400 font-bold uppercase tracking-wider font-mono">Operator</span>
                <span className="text-xs text-slate-800 font-bold">{activeUser}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              {isAdmin && (
                <>
                  <button
                    id="btn-deleted-records"
                    onClick={() => {
                      setShowDeletedPanel(!showDeletedPanel);
                      setSelectedJob(null);
                      if (!showDeletedPanel) fetchDeletedJobs();
                    }}
                    className={`px-4 py-2 rounded-none text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border cursor-pointer flex-1 sm:flex-initial ${
                      showDeletedPanel
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 border-slate-200 hover:border-red-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Deleted Archive
                  </button>
                  <button
                    id="btn-admin-panel-open"
                    onClick={() => setIsAdminPanelOpen(true)}
                    className="px-4 py-2 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-none text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-slate-200 hover:border-blue-600 cursor-pointer flex-1 sm:flex-initial"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Roster Settings
                  </button>
                </>
              )}

              <button
                id="btn-logout"
                onClick={handleLogout}
                className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-100 rounded-none transition-all cursor-pointer flex items-center justify-center"
                title="Log Out of Yard Log"
              >
                <LogOut className="w-4 h-4" />
              </button>

              <button
                id="btn-log-new"
                onClick={() => {
                  setEditingJob(null);
                  setIsModalOpen(true);
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 border border-blue-600 text-white rounded-none text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer shadow-xs flex-1 sm:flex-initial flex items-center justify-center"
              >
                + Log New Intake
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 print:p-0 print:m-0 print:max-w-none">
        
        {error && (
          <div className="bg-slate-50 border-l-4 border-red-500 text-slate-900 rounded-none p-4 mb-8 flex items-start gap-3 print-hide">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider font-mono">Database Sync Error</h4>
              <p className="text-xs text-slate-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* 1. Statistics Summary */}
        <div className="print-hide">
          <StatsOverview jobs={jobs} />
        </div>

        {/* Deleted Records Panel (admin only) */}
        {showDeletedPanel && isAdmin && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-2xl font-sans font-bold text-slate-900 tracking-tight">Deleted Records Archive</h3>
                <p className="text-xs text-slate-400 font-mono tracking-wider uppercase mt-1">{deletedJobs.length} archived records — visible to admin only</p>
              </div>
              <button onClick={() => setShowDeletedPanel(false)} className="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-none cursor-pointer">← Back to Active</button>
            </div>

            {deletedJobs.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-none p-16 text-center">
                <p className="text-slate-400 text-sm">No deleted records in the archive.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deletedJobs.map((job) => (
                  <div key={job.id} className="bg-white border border-slate-200 rounded-none overflow-hidden">
                    {/* Job summary row */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-base text-slate-800 uppercase tracking-wider">{job.registrationPlate}</span>
                          <span className="text-xs text-slate-500">{job.make} {job.model}</span>
                          <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-none font-mono uppercase font-bold">Deleted</span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400 font-mono">
                          Deleted {job.deletedAt ? new Date(job.deletedAt).toLocaleString('en-GB') : 'Unknown'} by <span className="font-bold text-slate-600">{job.deletedBy || 'Unknown'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRestoreJob(job.id)}
                          className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer transition-colors"
                        >
                          ↩ Restore
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(job.id)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer transition-colors"
                        >
                          ✕ Purge
                        </button>
                      </div>
                    </div>
                    {/* Audit log */}
                    {job.history && job.history.length > 0 && (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Audit Log ({job.history.length} events)</p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {[...job.history].reverse().map((h: any) => (
                            <div key={h.id} className="flex items-start gap-2 text-[10px]">
                              <span className="text-slate-400 font-mono shrink-0">{new Date(h.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="font-bold text-slate-700">{h.action}</span>
                              <span className="text-slate-500">— {h.user}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!showDeletedPanel && selectedJob && (
          <div className="space-y-6 print:space-y-0 print:m-0 print:p-0">
            <JobDetailView 
              job={selectedJob} 
              onBack={() => setSelectedJob(null)}
              onEdit={(job) => {
                setEditingJob(job);
                setIsModalOpen(true);
              }}
              onDelete={handleDeleteJob}
              onStatusChange={handleStatusChange}
              fleet={fleet}
            />
          </div>
        )}

        {!showDeletedPanel && !selectedJob && (
          <div className="space-y-8">
            
            {/* Filter and Search Panel */}
            <div className="bg-white rounded-none border border-slate-200 p-4 sm:p-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              
              {/* Search text input */}
              <div className="relative flex-1 max-w-lg w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                <input
                  id="search-input"
                  type="text"
                  placeholder="Search by Plate, Make, Model, Driver, or repairs..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-none pl-10 pr-4 py-3 text-xs focus:outline-none focus:border-blue-600 focus:bg-white text-slate-800 font-sans transition-colors"
                />
              </div>

              {/* Badges Filters */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-4 sm:gap-6 w-full lg:w-auto">
                
                {/* Yard Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono shrink-0">Active Yard:</span>
                  <div className="bg-slate-50 p-1 rounded-none border border-slate-200 flex gap-1 w-full sm:w-auto">
                    {(["All", "Armagh", "Banbridge"] as const).map((y) => (
                      <button
                        id={`filter-yard-${y}`}
                        key={y}
                        onClick={() => setSelectedYard(y)}
                        className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-none text-xs font-bold tracking-wide transition-all cursor-pointer ${
                          selectedYard === y 
                            ? "bg-blue-600 text-white" 
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono shrink-0">Status:</span>
                  <select
                    id="filter-status"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as any)}
                    className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-none py-1.5 px-3 text-xs font-bold text-slate-700 uppercase tracking-wider focus:outline-none focus:border-blue-600 focus:bg-white font-sans cursor-pointer h-[38px] sm:h-auto"
                  >
                    <option value="All">ALL STATUSES</option>
                    <option value="pending">PENDING</option>
                    <option value="in_progress">IN PROGRESS</option>
                    <option value="completed">COMPLETED</option>
                    <option value="released">RELEASED</option>
                  </select>
                </div>

                {/* Clear filters shortcut */}
                {(searchText || selectedYard !== "All" || selectedStatus !== "All") && (
                  <button
                    id="btn-clear-filters"
                    onClick={() => {
                      setSearchText("");
                      setSelectedYard("All");
                      setSelectedStatus("All");
                    }}
                    className="py-1.5 px-3 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-none border border-slate-200 transition-all flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider cursor-pointer font-mono w-full sm:w-auto h-[38px] sm:h-auto"
                    title="Clear Filters"
                  >
                    <FilterX className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}

              </div>
            </div>

            {/* List and Grid display header with Editorial display font */}
            <div className="flex items-end justify-between border-b border-slate-200 pb-3">
              <h3 className="text-3xl font-sans font-bold text-slate-900 tracking-tight">
                Recent Activity
              </h3>
              <p className="text-xs text-slate-400 font-mono tracking-wider uppercase">{filteredJobs.length} vehicle logs listed</p>
            </div>

            {/* Main Listing Grid */}
            {loading ? (
              <div className="bg-white border border-slate-200 rounded-none p-20 flex flex-col items-center justify-center space-y-4 shadow-xs">
                <Wrench className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Streaming Garage Records...</span>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-none p-20 text-center space-y-6 shadow-xs">
                <div className="w-14 h-14 bg-blue-50 rounded-none border border-blue-100 flex items-center justify-center mx-auto text-blue-500">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xl text-slate-800 font-sans font-bold">No active logs located</h4>
                  <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                    There are no current entries recorded at our Armagh or Banbridge facility matching these search criteria.
                  </p>
                </div>
                <button
                  id="btn-inner-add"
                  onClick={() => {
                    setEditingJob(null);
                    setIsModalOpen(true);
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-xs"
                >
                  Log Your First Job
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5">
                {filteredJobs.map((job) => (
                  <JobCard 
                    key={job.id} 
                    job={job} 
                    onViewDetails={setSelectedJob} 
                  />
                ))}
              </div>
            )}

          </div>
        )}

      </main>

      {/* 3. Add & Edit Record Modal dialog overlay */}
      <AddJobModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingJob(null);
        }}
        onSave={handleSaveJob}
        editingJob={editingJob}
        fleet={fleet}
      />

      {/* 4. Roster management Admin Panel */}
        <AdminPanelModal
          isOpen={isAdminPanelOpen}
          onClose={() => setIsAdminPanelOpen(false)}
          jobs={jobs}
          fleet={fleet}
          onFleetUpdate={fetchFleet}
        />

    </div>
  );
}
