import Sidebar from "@/app/(1.1)Home/Sidebar";

export default function AIStudyPage() {
  return (
    <main className="h-screen w-screen bg-black text-white flex">
      <Sidebar />
      <section className="flex-1 flex flex-col items-center p-6 overflow-y-auto" />
    </main>
  );
}
