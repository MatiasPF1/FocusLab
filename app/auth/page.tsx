import NeuralBackground from "@/components/ui/flow-field-background";

export default function AuthPage() {
  return (
    <div className="relative h-screen w-screen bg-black text-white flex items-center justify-center overflow-hidden">
      <NeuralBackground 
        color="#818cf8"
        trailOpacity={0.1}
        speed={0.8}
      />
      <div className="z-10 absolute">
        <h1 className="text-4xl">Login / Registration</h1>
      </div>
    </div>
  );
}
