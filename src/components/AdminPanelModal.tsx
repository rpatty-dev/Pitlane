import React, { useState, useEffect, useMemo } from "react";
import { 
  X as CloseIcon, 
  Plus as PlusIcon, 
  Trash2 as TrashIcon, 
  Shield as ShieldIcon, 
  User as UserIcon, 
  Loader2 as LoaderIcon, 
  PoundSterling as PoundIcon, 
  Calendar as CalendarIcon, 
  Users as UsersIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Car as CarIcon
} from "lucide-react";
import type { VanJob } from "../types";

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: VanJob[];
  fleet: any[];
  onFleetUpdate: () => Promise<void>;
}

export default function AdminPanelModal({ isOpen, onClose, jobs, fleet, onFleetUpdate }: AdminPanelModalProps) {
  const [activeTab, setActiveTab] = useState<'personnel' | 'fleet'>('personnel');

  // Personnel Registry States
  const [mechanicList, setMechanicList] = useState<{ id: string; name: string }[]>([]);
  const [newMechanicName, setNewMechanicName] = useState("");
  const [newMechanicPasscode, setNewMechanicPasscode] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fleet Roster States
  const [fleetSearchText, setFleetSearchText] = useState("");
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [vehName, setVehName] = useState("");
  const [vehReg, setVehReg] = useState("");
  const [vehYear, setVehYear] = useState("");
  const [vehOwner, setVehOwner] = useState("");
  const [vehDriver, setVehDriver] = useState("");
  const [vehMot, setVehMot] = useState("");
  const [vehComment, setVehComment] = useState("");
  const [isFleetSaving, setIsFleetSaving] = useState(false);

  // Calculate past week's total work
  const { pastWeekJobs, totalCost, jobsByUser } = useMemo<{
    pastWeekJobs: VanJob[];
    totalCost: number;
    jobsByUser: Record<string, { count: number; cost: number }>;
  }>(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const pastWeekJobs = jobs.filter(job => {
      const jobDate = new Date(job.createdAt);
      return jobDate >= oneWeekAgo;
    });

    const totalCost = pastWeekJobs.reduce((sum, job) => {
      return sum + job.parts.reduce((partSum, part) => partSum + part.price, 0);
    }, 0);

    const jobsByUser: Record<string, { count: number; cost: number }> = {};
    pastWeekJobs.forEach(job => {
      const firstHistoryItem = job.history[0];
      const user = firstHistoryItem?.user || "Unknown";
      if (!jobsByUser[user]) {
        jobsByUser[user] = { count: 0, cost: 0 };
      }
      jobsByUser[user].count++;
      const jobPartsCost = job.parts.reduce((sum, part) => sum + part.price, 0);
      jobsByUser[user].cost += jobPartsCost;
    });

    return { pastWeekJobs, totalCost, jobsByUser };
  }, [jobs]);

  // Load mechanics list
  useEffect(() => {
    if (!isOpen || activeTab !== 'personnel') return;
    setLoading(true);
    
    fetch('/api/mechanics')
      .then(res => res.ok ? res.json() : Promise.reject('API error'))
      .then((list: string[]) => {
        setMechanicList(list.map(name => ({ id: name, name })));
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load mechanics:', err);
        setError('Could not read mechanics list.');
        setLoading(false);
      });
  }, [isOpen, activeTab]);

  // Filter fleet based on search text
  const filteredFleet = useMemo(() => {
    if (!fleetSearchText.trim()) return fleet;
    const search = fleetSearchText.toLowerCase();
    return fleet.filter(v => 
      (v.vehicle || "").toLowerCase().includes(search) ||
      (v.registrationPlate || "").toLowerCase().includes(search) ||
      (v.driver || "").toLowerCase().includes(search) ||
      (v.owner || "").toLowerCase().includes(search)
    );
  }, [fleet, fleetSearchText]);

  if (!isOpen) return null;

  // Personnel Handlers
  const handleAddMechanic = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newMechanicName.trim();
    const cleanPasscode = newMechanicPasscode.trim();
    if (!cleanName) return;
    if (!cleanPasscode) {
      alert('Please set a passcode for this mechanic.');
      return;
    }

    if (mechanicList.some(m => m.name.toLowerCase() === cleanName.toLowerCase())) {
      alert('A mechanic with this name already exists in the registry.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/mechanics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, passcode: cleanPasscode })
      });
      if (!res.ok) throw new Error('API error');
      const list: string[] = await res.json();
      setMechanicList(list.map(name => ({ id: name, name })));
      setNewMechanicName('');
      setNewMechanicPasscode('');
    } catch (err) {
      console.error('Error adding mechanic:', err);
      alert('Failed to add mechanic.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMechanic = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from the mechanics list?`)) return;

    try {
      const res = await fetch('/api/mechanics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('API error');
      const list: string[] = await res.json();
      setMechanicList(list.map(n => ({ id: n, name: n })));
    } catch (err) {
      console.error('Error deleting mechanic:', err);
      alert('Failed to remove mechanic.');
    }
  };

  // Fleet Handlers
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReg = vehReg.trim().toUpperCase();
    const cleanName = vehName.trim();
    if (!cleanReg || !cleanName) {
      alert("Registration plate and vehicle name/model are required.");
      return;
    }

    setIsFleetSaving(true);
    try {
      const res = await fetch('/api/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle: cleanName,
          registrationPlate: cleanReg,
          year: vehYear.trim(),
          owner: vehOwner.trim(),
          driver: vehDriver.trim(),
          motExp: vehMot.trim(),
          comment: vehComment.trim()
        })
      });
      if (!res.ok) throw new Error('API error');
      
      await onFleetUpdate();
      
      // Reset form
      setVehName("");
      setVehReg("");
      setVehYear("");
      setVehOwner("");
      setVehDriver("");
      setVehMot("");
      setVehComment("");
      setEditingVehicle(null);
    } catch (err) {
      console.error('Error saving vehicle:', err);
      alert('Failed to save vehicle.');
    } finally {
      setIsFleetSaving(false);
    }
  };

  const handleDeleteVehicle = async (registrationPlate: string) => {
    if (!confirm(`Are you sure you want to remove vehicle ${registrationPlate} from the fleet roster?`)) return;

    try {
      const res = await fetch('/api/fleet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationPlate })
      });
      if (!res.ok) throw new Error('API error');
      
      await onFleetUpdate();
      
      if (editingVehicle && editingVehicle.registrationPlate === registrationPlate) {
        setEditingVehicle(null);
        setVehName("");
        setVehReg("");
        setVehYear("");
        setVehOwner("");
        setVehDriver("");
        setVehMot("");
        setVehComment("");
      }
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      alert('Failed to remove vehicle.');
    }
  };

  const handleEditSelect = (v: any) => {
    setEditingVehicle(v);
    setVehName(v.vehicle || "");
    setVehReg(v.registrationPlate || "");
    setVehYear(v.year || "");
    setVehOwner(v.owner || "");
    setVehDriver(v.driver || "");
    setVehMot(v.motExp || "");
    setVehComment(v.comment || "");
  };

  const handleCancelEdit = () => {
    setEditingVehicle(null);
    setVehName("");
    setVehReg("");
    setVehYear("");
    setVehOwner("");
    setVehDriver("");
    setVehMot("");
    setVehComment("");
  };

  return (
    <div id="admin-modal-overlay" className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div id="admin-modal-container" className="bg-white rounded-none shadow-xs border border-slate-300 max-w-lg w-full flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldIcon className="w-4 h-4 text-blue-600" />
            <h3 className="font-sans font-bold text-sm uppercase tracking-wider text-slate-900">Admin Control Center</h3>
          </div>
          <button 
            id="admin-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-none border border-slate-200 bg-white hover:border-blue-400 hover:text-blue-600 transition-colors text-slate-400 cursor-pointer"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('personnel')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 text-center transition-all cursor-pointer ${
              activeTab === 'personnel'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            Personnel & Stats
          </button>
          <button
            onClick={() => setActiveTab('fleet')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 text-center transition-all cursor-pointer ${
              activeTab === 'fleet'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            Fleet Roster ({fleet.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          
          {error && activeTab === 'personnel' && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-none border-l-4 border-red-500">
              {error}
            </div>
          )}

          {/* TAB 1: PERSONNEL & STATS */}
          {activeTab === 'personnel' && (
            <div className="space-y-6">
              {/* Stats overview */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-blue-600" />
                  <h4 className="font-sans font-bold text-sm uppercase tracking-wider text-slate-900">Total Work (Past Week)</h4>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-none p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <UsersIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest font-mono">Jobs Logged</span>
                    </div>
                    <p className="text-2xl font-black text-blue-700">{pastWeekJobs.length}</p>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-none p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <PoundIcon className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest font-mono">Total Parts Cost</span>
                    </div>
                    <p className="text-2xl font-black text-green-700">£{totalCost.toFixed(2)}</p>
                  </div>
                </div>

                {Object.keys(jobsByUser).length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Breakdown by Mechanic</label>
                    <div className="border border-slate-200 rounded-none divide-y divide-slate-100 bg-slate-50/20">
                      {(Object.entries(jobsByUser) as Array<[string, { count: number; cost: number }]>).map(([user, { count, cost }]) => (
                        <div key={user} className="p-2.5 flex items-center justify-between bg-white">
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs font-semibold text-slate-800">{user}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400">{count} jobs</p>
                            <p className="text-xs font-bold text-slate-700">£{cost.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Add Mechanic form */}
              <form onSubmit={handleAddMechanic} className="space-y-3 border-t border-slate-100 pt-5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Register New Mechanic</label>
                <div className="flex gap-2">
                  <input
                    id="admin-new-name"
                    type="text"
                    value={newMechanicName}
                    onChange={(e) => setNewMechanicName(e.target.value)}
                    placeholder="Name e.g. Zac"
                    required
                    disabled={isSaving}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-none px-3 py-2 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                  />
                  <input
                    id="admin-new-passcode"
                    type="text"
                    value={newMechanicPasscode}
                    onChange={(e) => setNewMechanicPasscode(e.target.value)}
                    placeholder="Passcode"
                    required
                    disabled={isSaving}
                    maxLength={10}
                    className="w-28 bg-slate-50 border border-slate-200 rounded-none px-3 py-2 text-xs focus:outline-none focus:border-blue-600 text-slate-900 tracking-widest"
                  />
                  <button
                    id="admin-btn-add"
                    type="submit"
                    disabled={isSaving || !newMechanicName.trim() || !newMechanicPasscode.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 font-mono">The mechanic will use this passcode to log in. You can share it with them verbally.</p>
              </form>

              {/* Mechanic list */}
              <div className="space-y-2.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Current Registered Personnel ({mechanicList.length})</label>
                
                {loading ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2 border border-dashed border-slate-200">
                    <LoaderIcon className="w-5 h-5 text-blue-500 animate-spin" />
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold">Querying directory...</span>
                  </div>
                ) : mechanicList.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 text-xs text-slate-400">
                    No active mechanics found in registry.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-none max-h-56 overflow-y-auto divide-y divide-slate-100 bg-slate-50/20">
                    {mechanicList.map((m) => (
                      <div key={m.id} className="p-3 flex items-center justify-between bg-white">
                        <span className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          {m.name}
                        </span>
                        <button
                          id={`admin-del-${m.id}`}
                          type="button"
                          onClick={() => handleDeleteMechanic(m.id, m.name)}
                          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors rounded-none cursor-pointer"
                          title={`Remove ${m.name}`}
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FLEET ROSTER */}
          {activeTab === 'fleet' && (
            <div className="space-y-6">
              
              {/* Add/Edit Vehicle Form */}
              <form onSubmit={handleSaveVehicle} className="space-y-3 bg-slate-50/50 border border-slate-200 p-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <CarIcon className="w-3.5 h-3.5" />
                    {editingVehicle ? "Edit Fleet Vehicle" : "Add Roster Vehicle"}
                  </span>
                  {editingVehicle && (
                    <button 
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-[9px] font-bold uppercase tracking-wider text-red-600 hover:text-red-800 cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Registration Plate *</label>
                    <input
                      type="text"
                      value={vehReg}
                      onChange={(e) => setVehReg(e.target.value)}
                      placeholder="e.g. AFZ 7814"
                      required
                      disabled={isFleetSaving || !!editingVehicle}
                      className="w-full bg-white border border-slate-200 rounded-none px-3 py-1.5 text-xs uppercase focus:outline-none focus:border-blue-600 text-slate-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Vehicle Model/Make *</label>
                    <input
                      type="text"
                      value={vehName}
                      onChange={(e) => setVehName(e.target.value)}
                      placeholder="e.g. Vauxhall Combo"
                      required
                      disabled={isFleetSaving}
                      className="w-full bg-white border border-slate-200 rounded-none px-3 py-1.5 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Driver Name *</label>
                    <input
                      type="text"
                      value={vehDriver}
                      onChange={(e) => setVehDriver(e.target.value)}
                      placeholder="e.g. Noel"
                      required
                      disabled={isFleetSaving}
                      className="w-full bg-white border border-slate-200 rounded-none px-3 py-1.5 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Year</label>
                    <input
                      type="text"
                      value={vehYear}
                      onChange={(e) => setVehYear(e.target.value)}
                      placeholder="e.g. 2015"
                      disabled={isFleetSaving}
                      className="w-full bg-white border border-slate-200 rounded-none px-3 py-1.5 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">MOT Expiry</label>
                    <input
                      type="text"
                      value={vehMot}
                      onChange={(e) => setVehMot(e.target.value)}
                      placeholder="DD/MM/YYYY"
                      disabled={isFleetSaving}
                      className="w-full bg-white border border-slate-200 rounded-none px-3 py-1.5 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Owner</label>
                    <input
                      type="text"
                      value={vehOwner}
                      onChange={(e) => setVehOwner(e.target.value)}
                      placeholder="e.g. Joe Mallon"
                      disabled={isFleetSaving}
                      className="w-full bg-white border border-slate-200 rounded-none px-3 py-1.5 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Comment</label>
                    <input
                      type="text"
                      value={vehComment}
                      onChange={(e) => setVehComment(e.target.value)}
                      placeholder="e.g. Fleet Insurance"
                      disabled={isFleetSaving}
                      className="w-full bg-white border border-slate-200 rounded-none px-3 py-1.5 text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isFleetSaving || !vehName.trim() || !vehReg.trim() || !vehDriver.trim()}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isFleetSaving ? (
                      <>
                        <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="w-3.5 h-3.5" />
                        {editingVehicle ? "Save Changes" : "Register Vehicle"}
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Roster Search & List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono shrink-0">Current Fleet ({filteredFleet.length})</label>
                  
                  {/* Search bar */}
                  <div className="relative flex-1 max-w-[220px]">
                    <SearchIcon className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filter by Reg, Model..."
                      value={fleetSearchText}
                      onChange={(e) => setFleetSearchText(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-none pl-8 pr-2.5 py-1.5 text-[10px] focus:outline-none focus:border-blue-600 text-slate-900 font-sans"
                    />
                  </div>
                </div>

                {filteredFleet.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 text-xs text-slate-400">
                    No matching fleet vehicles found.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-none max-h-60 overflow-y-auto divide-y divide-slate-100 bg-slate-50/20">
                    {filteredFleet.map((v: any) => (
                      <div key={v.registrationPlate} className="p-2.5 flex items-center justify-between bg-white hover:bg-slate-50/30 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="bg-amber-400 text-slate-900 border border-amber-500 font-mono font-bold text-[9px] tracking-wide px-1.5 py-0.2 uppercase select-none rounded-none">
                              {v.registrationPlate}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">{v.vehicle}</span>
                            {v.year && <span className="text-[9px] text-slate-400 font-mono">({v.year})</span>}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-3">
                            <span>Driver: <strong className="text-slate-700">{v.driver}</strong></span>
                            {v.motExp && <span>MOT Exp: <strong className="text-slate-700">{v.motExp}</strong></span>}
                            {v.owner && <span>Owner: <strong className="text-slate-700">{v.owner}</strong></span>}
                          </div>
                          {v.comment && <div className="text-[9px] text-slate-400 italic mt-0.5">{v.comment}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditSelect(v)}
                            className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors rounded-none cursor-pointer"
                            title={`Edit ${v.registrationPlate}`}
                          >
                            <EditIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVehicle(v.registrationPlate)}
                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors rounded-none cursor-pointer"
                            title={`Remove ${v.registrationPlate}`}
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            id="admin-panel-close-btn"
            onClick={onClose}
            className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer transition-colors"
          >
            Close Panel
          </button>
        </div>

      </div>
    </div>
  );
}
