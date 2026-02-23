'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Lightbulb, BarChart3, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Study', href: '/study', icon: BookOpen },
  { label: 'Insights', href: '/insights', icon: Lightbulb },
  { label: 'Progress', href: '/progress', icon: BarChart3 },
  { label: 'Review', href: '/review', icon: RotateCcw },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white md:hidden">
      <div className="flex">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + '/');

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-500 active:text-gray-700'
              )}
            >
              <tab.icon className={cn('h-6 w-6', isActive && 'text-blue-600')} />
              {tab.label}
            </Link>
          );
        })}
      </div>
      {/* Safe area spacer for iPhone home bar */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
