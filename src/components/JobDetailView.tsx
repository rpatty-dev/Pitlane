import React, { useState } from "react";
import { ArrowLeft, Calendar, MapPin, Wrench, Edit, Trash2, Tag, DollarSign, History, ImageIcon, ZoomIn, FileText, CheckCircle, Printer } from "lucide-react";
import { VanJob, PhotoItem } from "../types";

interface JobDetailViewProps {
  job: VanJob;
  onBack: () => void;
  onEdit: (job: VanJob) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: VanJob["status"]) => Promise<void>;
  fleet: any[];
}

export default function JobDetailView({ job, onBack, onEdit, onDelete, onStatusChange, fleet }: JobDetailViewProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);

  const totalPartsCost = job.parts.reduce((sum, p) => sum + p.price, 0);

  // Checklist progress calculations
  const totalCount = job.checklist ? job.checklist.length : 0;
  const checkedCount = job.checklist ? job.checklist.filter(i => i.status !== 'unchecked').length : 0;
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  // Fallback to find driver name from fleet list by registration plate
  const getDriverName = () => {
    if (job.driver) return job.driver;
    const normalizedReg = (job.registrationPlate || "").toUpperCase().replace(/\s+/g, "");
    const match = fleet.find(v => v.registrationPlate.toUpperCase().replace(/\s+/g, "") === normalizedReg);
    return match ? match.driver : "";
  };
  const driverName = getDriverName();

  // Print-specific variables
  const checklist = job.checklist || [];
  const failedItems = checklist.filter(i => i.status === 'fail');
  const passedItems = checklist.filter(i => i.status === 'pass');
  const loggedBy = job.history && job.history.length > 0 ? job.history[0].user : "Mechanic";

  // Filter photos by logical groupings
  const invoicePhotos = job.photos.filter(p => p.category === 'invoice');
  const vehiclePhotos = job.photos.filter(p => p.category === 'front' || p.category === 'back');
  const workPhotos = job.photos.filter(p => p.category === 'work_done' || p.category === 'touch_up' || p.category === 'other');

  // Status style config with beautiful blue optimizations
  const statusConfig = {
    pending: { bg: "bg-amber-50 text-amber-800 border-amber-200", label: "Pending Setup" },
    in_progress: { bg: "bg-blue-600 text-white border-blue-600", label: "In Progress" },
    completed: { bg: "bg-emerald-50 text-emerald-800 border-emerald-300", label: "Completed" },
    released: { bg: "bg-slate-100 text-slate-500 border-slate-200", label: "Released / Gone" },
  };

  const statusStyle = statusConfig[job.status] || statusConfig.pending;

  return (
    <div id="job-detail-root" className="bg-white rounded-none border border-slate-200 shadow-xs overflow-hidden">
      
      {/* Detail Header / Nav Bar */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 print-hide">
        <button
          id="btn-detail-back"
          onClick={onBack}
          className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-700 hover:text-blue-800 hover:bg-blue-50 transition-colors py-2 px-4 bg-white border border-blue-200 rounded-none cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="flex items-center gap-3">
          <button
            id="btn-detail-print"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-200 border border-slate-200 transition-all py-2 px-4 rounded-none cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>
          <button
            id="btn-detail-edit"
            onClick={() => onEdit(job)}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 transition-all py-2 px-4 rounded-none cursor-pointer shadow-xs"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit Report
          </button>
          <button
            id="btn-detail-delete"
            onClick={() => {
              if (confirm("Are you sure you want to delete this repair record? This cannot be undone.")) {
                onDelete(job.id!);
              }
            }}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-700 hover:bg-red-700 hover:text-white transition-all py-2 px-4 bg-red-50 border border-red-200 rounded-none cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* Main Details Canvas */}
      <div className="p-6 md:p-8 space-y-8 print-hide">
        
        {/* Row 1: Van Info Banner & Status Management */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          <div className="lg:col-span-2 space-y-5">
            <div className="flex items-start flex-wrap gap-3">
              <span className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest border flex items-center gap-1 ${
                job.yard === 'Armagh' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200'
              }`}>
                <MapPin className="w-3.5 h-3.5" />
                {job.yard} Yard
              </span>

              <span className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest border ${statusStyle.bg}`}>
                {statusStyle.label}
              </span>
            </div>

            <h2 className="text-3xl font-sans font-bold text-slate-900 tracking-tight flex items-center gap-3.5 flex-wrap">
              <span>{job.make || "Unknown Make"}</span>
              <span className="text-slate-400 font-normal italic font-serif">{job.model}</span>
              {driverName && (
                <span className="text-slate-500 font-normal">- {driverName}</span>
              )}
              {job.color && (
                <span className="inline-block w-4 h-4 rounded-none border border-slate-300 align-middle" style={{ backgroundColor: job.color.toLowerCase() }} title={job.color}></span>
              )}
            </h2>

            {/* License Plate & Mileage Display */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="bg-amber-400 text-slate-950 px-5 py-2 border border-amber-500 font-mono font-black text-xl tracking-widest flex items-center shadow-xs uppercase select-none rounded-none">
                <span className="w-1.5 h-6 bg-blue-700 -ml-5 mr-3 flex items-center justify-center text-[6px] text-white flex-col font-sans">
                  <span className="leading-none font-bold scale-75">UK</span>
                </span>
                {job.registrationPlate || "NO REG LOGGED"}
              </div>

              {job.mileage !== undefined && job.mileage !== null && job.mileage !== "" && (
                <div className="bg-slate-100 border border-slate-200 px-4 py-2 font-mono font-bold text-slate-800 text-sm tracking-wider uppercase rounded-none shadow-xs">
                  <span className="text-[9px] block text-slate-400 font-sans font-bold leading-none mb-0.5">Recorded Mileage</span>
                  {typeof job.mileage === 'number' ? job.mileage.toLocaleString() : job.mileage} miles
                </div>
              )}
            </div>

            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5 mt-2">
              <Calendar className="w-4 h-4 text-slate-300" />
              Logged Came In: {new Date(job.dateIn).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Quick Status Setter Side Box */}
          <div className="bg-blue-50/20 border border-blue-100 rounded-none p-5 shadow-xs print-hide">
            <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-4 font-mono">Update Repair Status</h4>
            <div className="space-y-2">
              {(['pending', 'in_progress', 'completed', 'released'] as const).map((s) => {
                const isCurrent = job.status === s;
                return (
                  <button
                    id={`btn-status-change-${s}`}
                    key={s}
                    onClick={() => onStatusChange(job.id!, s)}
                    disabled={isCurrent}
                    className={`w-full text-left py-2.5 px-3 rounded-none border text-[10px] font-mono uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer ${
                      isCurrent 
                        ? 'bg-blue-600 border-blue-600 text-white font-bold cursor-default shadow-xs' 
                        : 'bg-white border-blue-100 text-slate-600 hover:bg-blue-50'
                    }`}
                  >
                    {s.replace('_', ' ')}
                    {isCurrent && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: Diagnostics & Repair Details */}
        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-mono">
            <Wrench className="w-4 h-4 text-blue-400" />
            Repair Description & Work Performed
          </h3>
          <div className="bg-slate-50/50 rounded-none p-5 border border-slate-200 text-slate-800 whitespace-pre-wrap text-xs leading-relaxed font-sans">
            {job.repairDetails || "No detailed repair log was documented."}
          </div>
        </div>

        {/* Row 3: Part Replacements Breakdowns */}
        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-mono">
            <Tag className="w-4 h-4 text-blue-400" />
            Parts Replaced & Spend Tracking
          </h3>

          {job.parts.length === 0 ? (
            <div className="bg-slate-50/50 border border-slate-200 rounded-none p-6 text-center text-xs text-slate-400">
              No part replacements have been documented for this record.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-none overflow-hidden shadow-none">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider text-[10px] font-mono">
                    <th className="p-3.5">Replaced Component / Part</th>
                    <th className="p-3.5">Supplier / Store Bought From</th>
                    <th className="p-3.5 text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {job.parts.map((part) => (
                    <tr key={part.id} className="border-b border-slate-100 hover:bg-slate-50/30">
                      <td className="p-3.5 font-bold text-slate-800 text-xs">{part.name}</td>
                      <td className="p-3.5 text-slate-500">{part.boughtFrom}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900 text-xs">£{part.price.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50/20 font-bold border-t border-blue-100">
                    <td colSpan={2} className="p-4 text-right text-blue-500 uppercase tracking-wider text-[10px] font-mono">Aggregate parts Total:</td>
                    <td className="p-4 text-right font-mono text-blue-600 text-sm font-black">
                      £{totalPartsCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MOT Checklist Section */}
        {job.checklist && job.checklist.length > 0 && (
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-mono">
              <CheckCircle className="w-4 h-4 text-blue-400" />
              MOT Vehicle check list (R001)
            </h3>
            
            {/* Checklist Progress Bar */}
            <div className="mb-3 bg-white border border-slate-200 p-4">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                <span className="font-bold">Inspection Completion Rate</span>
                <span className="font-bold text-blue-600">{progressPercent}% ({checkedCount} of {totalCount} items verified)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-none overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    progressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Status Progress Bar */}
            {(() => {
              const statusMap = {
                pending: { pct: 25, label: "Pending Intake", color: "bg-amber-500" },
                in_progress: { pct: 50, label: "Work In Progress", color: "bg-blue-600" },
                completed: { pct: 75, label: "Completed / Ready", color: "bg-emerald-500" },
                released: { pct: 100, label: "Released Fleet", color: "bg-slate-500" }
              };
              const current = statusMap[job.status] || statusMap.pending;
              return (
                <div className="mb-4 bg-white border border-slate-200 p-4">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                    <span className="font-bold">Job Workflow Status</span>
                    <span className="font-bold text-blue-600">{current.label} ({current.pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-none overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${current.color}`}
                      style={{ width: `${current.pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })()}
            
            <div className="bg-slate-50/20 border border-slate-200 rounded-none p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(['Interior', 'Exterior', 'Under Bonnet', 'Under Vehicle'] as const).map((cat) => {
                  const items = job.checklist!.filter(c => c.category === cat);
                  const activeItems = items.filter(i => i.status !== 'unchecked');
                  
                  if (activeItems.length === 0) return null;

                  return (
                    <div key={cat} className="space-y-2">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-1 font-mono">
                        {cat} Checks ({items.filter(i => i.status === 'pass').length} passed, {items.filter(i => i.status === 'fail').length} failed)
                      </h4>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {activeItems.map((item) => (
                          <div key={item.name} className="flex items-center justify-between text-xs py-1 px-2 bg-white border border-slate-100 hover:bg-slate-50/50">
                            <span className="text-slate-700 font-semibold">{item.name}</span>
                            <div className="flex items-center gap-2">
                              {item.comments && (
                                <span className="text-[10px] text-slate-400 italic font-sans max-w-xs truncate" title={item.comments}>
                                  ({item.comments})
                                </span>
                              )}
                              <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                item.status === 'pass' 
                                  ? 'bg-green-150 text-green-800' 
                                  : 'bg-red-150 text-red-800'
                              }`}>
                                {item.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* If nothing is checked yet */}
              {job.checklist!.filter(i => i.status !== 'unchecked').length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">Checklist has been generated but no items are checked yet. Edit report to complete.</p>
              )}
            </div>
          </div>
        )}

        {/* Row 4: Organized Photo Galleries */}
        <div className="border-t border-slate-100 pt-6 space-y-6">
          <h3 className="text-[11px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1.5 font-mono">
            <ImageIcon className="w-4 h-4 text-blue-400" />
            Uploaded Photo Attachments & Proofs
          </h3>

          {job.photos.length === 0 ? (
            <div className="bg-slate-50/50 border border-slate-200 rounded-none p-6 text-center text-xs text-slate-400">
              No photos have been uploaded for this job yet.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Category 1: Vehicle Plate Overview */}
              {vehiclePhotos.length > 0 && (
                <div id="gallery-vehicle">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5 font-mono">
                    <Wrench className="w-3.5 h-3.5 text-slate-300" /> Front & Back Plate Overviews
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {vehiclePhotos.map(photo => (
                      <div 
                        id={`photo-${photo.id}`}
                        key={photo.id} 
                        onClick={() => setSelectedPhoto(photo)}
                        className="group relative h-28 bg-slate-50 rounded-none overflow-hidden border border-slate-200 cursor-pointer hover:border-blue-400 hover:shadow-xs transition-all"
                      >
                        <img src={photo.base64Data} alt="Plate overview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-5 h-5 text-white" />
                        </div>
                        <span className="absolute bottom-1 right-1 bg-blue-600/95 text-white text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-none shadow-xs">
                          {photo.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 2: Invoices & Receipts */}
              {invoicePhotos.length > 0 && (
                <div id="gallery-invoices">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5 font-mono">
                    <FileText className="w-3.5 h-3.5 text-slate-300" /> Part Invoice & Receipt Slips
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {invoicePhotos.map(photo => (
                      <div 
                        id={`photo-${photo.id}`}
                        key={photo.id} 
                        onClick={() => setSelectedPhoto(photo)}
                        className="group relative h-28 bg-slate-50 rounded-none overflow-hidden border border-slate-200 cursor-pointer hover:border-blue-400 hover:shadow-xs transition-all"
                      >
                        <img src={photo.base64Data} alt="Invoice" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-5 h-5 text-white" />
                        </div>
                        <span className="absolute bottom-1 right-1 bg-blue-600/95 text-white text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-none shadow-xs">
                          Invoice
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 3: Work / Touch-Ups */}
              {workPhotos.length > 0 && (
                <div id="gallery-work">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5 font-mono">
                    <CheckCircle className="w-3.5 h-3.5 text-slate-300" /> Touch Ups & Work Performed Proofs
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {workPhotos.map(photo => (
                      <div 
                        id={`photo-${photo.id}`}
                        key={photo.id} 
                        onClick={() => setSelectedPhoto(photo)}
                        className="group relative h-28 bg-slate-50 rounded-none overflow-hidden border border-slate-200 cursor-pointer hover:border-blue-400 hover:shadow-xs transition-all"
                      >
                        <img src={photo.base64Data} alt="Work done" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-5 h-5 text-white" />
                        </div>
                        <span className="absolute bottom-1 right-1 bg-blue-600/95 text-white text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-none shadow-xs">
                          {photo.category.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Row 5: Audit Logs & History Timeline */}
        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-5 flex items-center gap-1.5 font-mono">
            <History className="w-4 h-4 text-blue-400" />
            Automatic Job History & Audit Timeline
          </h3>

          <div className="relative pl-6 border-l border-blue-100 ml-3 space-y-5">
            {job.history && job.history.length > 0 ? (
              job.history.map((item) => (
                <div key={item.id} className="relative">
                  {/* Timeline point */}
                  <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-none bg-blue-600 border border-white shadow-xs"></div>
                  
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 block font-bold uppercase">
                      {new Date(item.timestamp).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <h5 className="text-xs font-bold text-slate-800">{item.action}</h5>
                    {item.details && (
                      <p className="text-xs text-slate-500 mt-0.5 bg-slate-50 rounded-none px-2.5 py-1 inline-block border border-slate-200 font-sans">
                        {item.details}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">No history logged for this repair yet.</p>
            )}
          </div>
        </div>

      </div>

      {/* Dedicated Print Layout (fits on a single A4 page) */}
      <div className="print-only p-4 font-sans text-xs text-slate-800 space-y-4">
        
        {/* Company Header */}
        <div className="border-b-2 border-slate-900 pb-2 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">FLEETTRACK</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">VEHICLE REPAIR & INSPECTION REPORT</p>
          </div>
          <div className="text-right text-[8px] text-slate-400 font-mono">
            <div>Report ID: {job.id || "N/A"}</div>
            <div>Printed: {new Date().toLocaleString()}</div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-4 gap-4 border-b border-slate-200 py-2">
          <div>
            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Yard Location</div>
            <div className="font-semibold text-[10px]">{job.yard} Yard</div>
          </div>
          <div>
            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Date Logged</div>
            <div className="font-semibold text-[10px]">{new Date(job.dateIn).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Current Status</div>
            <div className="font-semibold text-[10px] uppercase">{job.status.replace('_', ' ')}</div>
          </div>
          <div>
            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Logged By</div>
            <div className="font-semibold text-[10px]">{loggedBy}</div>
          </div>
        </div>

        {/* Vehicle & License Plate */}
        <div className="grid grid-cols-3 gap-4 items-center py-2 border-b border-slate-200">
          <div className="col-span-2">
            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Vehicle Details</div>
            <div className="text-xs font-bold text-slate-900">
              {job.make} {job.model} 
              {job.color && <span className="text-slate-500 font-normal"> ({job.color})</span>}
            </div>
            {driverName && (
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">
                Driver: <span className="font-semibold text-slate-800">{driverName}</span>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <div className="bg-amber-400 text-slate-950 px-3 py-1 border border-amber-500 font-mono font-black text-xs tracking-wider uppercase select-none rounded-none text-center print:bg-transparent print:text-black print:border-black">
              {job.registrationPlate || "NO REG"}
            </div>
          </div>
        </div>

        {/* Repair Details */}
        <div>
          <h3 className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">
            Repair Description & Work Performed
          </h3>
          <div className="border border-slate-200 p-2 bg-slate-50/30 print:bg-transparent text-slate-800 text-[10px] leading-normal whitespace-pre-wrap min-h-[50px]">
            {job.repairDetails || "No detailed repair log was documented."}
          </div>
        </div>

        {/* Parts Replaced */}
        <div>
          <h3 className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">
            Parts Replaced & Cost Breakdown
          </h3>
          {job.parts.length === 0 ? (
            <div className="border border-slate-200 p-1.5 text-center text-[10px] text-slate-400">
              No parts replaced.
            </div>
          ) : (
            <div className="border border-slate-200">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-slate-50 print:bg-transparent border-b border-slate-200 text-left font-bold text-slate-500 uppercase tracking-wider text-[8px] font-mono">
                    <th className="p-1 px-2">Part Name</th>
                    <th className="p-1 px-2">Supplier</th>
                    <th className="p-1 px-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {job.parts.map((part) => (
                    <tr key={part.id} className="border-b border-slate-100">
                      <td className="p-1 px-2 font-semibold text-slate-800">{part.name}</td>
                      <td className="p-1 px-2 text-slate-500">{part.boughtFrom}</td>
                      <td className="p-1 px-2 text-right font-mono font-bold">£{part.price.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 print:bg-transparent font-bold border-t border-slate-200">
                    <td colSpan={2} className="p-1 px-2 text-right text-[8px] uppercase tracking-wider font-mono text-slate-500">Total Parts Cost:</td>
                    <td className="p-1 px-2 text-right font-mono text-slate-900 font-bold">
                      £{totalPartsCost.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MOT Checklist Section */}
        {checklist.length > 0 && (
          <div>
            <h3 className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">
              MOT Checklist Verification Summary
            </h3>
            <div className="border border-slate-200 p-2 bg-white flex flex-col gap-1 text-[9px]">
              <div className="flex justify-between items-center">
                <div>
                  Inspection Status: <span className="font-semibold text-slate-900">{checkedCount} of {totalCount} items checked</span>
                </div>
                <div>
                  Pass Rate: <span className="font-semibold text-green-700">{passedItems.length} Passed</span>
                  {failedItems.length > 0 && (
                    <span className="ml-2 font-semibold text-red-700">{failedItems.length} Failed</span>
                  )}
                </div>
              </div>
              {failedItems.length > 0 ? (
                <div className="border-t border-slate-100 pt-1">
                  <span className="font-bold text-red-750 uppercase text-[7px] font-mono tracking-wider block">CRITICAL FAILURES DETECTED:</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-0.5">
                    {failedItems.map(f => (
                      <div key={f.name} className="text-red-800 flex items-start gap-1 font-semibold text-[8px]">
                        <span>•</span>
                        <span>{f.name} {f.comments ? `(${f.comments})` : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-100 pt-1 text-green-700 font-semibold text-[8px]">
                  ✓ All inspected items passed verification. No vehicle structure, steering, suspension, or brake defects were reported.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Photos Section - Side-by-Side: Invoices Left (sizeable), Vans Right */}
        {job.photos.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="grid grid-cols-12 gap-6 bg-white">
              {/* Left Column: Invoices (sizeable) */}
              <div className="col-span-7 flex flex-col gap-2">
                <h3 className="text-[8px] font-bold text-slate-500 uppercase tracking-widest font-mono border-b border-slate-100 pb-1">
                  Invoice / Parts Receipt Proofs (Max Size)
                </h3>
                {invoicePhotos.length === 0 ? (
                  <div className="h-[95mm] border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                    No invoice photos uploaded
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {invoicePhotos.slice(0, 1).map(photo => (
                      <div key={photo.id} className="border border-slate-200 p-1 bg-white">
                        <div className="h-[95mm] w-full bg-slate-50 flex items-center justify-center">
                          <img 
                            src={photo.base64Data} 
                            alt="Invoice receipt" 
                            className="max-h-full max-w-full object-contain" 
                            referrerPolicy="no-referrer" 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Vehicle & Work Photos */}
              <div className="col-span-5 flex flex-col gap-2">
                <h3 className="text-[8px] font-bold text-slate-500 uppercase tracking-widest font-mono border-b border-slate-100 pb-1">
                  Vehicle & Work Photos
                </h3>
                {job.photos.filter(p => p.category !== 'invoice').length === 0 ? (
                  <div className="h-[95mm] border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                    No vehicle photos uploaded
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {job.photos.filter(p => p.category !== 'invoice').slice(0, 4).map(photo => (
                      <div key={photo.id} className="border border-slate-200 p-1 bg-white flex flex-col items-center">
                        <div className="h-[43mm] w-full bg-slate-50 flex items-center justify-center">
                          <img 
                            src={photo.base64Data} 
                            alt={photo.category} 
                            className="max-h-full max-w-full object-contain" 
                            referrerPolicy="no-referrer" 
                          />
                        </div>
                        <span className="text-[6px] font-mono font-bold uppercase tracking-wider text-slate-500 mt-0.5 truncate max-w-full">
                          {photo.category.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sign-off Section */}
        <div className="border-t border-slate-200 pt-3 mt-4 print-signatures">
          <div className="grid grid-cols-2 gap-8 text-[9px]">
            <div>
              <div className="mb-4 font-semibold text-slate-500 font-sans">MECHANIC SIGN-OFF:</div>
              <div className="border-t border-slate-300 pt-0.5 flex justify-between text-[8px] text-slate-400 font-mono">
                <span>Signed: ___________________________</span>
                <span>Date: _______________</span>
              </div>
            </div>
            <div>
              <div className="mb-4 font-semibold text-slate-500 font-sans">MANAGER / DRIVER SIGN-OFF:</div>
              <div className="border-t border-slate-300 pt-0.5 flex justify-between text-[8px] text-slate-400 font-mono">
                <span>Signed: ___________________________</span>
                <span>Date: _______________</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Full-Screen Photo Viewer Modal overlay */}
      {selectedPhoto && (
        <div 
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 bg-slate-950/95 flex items-center justify-center p-4 z-[60] cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[85vh] overflow-hidden flex flex-col items-center">
            <img 
              src={selectedPhoto.base64Data} 
              alt="Expanded view" 
              className="max-w-full max-h-[80vh] object-contain rounded-none border border-white/10"
              referrerPolicy="no-referrer"
            />
            <div className="mt-3 bg-slate-900 border border-slate-800 text-white rounded-none px-5 py-2.5 text-center text-xs shadow-lg">
              <span className="font-bold uppercase text-blue-400 tracking-wider text-[10px] block mb-1 font-mono">
                Category: {selectedPhoto.category.replace('_', ' ')}
              </span>
              <span>{selectedPhoto.notes || "No notes attached"}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
