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
  KeyRound,
  Lightbulb,
  Menu,
  RotateCcw,
  SearchCheck,
  Settings as SettingsIcon,
  Shield,
  SpellCheck,
  Trophy,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { SignOutButton } from '@/components/sign-out-button';
import { cn } from '@/lib/utils';
import type { Viewer } from '@/lib/types';

type MenuItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
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
      { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    ],
  },
];

const ACCOUNT_ITEMS: MenuItem[] = [
  { label: 'Settings', href: '/settings', icon: SettingsIcon },
  { label: 'Parent Dashboard', href: '/parent', icon: Users },
];

const ADMIN_ITEM: MenuItem = { label: 'Admin', href: '/admin', icon: Shield };

/** Full navigation drawer for mobile - everything the desktop sidebar has. */
export function MobileMenu({ viewer }: { viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const firstName = viewer.name.trim().split(/\s+/)[0] || viewer.name;

  const sections = viewer.isAdmin
    ? [...MENU_SECTIONS, { title: 'Admin', items: [ADMIN_ITEM] }]
    : MENU_SECTIONS;

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function renderItem(item: MenuItem) {
    const Icon = item.icon;
    const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
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
  }

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
              {sections.map((section) => (
                <div key={section.title} className="mb-4">
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {section.title}
                  </p>
                  {section.items.map(renderItem)}
                </div>
              ))}

              <div className="mb-4">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Account
                </p>
                {renderItem(ACCOUNT_ITEMS[0])}
                {!viewer.hasApiKey && (
                  <Link
                    href="/settings#api-key"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-700 active:bg-amber-50 dark:text-amber-400 dark:active:bg-amber-950/40"
                  >
                    <KeyRound className="h-5 w-5 shrink-0" />
                    Add API key
                  </Link>
                )}
                {renderItem(ACCOUNT_ITEMS[1])}
              </div>
            </nav>

            <div className="border-t px-2 py-3 dark:border-gray-800">
              <div className="flex items-center gap-3 px-3 py-2">
                <UserCircle className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" />
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={viewer.name}>
                  {firstName}
                </span>
              </div>
              <SignOutButton className="py-2.5 text-gray-700 active:bg-gray-100 dark:text-gray-300 dark:active:bg-gray-800" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
