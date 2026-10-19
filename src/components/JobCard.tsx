import React from "react";
import { MapPin, Calendar, ClipboardList, Eye, Wrench, Image as ImageIcon } from "lucide-react";
import { VanJob } from "../types";
import fleetData from "../fleet.json";

interface JobCardProps {
  key?: React.Key;
  job: VanJob;
  onViewDetails: (job: VanJob) => void;
}

export default function JobCard({ job, onViewDetails }: JobCardProps) {
  const partsCount = job.parts.length;
  const totalPartsCost = job.parts.reduce((sum, part) => sum + part.price, 0);

  // Checklist progress calculations
  const totalCount = job.checklist ? job.checklist.length : 0;
  const checkedCount = job.checklist ? job.checklist.filter(i => i.status !== 'unchecked').length : 0;
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  // Fallback to find driver name from fleet.json by registration plate
  const getDriverName = () => {
    if (job.driver) return job.driver;
    const normalizedReg = (job.registrationPlate || "").toUpperCase().replace(/\s+/g, "");
    const match = fleetData.find(v => v.registrationPlate.toUpperCase().replace(/\s+/g, "") === normalizedReg);
    return match ? match.driver : "";
  };
  const driverName = getDriverName();

  // Status colors - Blue and White theme optimization
  const statusConfig = {
    pending: { bg: "bg-amber-50 text-amber-800 border-amber-200", label: "Pending" },
    in_progress: { bg: "bg-blue-600 text-white border-blue-600", label: "In Progress" },
    completed: { bg: "bg-emerald-50 text-emerald-800 border-emerald-300", label: "Completed" },
    released: { bg: "bg-slate-100 text-slate-500 border-slate-200", label: "Released" },
  };

  const statusStyle = statusConfig[job.status] || statusConfig.pending;

  // Find a thumbnail (preferably front or back photo, otherwise any photo)
  const thumbnailPhoto = 
    job.photos.find(p => p.category === 'front') ||
    job.photos.find(p => p.category === 'back') ||
    job.photos[0];

  return (
    <div 
      id={`job-card-${job.id}`} 
      className="bg-white rounded-none border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all duration-200 flex flex-col md:flex-row items-stretch overflow-hidden"
    >
      {/* Thumbnail or Icon Placeholder */}
      <div className="w-full md:w-48 bg-slate-50 flex-shrink-0 relative flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-200">
        {thumbnailPhoto ? (
          <img 
            src={thumbnailPhoto.base64Data} 
            alt="Van thumbnail" 
            className="w-full h-40 md:h-full object-cover animate-fade-in"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-slate-400">
            <Wrench className="w-8 h-8 mb-2 stroke-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider">No photo media</span>
          </div>
        )}
        
        {/* Yard Badge */}
        <span className={`absolute top-3 left-3 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest border shadow-xs flex items-center gap-1 ${
          job.yard === 'Armagh' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200'
        }`}>
          <MapPin className="w-3 h-3" />
          {job.yard}
        </span>
      </div>
 
      {/* Main Content Area */}
      <div className="flex-1 p-4 sm:p-6 flex flex-col justify-between">
        <div>
          {/* Top Line: Make, Model & Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="text-xl font-sans font-bold text-slate-900 flex items-center gap-2.5 flex-wrap">
              <span>{job.make || "Unknown Make"}</span> 
              <span className="text-slate-400 font-normal italic font-serif">{job.model}</span>
              {driverName && (
                <span className="text-slate-500 font-normal">- {driverName}</span>
              )}
              {job.color && (
                <span className="inline-block w-3 h-3 rounded-none border border-slate-300" style={{ backgroundColor: job.color.toLowerCase() }} title={job.color}></span>
              )}
            </h4>
            <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-none border ${statusStyle.bg}`}>
              {statusStyle.label}
            </span>
          </div>

          {/* License Plate Element & Mileage */}
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <div className="bg-amber-400 text-slate-950 px-3 py-1 rounded-none border border-amber-500 font-mono font-black text-xs tracking-widest flex items-center select-none uppercase shadow-xs">
              <span className="w-1 h-4 bg-blue-700 -ml-3 mr-2 flex items-center justify-center text-[4px] text-white flex-col font-sans select-none">
                <span className="leading-none scale-75 font-bold">UK</span>
              </span>
              {job.registrationPlate || "NO PLATE"}
            </div>
            {job.mileage !== undefined && job.mileage !== null && job.mileage !== "" && (
              <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-none uppercase tracking-wider">
                {typeof job.mileage === 'number' ? job.mileage.toLocaleString() : job.mileage} miles
              </span>
            )}
          </div>

          {/* Repair Short Summary */}
          <p className="text-xs text-slate-600 line-clamp-2 mb-4 font-sans leading-relaxed">
            {job.repairDetails || "No repair details provided."}
          </p>

          {/* Checklist Progress Bar */}
          {totalCount > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                <span>Checklist Progress</span>
                <span className="font-bold text-slate-700">{progressPercent}% ({checkedCount}/{totalCount})</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-none overflow-hidden">
                <div 
                  className={`h-full transition-all duration-350 ${
                    progressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Status Progress Bar */}
          {(() => {
            const statusMap = {
              pending: { pct: 25, label: "Pending Intake", color: "bg-amber-500" },
              in_progress: { pct: 50, label: "Work In Progress", color: "bg-blue-600" },
              completed: { pct: 75, label: "Completed / Prep", color: "bg-emerald-500" },
              released: { pct: 100, label: "Released Fleet", color: "bg-slate-500" }
            };
            const current = statusMap[job.status] || statusMap.pending;
            return (
              <div className="mb-4">
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  <span>Job Workflow Status</span>
                  <span className="font-bold text-slate-700">{current.label} ({current.pct}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-none overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${current.color}`}
                    style={{ width: `${current.pct}%` }}
                  ></div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer info: Date, Photos, Cost */}
        <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-1.5" title="Date In">
              <Calendar className="w-4 h-4 text-slate-300" />
              {new Date(job.dateIn).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1.5" title="Photos count">
              <ImageIcon className="w-4 h-4 text-slate-300" />
              {job.photos.length} photos
            </span>
            <span className="flex items-center gap-1.5" title="Parts quantity">
              <ClipboardList className="w-4 h-4 text-slate-300" />
              {partsCount} parts
            </span>
          </div>

          {/* Cost of parts & View Details */}
          <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto border-t sm:border-t-0 pt-3.5 sm:pt-0 border-slate-100">
            <div className="text-left">
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Parts Spend</span>
              <span className="text-sm font-bold text-blue-600 font-mono">
                £{totalPartsCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            
            <button 
              id={`btn-view-${job.id}`}
              onClick={() => onViewDetails(job)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 border border-blue-600 text-white rounded-none text-xs font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs flex-1 sm:flex-initial"
            >
              <Eye className="w-3.5 h-3.5" />
              View Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
