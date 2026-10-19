import React, { useState, useEffect } from "react";
import { Wrench, Shield, KeyRound, User, Check, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";

interface LoginScreenProps {
  onLogin: (userName: string, isAdmin: boolean) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mechanics, setMechanics] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [passcode, setPasscode] = useState<string>("");
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasscode, setShowPasscode] = useState<boolean>(false);

  // Load mechanics names from API
  useEffect(() => {
    setLoading(true);
    fetch("/api/mechanics")
      .then(res => res.ok ? res.json() : Promise.reject("API error"))
      .then((list: string[]) => {
        setMechanics(list);
        if (list.length > 0) setSelectedUser(list[0]);
        setLoading(false);
      })
      .catch(() => {
        setMechanics([]);
        setLoading(false);
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setError("Please select your name.");
      return;
    }
    if (!passcode.trim()) {
      setError("Please enter your passcode.");
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/mechanics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedUser, passcode: passcode.trim() })
      });
      const data = await res.json();
      if (data.valid) {
        onLogin(selectedUser, data.isAdmin);
      } else {
        setError("Incorrect passcode. Please try again.");
        setPasscode("");
      }
    } catch {
      setError("Authentication error. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/mechanics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "admin", passcode: passcode.trim() })
      });
      const data = await res.json();
      if (data.valid && data.isAdmin) {
        onLogin("Administrator", true);
      } else {
        setError("Invalid passcode. Access denied.");
        setPasscode("");
      }
    } catch {
      setError("Authentication error. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen flex items-center justify-center bg-slate-50/50 p-4 font-sans text-slate-900 antialiased">
      <div id="login-card" className="w-full max-w-md bg-white border border-slate-200 rounded-none shadow-xs overflow-hidden flex flex-col">
        
        {/* Banner */}
        <div className="bg-blue-600 text-white p-6 text-center space-y-3">
          <div className="w-12 h-12 bg-white/10 rounded-none border border-white/20 flex items-center justify-center mx-auto text-white shadow-xs">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Pitlane</h1>
            <p className="text-[10px] text-blue-100 font-mono font-bold uppercase tracking-widest mt-1">Fleet Maintenance &amp; Workshop Operations</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-white">
          <button
            id="tab-login-mechanic"
            type="button"
            onClick={() => { setIsAdminMode(false); setError(null); setPasscode(""); setShowPasscode(false); }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer ${
              !isAdminMode ? "border-blue-600 text-blue-600 font-black" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Mechanic Login
          </button>
          <button
            id="tab-login-admin"
            type="button"
            onClick={() => { setIsAdminMode(true); setError(null); setPasscode(""); setShowPasscode(false); }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer ${
              isAdminMode ? "border-blue-600 text-blue-600 font-black" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Admin Access
          </button>
        </div>

        {/* Error notice */}
        {error && (
          <div className="mx-6 mt-6 p-3.5 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Form area */}
        <div className="p-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">Syncing system roster...</span>
            </div>
          ) : !isAdminMode ? (
            /* Mechanic Login Form */
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Name selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Select Your Name</label>
                {mechanics.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1 border border-slate-100 p-1.5 bg-slate-50/50">
                    {mechanics.map((name) => {
                      const isSel = selectedUser === name;
                      return (
                        <button
                          id={`user-select-${name}`}
                          key={name}
                          type="button"
                          onClick={() => { setSelectedUser(name); setError(null); }}
                          className={`w-full text-left py-2.5 px-3 border transition-all text-xs flex items-center justify-between rounded-none cursor-pointer ${
                            isSel
                              ? "bg-blue-600 border-blue-600 text-white font-bold shadow-xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <User className={`w-3.5 h-3.5 ${isSel ? "text-white" : "text-slate-400"}`} />
                            {name}
                          </span>
                          {isSel && <Check className="w-4 h-4 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 text-center">
                    No accounts found. Ask admin to create your account.
                  </div>
                )}
              </div>

              {/* Passcode field */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Enter Your Passcode</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    id="input-mechanic-passcode"
                    type={showPasscode ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="••••••"
                    value={passcode}
                    onChange={(e) => { setPasscode(e.target.value); setError(null); }}
                    required
                    disabled={verifying || mechanics.length === 0}
                    className="w-full bg-slate-50 border border-slate-200 rounded-none pl-10 pr-10 py-3 text-xs tracking-widest focus:outline-none focus:border-blue-600 text-slate-900 disabled:opacity-50 font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    disabled={verifying || mechanics.length === 0}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    title={showPasscode ? "Hide Passcode" : "Show Passcode"}
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="btn-login-submit"
                type="submit"
                disabled={verifying || !selectedUser || mechanics.length === 0}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer rounded-none shadow-xs flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {verifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : "Enter Yard Workspace"}
              </button>
            </form>
          ) : (
            /* Admin Login Form */
            <form onSubmit={handleAdminLogin} className="space-y-5">
              <div className="bg-blue-50/40 p-4 border border-blue-100 rounded-none flex gap-3">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter the administrator passcode to manage mechanics, passcodes, and system settings.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Admin Passcode</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    id="input-admin-passcode"
                    type={showPasscode ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="••••••"
                    value={passcode}
                    onChange={(e) => { setPasscode(e.target.value); setError(null); }}
                    required
                    disabled={verifying}
                    className="w-full bg-slate-50 border border-slate-200 rounded-none pl-10 pr-10 py-3 text-xs tracking-widest focus:outline-none focus:border-blue-600 text-slate-900 disabled:opacity-50 font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    disabled={verifying}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    title={showPasscode ? "Hide Passcode" : "Show Passcode"}
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="btn-admin-submit"
                type="submit"
                disabled={verifying}
                className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer rounded-none shadow-xs flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {verifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : <><Shield className="w-4 h-4 text-blue-400" /> Authenticate &amp; Unlock</>}
              </button>
            </form>
          )}
        </div>

        {/* Policy footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 text-center text-[9px] text-slate-400 font-mono uppercase tracking-wider">
          Pitlane — Authorized Workshop Personnel Only
        </div>

      </div>
    </div>
  );
}
