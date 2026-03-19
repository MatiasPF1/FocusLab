"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";   // to redirect after successful login
import { signIn } from "next-auth/react";       // NextAuth's client-side login function
import NeuralBackground from "@/components/ui/flow-field-background";
import Link from "next/link";


// Typescript types
type View = "login" | "register" | "forgot-password"; 


export default function AuthPage() {
  const [view, setView] = useState<View>("login"); // State to track which view is currently active, default is "login"
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
function InputField({ label, type = "text", placeholder, value, onChange }: {
  label: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
})
{
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-white/50 uppercase tracking-widest">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-400/60 transition-colors"
      />
    </div>
  );
}


//2-Login Form
function LoginForm({ onRegister, onForgot }: { onRegister: () => void; onForgot: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);

    // signIn("credentials") calls POST /api/auth/signin/credentials
    // which runs the authorize() function in lib/auth.ts
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false, // don't auto-redirect — we handle it ourselves below
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    // Login succeeded — redirect to the dashboard
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Welcome back</h2>
        <p className="text-sm text-white/40 mt-1">Sign in to your FocusLab account</p>
      </div>
      <div className="flex flex-col gap-3">
        <InputField label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        <InputField label="Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <button onClick={onForgot} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          Forgot password?
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm">
        {loading ? "Signing in..." : "Sign In"}
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
  // One state variable per field
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // UI feedback
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");

    // Client-side check before hitting the server
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      // Show error from the API (e.g. "Email already in use.")
      setError(data.error);
      return;
    }

    // Success — switch to login so the user can sign in
    onLogin();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Create account</h2>
        <p className="text-sm text-white/40 mt-1">Join FocusLab and start studying smarter</p>
      </div>
      <div className="flex flex-col gap-3">
        <InputField label="Full Name" placeholder="Jane Doe" value={name} onChange={e => setName(e.target.value)} />
        <InputField label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        <InputField label="Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
        <InputField label="Confirm Password" type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm">
        {loading ? "Creating..." : "Create Account"}
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
