'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { BottomNav } from '@/components/bottom-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileMenu } from '@/components/mobile-menu';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Active study sessions and practice tests get a minimal layout (no sidebar)
  const isMinimalLayout = /^\/study\/[^/]+$/.test(pathname) || /^\/practice-test\/[^/]+/.test(pathname);

  if (isMinimalLayout) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Mobile header */}
      <header className="flex items-center justify-between border-b dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-blue-600" />
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">SAT Tutor Pro</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle className="text-gray-500 dark:text-gray-400 active:text-gray-700 dark:active:text-gray-300" />
          <MobileMenu />
        </div>
      </header>

      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800/60 p-4 pb-20 md:p-8 md:pb-8">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
