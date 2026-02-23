'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Active study sessions and practice tests get a minimal layout (no sidebar)
  const isMinimalLayout = /^\/study\/[^/]+$/.test(pathname) || /^\/practice-test\/[^/]+/.test(pathname);

  if (isMinimalLayout) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        {children}
      </main>
    </div>
  );
}
