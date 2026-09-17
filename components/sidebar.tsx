'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { SignOutButton } from '@/components/sign-out-button';
import {
  BookOpen,
  BookMarked,
  ClipboardCheck,
  Lightbulb,
  BarChart3,
  RotateCcw,
  Users,
  GraduationCap,
  Settings as SettingsIcon,
  SpellCheck,
  Dumbbell,
  FlaskConical,
  SearchCheck,
  Trophy,
  Shield,
  KeyRound,
  UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Viewer } from '@/lib/types';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  star?: boolean;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: GraduationCap },
  { label: 'Study Session', href: '/study', icon: BookOpen },
  { label: 'Practice Test', href: '/practice-test', icon: ClipboardCheck },
  { label: 'Wrong Answer Insights', href: '/insights', icon: Lightbulb, star: true },
  { label: 'My Progress', href: '/progress', icon: BarChart3 },
  { label: 'Review Queue', href: '/review', icon: RotateCcw },
  { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  { label: 'Word Bank', href: '/word-bank', icon: BookMarked },
  { label: 'Word Detective', href: '/detective', icon: SearchCheck },
  { label: 'Grammar Map', href: '/grammar', icon: SpellCheck },
  { label: 'Transition Gym', href: '/gym', icon: Dumbbell },
  { label: 'Strategy Lab', href: '/strategy', icon: FlaskConical },
];

const adminItem: NavItem = { label: 'Admin', href: '/admin', icon: Shield };

export function Sidebar({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const items = viewer.isAdmin ? [...navItems, adminItem] : navItems;
  const firstName = viewer.name.trim().split(/\s+/)[0] || viewer.name;

  return (
    <aside className="flex h-full w-64 flex-col border-r dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b dark:border-gray-800 px-6 py-4">
        <GraduationCap className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">SAT Tutor Pro</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">AI-Powered Prep</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {item.star && (
                <span className="ml-auto text-xs text-yellow-600">★</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t dark:border-gray-800 px-3 py-4">
        <div className="flex items-center justify-between rounded-lg px-3 py-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Theme</span>
          <ThemeToggle className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100" />
        </div>
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <SettingsIcon className="h-5 w-5" />
          Settings
        </Link>
        {!viewer.hasApiKey && (
          <Link
            href="/settings#api-key"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
          >
            <KeyRound className="h-5 w-5" />
            Add API key
          </Link>
        )}
        <Link
          href="/parent"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Users className="h-5 w-5" />
          Parent Dashboard
        </Link>
      </div>

      <div className="border-t dark:border-gray-800 px-3 py-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <UserCircle className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={viewer.name}>
            {firstName}
          </span>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
