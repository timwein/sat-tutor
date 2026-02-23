import Link from 'next/link';
import { GraduationCap, ArrowLeft } from 'lucide-react';

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-3 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-blue-600" />
          <span className="hidden text-lg font-bold text-gray-900 sm:inline">SAT Tutor Pro</span>
        </div>
        <Link
          href="/study"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Exit Session</span>
        </Link>
      </header>
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
