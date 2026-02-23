'use client';

import { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ClassifiedQuestion } from '@/lib/pdf-question-parser';

interface QuestionUploaderProps {
  studentId: string;
}

type Step = 'upload' | 'processing' | 'preview' | 'done';

const SKILL_NAMES: Record<string, string> = {
  'RW-01': 'Central Ideas & Details',
  'RW-02': 'Command of Evidence (Textual)',
  'RW-03': 'Command of Evidence (Quantitative)',
  'RW-04': 'Inferences',
  'RW-05': 'Words in Context',
  'RW-06': 'Text Structure and Purpose',
  'RW-07': 'Cross-Text Connections',
  'RW-08': 'Rhetorical Synthesis',
  'RW-09': 'Transitions',
  'RW-10': 'Boundaries (Sentences)',
  'RW-11': 'Form, Structure, and Sense',
  'M-01': 'Linear Equations (one var)',
  'M-02': 'Linear Equations (two var)',
  'M-03': 'Linear Functions',
  'M-04': 'Systems of Linear Equations',
  'M-05': 'Linear Inequalities',
  'M-06': 'Nonlinear Equations',
  'M-07': 'Equivalent Expressions',
  'M-08': 'Quadratics',
  'M-09': 'Exponential Functions',
  'M-10': 'Ratios, Rates, Proportions',
  'M-11': 'Percentages',
  'M-12': 'One-Variable Data',
  'M-13': 'Two-Variable Data',
  'M-14': 'Probability',
  'M-15': 'Sample Statistics',
  'M-16': 'Area and Volume',
  'M-17': 'Lines, Angles, Triangles',
  'M-18': 'Right Triangles & Trig',
  'M-19': 'Circles',
};

