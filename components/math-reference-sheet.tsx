'use client';

import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface MathReferenceSheetProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MathReferenceSheet({ isOpen, onToggle }: MathReferenceSheetProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onToggle}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <BookOpen className="h-4 w-4" />
          Reference
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>SAT Math Reference Sheet</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 text-sm">
          {/* Area */}
          <section>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Area</h3>
            <ul className="flex flex-col gap-1 text-gray-700 dark:text-gray-300">
              <li>Rectangle: <span className="font-mono">A = lw</span></li>
              <li>Triangle: <span className="font-mono">A = &frac12;bh</span></li>
              <li>Circle: <span className="font-mono">A = &pi;r&sup2;</span></li>
            </ul>
          </section>

          {/* Volume */}
          <section>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Volume</h3>
            <ul className="flex flex-col gap-1 text-gray-700 dark:text-gray-300">
              <li>Rectangular Prism: <span className="font-mono">V = lwh</span></li>
              <li>Cylinder: <span className="font-mono">V = &pi;r&sup2;h</span></li>
              <li>Sphere: <span className="font-mono">V = (4/3)&pi;r&sup3;</span></li>
              <li>Cone: <span className="font-mono">V = (1/3)&pi;r&sup2;h</span></li>
              <li>Pyramid: <span className="font-mono">V = (1/3)lwh</span></li>
            </ul>
          </section>

          {/* Right Triangles */}
          <section>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Right Triangles</h3>
            <ul className="flex flex-col gap-1 text-gray-700 dark:text-gray-300">
              <li>Pythagorean Theorem: <span className="font-mono">a&sup2; + b&sup2; = c&sup2;</span></li>
              <li>
                Special Triangle 30-60-90:{' '}
                <span className="font-mono">x, x&radic;3, 2x</span>
              </li>
              <li>
                Special Triangle 45-45-90:{' '}
                <span className="font-mono">x, x, x&radic;2</span>
              </li>
            </ul>
          </section>

          {/* Circles */}
          <section>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Circles</h3>
            <ul className="flex flex-col gap-1 text-gray-700 dark:text-gray-300">
              <li>Circumference: <span className="font-mono">C = 2&pi;r</span></li>
              <li>
                Arc Length:{' '}
                <span className="font-mono">L = (&theta;/360) &middot; 2&pi;r</span>
              </li>
              <li>
                Sector Area:{' '}
                <span className="font-mono">A = (&theta;/360) &middot; &pi;r&sup2;</span>
              </li>
            </ul>
          </section>

          {/* Other */}
          <section>
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Other</h3>
            <ul className="flex flex-col gap-1 text-gray-700 dark:text-gray-300">
              <li>The number of degrees of arc in a circle is 360.</li>
              <li>The number of radians in a circle is 2&pi;.</li>
              <li>The sum of the measures of the angles of a triangle is 180 degrees.</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
