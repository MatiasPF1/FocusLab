import { GLSLHills } from "@/components/UI_Imported_Code/glsl-hills";

export default function AuthPage() {
  return (
    <div className="relative h-screen w-screen bg-black text-white flex items-center justify-center overflow-hidden">
      <GLSLHills />
      <div className="z-10 absolute">
        <h1 className="text-4xl">Login / Registration</h1>
      </div>
    </div>
  );
}
