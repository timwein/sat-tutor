'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BookMarked,
  BookOpen,
  ClipboardCheck,
  Dumbbell,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  Menu,
  RotateCcw,
  SearchCheck,
  Settings as SettingsIcon,
  SpellCheck,
  Users,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

const MENU_SECTIONS: {
  title: string;
  items: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    title: 'Practice',
    items: [
      { label: 'Dashboard', href: '/', icon: GraduationCap },
      { label: 'Study Session', href: '/study', icon: BookOpen },
      { label: 'Practice Test', href: '/practice-test', icon: ClipboardCheck },
      { label: 'Review Queue', href: '/review', icon: RotateCcw },
    ],
  },
  {
    title: 'Verbal Tools',
    items: [
      { label: 'Word Bank', href: '/word-bank', icon: BookMarked },
      { label: 'Word Detective', href: '/detective', icon: SearchCheck },
      { label: 'Grammar Map', href: '/grammar', icon: SpellCheck },
      { label: 'Transition Gym', href: '/gym', icon: Dumbbell },
      { label: 'Strategy Lab', href: '/strategy', icon: FlaskConical },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Wrong Answer Insights', href: '/insights', icon: Lightbulb },
      { label: 'My Progress', href: '/progress', icon: BarChart3 },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Settings', href: '/settings', icon: SettingsIcon },
      { label: 'Parent Dashboard', href: '/parent', icon: Users },
    ],
  },
];

/** Full navigation drawer for mobile - everything the desktop sidebar has. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close when navigation happens
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="text-gray-500 dark:text-gray-400 active:text-gray-700 dark:active:text-gray-300"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-800">
              <span className="font-semibold">Menu</span>
              <div className="flex items-center gap-3">
                <ThemeToggle className="text-gray-500 dark:text-gray-400" />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="text-gray-500 dark:text-gray-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <nav className="flex-1 px-2 py-3">
              {MENU_SECTIONS.map((section) => (
                <div key={section.title} className="mb-4">
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {section.title}
                  </p>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                          isActive
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                            : 'text-gray-700 active:bg-gray-100 dark:text-gray-300 dark:active:bg-gray-800'
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
