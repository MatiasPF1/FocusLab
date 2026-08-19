import NeuralBackground from "@/app/UI_21stDev_components/flow-field-background";
import Link from "next/link";

{/*

21st Dev Component imported 
DONT TOUCH


*/}



export default function LoginPage() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      <NeuralBackground 
        color="#818cf8"
        trailOpacity={0.1}
        speed={0.8}
      />
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
        <Link href="/(0.1)API_Keys" className="pointer-events-auto inline-block mt-4 px-8 py-3 bg-white text-black font-semibold rounded-full hover:bg-white/90 transition-colors">
          Get Started
        </Link>
      </div>
    </div>
  );
}
