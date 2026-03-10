import { ImageWorkspace } from '@/components/ImageWorkspace';

export default function Page() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans">
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-950 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Lumina Edit</h1>
        </div>
        <div className="text-sm text-zinc-400 font-medium">Batch Image Processing</div>
      </header>
      <ImageWorkspace />
    </main>
  );
}
