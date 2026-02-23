'use client';

import { Calculator, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DesmosCalculatorProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function DesmosCalculator({ isOpen, onToggle }: DesmosCalculatorProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="flex flex-col rounded-lg border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium text-gray-700">Calculator</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onToggle}
              aria-label="Close calculator"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <iframe
            src="https://www.desmos.com/testing/sat"
            title="Desmos SAT Calculator"
            width={400}
            height={500}
            className="rounded-b-lg"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      ) : (
        <Button onClick={onToggle} className="gap-2 shadow-lg">
          <Calculator className="h-4 w-4" />
          Calculator
        </Button>
      )}
    </div>
  );
}
