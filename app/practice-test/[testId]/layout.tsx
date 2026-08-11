export default function PracticeTestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">SAT Practice</span>
        <a href="/practice-test" className="text-sm text-blue-600 hover:underline">Exit Test</a>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