export function QuestionUploader({ studentId }: QuestionUploaderProps) {
  const [step, setStep] = useState<Step>('upload');
  const [testLabel, setTestLabel] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [questions, setQuestions] = useState<ClassifiedQuestion[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    matched: number;
    classified: number;
    warnings: string[];
  } | null>(null);
  const [insertedCount, setInsertedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(
        (f) => f.type === 'application/pdf'
      );
      setFiles((prev) => [...prev, ...newFiles]);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (!testLabel.trim()) {
      setError('Please enter a test label');
      return;
    }
    if (files.length < 2) {
      setError('Please upload at least 2 PDF files (questions + answers)');
      return;
    }

    setError(null);
    setStep('processing');
    setProcessingStatus('Uploading and extracting text from PDFs...');

    try {
      const formData = new FormData();
      formData.append('testLabel', testLabel.trim());
      for (const file of files) {
        formData.append('files', file);
      }

      setProcessingStatus('Processing PDFs with AI... This may take up to 60 seconds.');

      const res = await fetch('/api/parent/upload-questions', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let message = 'Upload failed';
        try {
          const data = await res.json();
          message = data.error || message;
        } catch {
          const text = await res.text();
          if (res.status === 413) message = 'PDF files are too large. Try smaller files.';
          else if (res.status === 504) message = 'Processing timed out. Try fewer files.';
          else message = text || `Server error (${res.status})`;
        }
        throw new Error(message);
      }

      const data = await res.json();
      setQuestions(data.questions);
      setSummary(data.summary);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStep('upload');
    }
  }

  async function handleConfirm() {
    setStep('processing');
    setProcessingStatus('Saving questions to database...');

    try {
      const res = await fetch('/api/parent/upload-questions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, testLabel: testLabel.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await res.json();
      setInsertedCount(data.inserted);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setStep('preview');
    }
  }

  function reset() {
    setStep('upload');
    setTestLabel('');
    setFiles([]);
    setError(null);
    setQuestions([]);
    setSummary(null);
    setInsertedCount(0);
  }

  // Step 1: Upload
  if (step === 'upload') {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              Upload SAT Practice Test PDFs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Upload the official College Board Bluebook practice test PDFs.
              Questions, answers, and explanations should each be in a separate
              PDF file. The system will automatically detect which file is which.
            </p>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Test label */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Test Label
              </label>
              <input
                type="text"
                value={testLabel}
                onChange={(e) => setTestLabel(e.target.value)}
                placeholder="e.g., Practice Test 1"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 md:text-sm"
              />
              <p className="text-xs text-gray-400">
                Used to generate unique question IDs (e.g., cb_practice_test_1_rw_m1_q1)
              </p>
            </div>

            {/* File upload */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-6 py-8 text-sm text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600"
              >
                <FileText className="h-6 w-6" />
                <span>Click to select PDF files (or drag & drop)</span>
              </button>
            </div>

            {/* Selected files */}
            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Selected files ({files.length})
                </p>
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-red-500" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs text-gray-400">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={files.length < 2 || !testLabel.trim()}
              className="w-full"
            >
              Upload & Process
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Processing
  if (step === 'processing') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">{processingStatus}</p>
          <p className="text-xs text-gray-400">
            Please don&apos;t close this page
          </p>
        </CardContent>
      </Card>
    );
  }

  // Step 3: Preview
  if (step === 'preview' && summary) {
    const rwQuestions = questions.filter((q) => q.section === 'reading_writing');
    const mathQuestions = questions.filter((q) => q.section === 'math');

    return (
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>
              Parsed Results — {testLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <span className="text-2xl font-bold">{summary.total}</span>
                <p className="text-xs text-gray-500">Questions found</p>
              </div>
              <div>
                <span className="text-2xl font-bold text-green-600">
                  {summary.matched}
                </span>
                <p className="text-xs text-gray-500">Matched w/ answers</p>
              </div>
              <div>
                <span className="text-2xl font-bold text-blue-600">
                  {summary.classified}
                </span>
                <p className="text-xs text-gray-500">Classified</p>
              </div>
            </div>
            {summary.warnings.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-xs font-medium text-amber-600">
                  Warnings ({summary.warnings.length}):
                </p>
                {summary.warnings.slice(0, 5).map((w, i) => (
                  <p key={i} className="text-xs text-amber-500">
                    {w}
                  </p>
                ))}
                {summary.warnings.length > 5 && (
                  <p className="text-xs text-amber-400">
                    ...and {summary.warnings.length - 5} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Questions table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Reading & Writing ({rwQuestions.length}) | Math ({mathQuestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-2">#</th>
                    <th className="pb-2 pr-2">Module</th>
                    <th className="pb-2 pr-2">Sub-Skill</th>
                    <th className="pb-2 pr-2">Diff</th>
                    <th className="pb-2 pr-2">Ans</th>
                    <th className="pb-2">Question</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 text-gray-400">
                        {q.questionNumber}
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        <Badge variant="outline" className="text-xs">
                          {q.module}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        <span
                          className="text-xs"
                          title={SKILL_NAMES[q.subSkillId] ?? q.subSkillId}
                        >
                          {q.subSkillId}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2">{q.difficulty}</td>
                      <td className="py-1.5 pr-2 font-medium">
                        {q.correctAnswer}
                      </td>
                      <td className="py-1.5 max-w-xs truncate text-gray-600">
                        {q.questionText.slice(0, 60)}
                        {q.questionText.length > 60 ? '...' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={reset} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            Confirm & Save {questions.length} Questions
          </Button>
        </div>
      </div>
    );
  }

  // Step 4: Done
  if (step === 'done') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <CheckCircle className="h-12 w-12 text-green-600" />
          <h3 className="text-lg font-semibold">Import Complete</h3>
          <p className="text-sm text-gray-600">
            {insertedCount} questions from &ldquo;{testLabel}&rdquo; have been
            imported to the question bank.
          </p>
          <p className="text-xs text-gray-400">
            These questions will now appear in study sessions.
          </p>
          <Button onClick={reset} variant="outline">
            Upload Another Test
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
