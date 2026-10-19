import React from "react";
import { Wrench, ShieldAlert, CheckCircle2, DollarSign, MapPin } from "lucide-react";
import { VanJob } from "../types";

interface StatsOverviewProps {
  jobs: VanJob[];
}

export default function StatsOverview({ jobs }: StatsOverviewProps) {
  const totalJobs = jobs.length;
  const pendingJobs = jobs.filter(j => j.status === 'pending').length;
  const inProgressJobs = jobs.filter(j => j.status === 'in_progress').length;
  const completedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'released').length;

  const armaghJobs = jobs.filter(j => j.yard === 'Armagh').length;
  const banbridgeJobs = jobs.filter(j => j.yard === 'Banbridge').length;

  const totalPartsCost = jobs.reduce((sum, job) => {
    const jobPartsCost = job.parts.reduce((pSum, part) => pSum + part.price, 0);
    return sum + jobPartsCost;
  }, 0);

  return (
    <div id="stats-container" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
      {/* Total Active Jobs */}
      <div id="stat-card-active" className="bg-white rounded-none border border-blue-100 border-l-4 border-l-blue-600 p-6 flex flex-col justify-between shadow-xs shadow-blue-50/50">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest font-mono">Total Logged Jobs</p>
            <h3 className="text-4xl font-bold font-sans text-slate-900 mt-2 tracking-tight">{totalJobs}</h3>
          </div>
          <div className="p-2.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-none">
            <Wrench className="w-5 h-5" id="icon-wrench" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-5 text-[10px] font-mono uppercase tracking-wider">
          <span className="border border-blue-100 bg-blue-50/50 px-2.5 py-1 text-blue-700 font-bold">
            {pendingJobs} pending
          </span>
          <span className="border border-blue-600 bg-blue-600 px-2.5 py-1 text-white font-bold">
            {inProgressJobs} active
          </span>
        </div>
      </div>

      {/* Yard Split */}
      <div id="stat-card-yards" className="bg-white rounded-none border border-slate-200 p-6 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Yards Breakdown</p>
            <div className="flex gap-5 mt-2">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Armagh</span>
                <p className="text-2xl font-bold text-blue-600 font-mono">{armaghJobs}</p>
              </div>
              <div className="border-r border-slate-200"></div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Banbridge</span>
                <p className="text-2xl font-bold text-blue-600 font-mono">{banbridgeJobs}</p>
              </div>
            </div>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-none">
            <MapPin className="w-5 h-5" id="icon-mappin" />
          </div>
        </div>
        <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mt-5 font-mono">
          Active facilities monitored
        </p>
      </div>

      {/* Parts Financial Tracker */}
      <div id="stat-card-parts" className="bg-white rounded-none border border-blue-100 border-l-4 border-l-blue-500 p-6 flex flex-col justify-between shadow-xs shadow-blue-50/50">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest font-mono">Total Parts Spend</p>
            <h3 className="text-3xl font-bold font-mono text-slate-900 mt-2">
              £{totalPartsCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="p-2.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-none">
            <DollarSign className="w-5 h-5" id="icon-dollar" />
          </div>
        </div>
        <div className="mt-5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Average: <span className="font-mono text-blue-600 font-black">£{totalJobs > 0 ? (totalPartsCost / totalJobs).toFixed(2) : "0.00"}</span> per van
        </div>
      </div>

      {/* Jobs Completed */}
      <div id="stat-card-completed" className="bg-white rounded-none border border-slate-200 p-6 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Completed & Released</p>
            <h3 className="text-4xl font-bold font-sans text-slate-900 mt-2 tracking-tight">{completedJobs}</h3>
          </div>
          <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-none">
            <CheckCircle2 className="w-5 h-5" id="icon-check" />
          </div>
        </div>
        <div className="mt-5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Completion rate of <span className="font-mono text-blue-600 font-black">{totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0}%</span>
        </div>
      </div>
    </div>
  );
}
