import { GLSLHills } from "@/components/UI_Imported_Code/glsl-hills";

export default function LoginPage() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      <GLSLHills />
      <div className="space-y-6 pointer-events-none z-10 text-center absolute">
        <h1 className="font-semibold text-7xl whitespace-pre-wrap">
          <span className="italic text-6xl font-bold">
            FocusLab<br />
          </span>
      
        </h1>
        <p className="text-sm text-primary/60">
          Centralized platform for productivity and organization<br />
          to help you stay focused, created by students, for students.
        </p>
        <button className="pointer-events-auto mt-4 px-8 py-3 bg-white text-black font-semibold rounded-full hover:bg-white/90 transition-colors">
          Get Started
        </button>
      </div>
    </div>
  );
}
