"use client";

import React, { useState, useEffect } from "react";
import { X, ShieldCheck, Check, AlertCircle, Loader2, ArrowLeft, Edit3, Save, Eye, EyeOff } from "lucide-react";
import { UserProfile } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onAuthSuccess: (profile: UserProfile) => void;
}

type AuthMode = "signin" | "signup" | "forgot";

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthMode>(userProfile.isLoggedIn ? "signin" : "signup");
  const [name, setName] = useState(userProfile.name || "");
  const [email, setEmail] = useState(userProfile.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(userProfile.name || "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setName(userProfile.name || "");
    setNewName(userProfile.name || "");
    setEmail(userProfile.email || "");
    if (!userProfile.isLoggedIn) {
      setMode("signup");
    }
  }, [userProfile]);

  // Strict Password Complexity Evaluator
  const passwordCriteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
  const passedCriteriaCount = Object.values(passwordCriteria).filter(Boolean).length;
  const isPasswordStrictlyValid = passedCriteriaCount === 5;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "signup" || mode === "forgot") {
        if (!isPasswordStrictlyValid) {
          throw new Error("Password must meet all 5 strict security requirements.");
        }
      }

      if (mode === "forgot") {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, newPassword: password }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Password reset failed");
        }

        const updatedProfile: UserProfile = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          isLoggedIn: true,
        };

        onAuthSuccess(updatedProfile);
        setSuccessMsg("Password reset successfully! Signed in.");
        setPassword("");
        setConfirmPassword("");

        setTimeout(() => {
          setSuccessMsg(null);
          onClose();
        }, 800);
        return;
      }

      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/signin";
      const payload = mode === "signup" ? { name, email, password } : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      const updatedProfile: UserProfile = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        isLoggedIn: true,
      };

      onAuthSuccess(updatedProfile);
      setSuccessMsg(mode === "signup" ? "Account created successfully!" : "Signed in successfully!");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile name");
      }

      const updatedProfile: UserProfile = {
        ...userProfile,
        name: data.user.name,
      };

      onAuthSuccess(updatedProfile);
      setIsEditingName(false);
      setSuccessMsg("Display name updated successfully!");
      setTimeout(() => setSuccessMsg(null), 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update name");
    } finally {
      setLoading(false);
    }
  };



  const handleSignOut = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      await fetch("/api/auth/signout", { method: "POST" });
      onAuthSuccess({
        id: "guest",
        name: "",
        email: "",
        isLoggedIn: false,
      });
      onClose();
    } catch {
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#0e0e10] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 sm:p-8">
        {/* Close Button - Only visible for authenticated users managing profile */}
        {userProfile.isLoggedIn && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Centered LOT Logo & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 flex items-center justify-center mb-3">
            <img
              src="/lot-logo.png"
              alt="LOT Logo"
              className="w-14 h-14 object-contain drop-shadow-none"
            />
          </div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            {userProfile.isLoggedIn
              ? "Account Profile"
              : mode === "forgot"
              ? "Reset your password"
              : mode === "signup"
              ? "Create your LOT account"
              : "Sign in to LOT"}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {userProfile.isLoggedIn
              ? "Manage your display name and session"
              : mode === "forgot"
              ? "Create a new strong, secure password"
              : mode === "signup"
              ? "Sign up is mandatory to start using LOT AI"
              : "Welcome back! Enter your credentials"}
          </p>
        </div>

        {/* Error / Success Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-center space-x-2 text-xs text-red-200 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center space-x-2 text-xs text-emerald-200 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Profile Card View when Logged In */}
        {userProfile.isLoggedIn ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#141416] border border-zinc-800 space-y-3">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  Display Name
                </span>
                {isEditingName ? (
                  <form onSubmit={handleUpdateName} className="mt-1 flex items-center space-x-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      placeholder="Enter new display name"
                      className="flex-1 bg-[#1c1c20] text-white text-xs px-3 py-2 rounded-xl border border-zinc-700 focus:border-zinc-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={loading || !newName.trim()}
                      className="px-3 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors flex items-center space-x-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingName(false);
                        setNewName(userProfile.name);
                      }}
                      className="px-2.5 py-2 text-zinc-400 hover:text-white text-xs rounded-xl hover:bg-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-medium text-white">{userProfile.name}</p>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors flex items-center space-x-1 text-xs"
                      title="Edit display name"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Edit</span>
                    </button>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  Email Address
                </span>
                <p className="text-sm text-zinc-300 font-mono mt-0.5">{userProfile.email}</p>
              </div>

              <div className="pt-1 flex items-center space-x-1.5 text-emerald-400 text-xs font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>Active Session Protected</span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full py-2.5 bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40 font-semibold text-xs rounded-xl transition-all duration-150 active:scale-[0.98]"
            >
              Sign Out
            </button>
          </div>
        ) : (
          /* Sign In / Sign Up / Forgot Form */
          <div className="space-y-4">
            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === "signup" && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-300">Your Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Durga prasadu"
                    className="w-full bg-[#141416] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zinc-300">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  className="w-full bg-[#141416] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-300">
                    {mode === "forgot" ? "New Password" : "Password"}
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setErrorMsg(null);
                      }}
                      className="text-[11px] text-zinc-400 hover:text-white transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-[#141416] text-white text-xs px-3.5 py-2.5 pr-10 rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Strict Password Creation Security Checklist & Strength Meter */}
              {(mode === "signup" || mode === "forgot") && password.length > 0 && (
                <div className="p-3 rounded-xl bg-[#141416] border border-zinc-800/80 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-zinc-400 uppercase tracking-wider">Password Strength</span>
                    <span
                      className={`font-semibold ${
                        isPasswordStrictlyValid
                          ? "text-emerald-400"
                          : passedCriteriaCount >= 3
                          ? "text-amber-400"
                          : "text-red-400"
                      }`}
                    >
                      {isPasswordStrictlyValid ? "Strong (Ready)" : passedCriteriaCount >= 3 ? "Medium" : "Weak"}
                    </span>
                  </div>

                  {/* Progress Bars */}
                  <div className="grid grid-cols-5 gap-1.5 h-1.5">
                    {[1, 2, 3, 4, 5].map((step) => (
                      <div
                        key={step}
                        className={`rounded-full transition-all duration-200 ${
                          passedCriteriaCount >= step
                            ? isPasswordStrictlyValid
                              ? "bg-emerald-500"
                              : passedCriteriaCount >= 3
                              ? "bg-amber-500"
                              : "bg-red-500"
                            : "bg-zinc-800"
                        }`}
                      />
                    ))}
                  </div>

                  {/* 5-Point Strict Requirements Checklist */}
                  <div className="grid grid-cols-2 gap-1 pt-1 text-[10px]">
                    <div className={`flex items-center space-x-1.5 ${passwordCriteria.length ? "text-emerald-400" : "text-zinc-500"}`}>
                      <Check className={`w-3 h-3 ${passwordCriteria.length ? "opacity-100" : "opacity-30"}`} />
                      <span>8+ Characters</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${passwordCriteria.uppercase ? "text-emerald-400" : "text-zinc-500"}`}>
                      <Check className={`w-3 h-3 ${passwordCriteria.uppercase ? "opacity-100" : "opacity-30"}`} />
                      <span>1 Uppercase (A-Z)</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${passwordCriteria.lowercase ? "text-emerald-400" : "text-zinc-500"}`}>
                      <Check className={`w-3 h-3 ${passwordCriteria.lowercase ? "opacity-100" : "opacity-30"}`} />
                      <span>1 Lowercase (a-z)</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${passwordCriteria.number ? "text-emerald-400" : "text-zinc-500"}`}>
                      <Check className={`w-3 h-3 ${passwordCriteria.number ? "opacity-100" : "opacity-30"}`} />
                      <span>1 Number (0-9)</span>
                    </div>
                    <div className={`col-span-2 flex items-center space-x-1.5 ${passwordCriteria.special ? "text-emerald-400" : "text-zinc-500"}`}>
                      <Check className={`w-3 h-3 ${passwordCriteria.special ? "opacity-100" : "opacity-30"}`} />
                      <span>1 Special Symbol (!@#$%^&*...)</span>
                    </div>
                  </div>
                </div>
              )}

              {mode === "forgot" && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-300">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-[#141416] text-white text-xs px-3.5 py-2.5 pr-10 rounded-xl border border-zinc-800 focus:border-zinc-500 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || ((mode === "signup" || mode === "forgot") && !isPasswordStrictlyValid)}
                className="w-full py-2.5 mt-2 bg-white hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-xs rounded-xl shadow-lg transition-all duration-150 active:scale-[0.98] flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : (
                  <span>
                    {mode === "forgot"
                      ? "Reset Password & Sign In"
                      : mode === "signup"
                      ? "Create Account"
                      : "Sign In"}
                  </span>
                )}
              </button>
            </form>

            {/* Toggle Modes */}
            <div className="pt-2 text-center text-xs text-zinc-400">
              {mode === "forgot" ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorMsg(null);
                  }}
                  className="text-white hover:underline font-medium inline-flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back to Sign In</span>
                </button>
              ) : mode === "signup" ? (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setErrorMsg(null);
                    }}
                    className="text-white hover:underline font-semibold"
                  >
                    Sign In
                  </button>
                </p>
              ) : (
                <p>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setErrorMsg(null);
                    }}
                    className="text-white hover:underline font-semibold"
                  >
                    Sign Up
                  </button>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
