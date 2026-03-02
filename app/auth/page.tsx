"use client";
import { useState } from "react";
import NeuralBackground from "@/components/ui/flow-field-background";   // Import the NeuralBackground component
import Link from "next/link";                                          // this is for the back to home link

// Typescript types
type View = "login" | "register" | "forgot-password";                 

export default function AuthPage() {
  const [view, setView] = useState<View>("login"); // State to track which view is currently active

  // Authentication Holder for all the forms (Login, Register, Forgot Password)
  return (
    <div className="relative h-screen w-screen bg-black text-white flex items-center justify-center overflow-hidden">
      <NeuralBackground color="#818cf8" trailOpacity={0.1} speed={0.8} />
      <div className="z-10 relative w-full max-w-sm px-6">
        {view === "login" && <LoginForm onRegister={() => setView("register")} onForgot={() => setView("forgot-password")} />}
        {view === "register" && <RegisterForm onLogin={() => setView("login")} />}
        {view === "forgot-password" && <ForgotPasswordForm onBack={() => setView("login")} />}
      </div>
    </div>
  );
}


//1-Input field Component 
function InputField({ label, type = "text", placeholder }: { label: string; type?: string; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-white/50 uppercase tracking-widest">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-400/60 transition-colors"
      />
    </div>
  );
}


//2-Login Form
function LoginForm({ onRegister, onForgot }: { onRegister: () => void; onForgot: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Welcome back</h2>
        <p className="text-sm text-white/40 mt-1">Sign in to your FocusLab account</p>
      </div>
      <div className="flex flex-col gap-3">
        <InputField label="Email" type="email" placeholder="you@example.com" />
        <InputField label="Password" type="password" placeholder="••••••••" />
      </div>
      <div className="flex justify-end">
        <button onClick={onForgot} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          Forgot password?
        </button>
      </div>
      <button className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-lg transition-colors text-sm">
        Sign In
      </button>
      <div className="flex items-center gap-3 text-white/20 text-xs">
        <div className="flex-1 h-px bg-white/10" />
        <span>or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>
      <p className="text-center text-sm text-white/40">
        Don&apos;t have an account?{" "}
        <button onClick={onRegister} className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
          Sign up
        </button>
      </p>
      <Link href="/" className="flex items-center justify-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors mt-1">
        <span>←</span> Back to home
      </Link>
    </div>
  );
}


//3-Registration Form
function RegisterForm({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Create account</h2>
        <p className="text-sm text-white/40 mt-1">Join FocusLab and start studying smarter</p>
      </div>
      <div className="flex flex-col gap-3">
        <InputField label="Full Name" placeholder="Jane Doe" />
        <InputField label="Email" type="email" placeholder="you@example.com" />
        <InputField label="Password" type="password" placeholder="••••••••" />
        <InputField label="Confirm Password" type="password" placeholder="••••••••" />
      </div>
      <button className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-lg transition-colors text-sm">
        Create Account
      </button>
      <div className="flex items-center gap-3 text-white/20 text-xs">
        <div className="flex-1 h-px bg-white/10" />
        <span>or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>
      <p className="text-center text-sm text-white/40">
        Already have an account?{" "}
        <button onClick={onLogin} className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
          Sign in
        </button>
      </p>
      <Link href="/" className="flex items-center justify-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors mt-1">
        <span>←</span> Back to home
      </Link>
    </div>
  );
}


//4-Forgot Password Form
function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Reset password</h2>
        <p className="text-sm text-white/40 mt-1">We&apos;ll send a reset link to your email</p>
      </div>
      <InputField label="Email" type="email" placeholder="you@example.com" />
      <button className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-lg transition-colors text-sm">
        Send Reset Link
      </button>
      <button onClick={onBack} className="flex items-center justify-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
        <span>←</span> Back to login
      </button>
    </div>
  );
}
