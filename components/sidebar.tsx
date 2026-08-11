'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  ClipboardCheck,
  Lightbulb,
  BarChart3,
  RotateCcw,
  Users,
  GraduationCap,
  Settings as SettingsIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', href: '/', icon: GraduationCap },
  { label: 'Study Session', href: '/study', icon: BookOpen },
  { label: 'Practice Test', href: '/practice-test', icon: ClipboardCheck },
  { label: 'Wrong Answer Insights', href: '/insights', icon: Lightbulb, star: true },
  { label: 'My Progress', href: '/progress', icon: BarChart3 },
  { label: 'Review Queue', href: '/review', icon: RotateCcw },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white">
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <GraduationCap className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-lg font-bold text-gray-900">SAT Tutor Pro</h1>
          <p className="text-xs text-gray-500">AI-Powered Prep</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
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
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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

      <div className="border-t px-3 py-4">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          <SettingsIcon className="h-5 w-5" />
          Settings
        </Link>
        <Link
          href="/parent"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          <Users className="h-5 w-5" />
          Parent Dashboard
        </Link>
      </div>
    </aside>
  );
}
