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
import type {
  ClassifiedQuestion,
  ParsedQuestion,
  ParsedAnswer,
  ParsedExplanation,
  PdfType,
  MergedQuestion,
  ClassificationResult,
} from '@/lib/pdf-question-parser';

interface QuestionUploaderProps {
  studentId: string;
}

type Step = 'upload' | 'review_types' | 'processing' | 'preview' | 'done';

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

// Client-side PDF type detection (same logic as server)
function detectPdfType(text: string): PdfType {
  const lower = text.toLowerCase();
  const first5000 = lower.slice(0, 5000);

  // Answer key: dense pattern of question numbers with single-letter answers
  const answerPattern = /(?:correct answer|answer[:\s]|^[\s]*\d+[.)]\s*[abcd]\s*$)/gim;
  const answerMatches = first5000.match(answerPattern);
  if (answerMatches && answerMatches.length >= 5) return 'answers';

  // Answer key table patterns (Number | Domain | Skill | Answer)
  if (first5000.includes('answer') && first5000.includes('domain') && first5000.includes('skill')) {
    return 'answers';
  }

  // Explanations: check a larger portion since keywords may appear later
  const first20000 = lower.slice(0, 20000);
  const explanationKeywords = [
    'rationale', 'explanation', 'choice a is', 'choice b is',
    'choice c is', 'choice d is', 'the correct answer is',
    'this is correct because', 'is the best answer',
    'is incorrect because', 'is correct because',
    'correct answer:', 'distractor', 'key/rationale',
  ];
  const explanationHits = explanationKeywords.filter((kw) => first20000.includes(kw)).length;
  if (explanationHits >= 2) return 'explanations';

  return 'questions';
}

// Client-side deterministic matching (same logic as server)
function matchAndMerge(
  questions: ParsedQuestion[],
  answers: ParsedAnswer[],
  explanations: ParsedExplanation[]
): { merged: MergedQuestion[]; warnings: string[] } {
  const warnings: string[] = [];
  const answerMap = new Map<string, ParsedAnswer>();
  for (const a of answers) answerMap.set(`${a.module}_${a.questionNumber}`, a);
  const explanationMap = new Map<string, ParsedExplanation>();
  for (const e of explanations) explanationMap.set(`${e.module}_${e.questionNumber}`, e);

  const merged: MergedQuestion[] = [];
  for (const q of questions) {
    const key = `${q.module}_${q.questionNumber}`;
    const answer = answerMap.get(key);
    if (!answer) { warnings.push(`No answer found for ${q.module} Q${q.questionNumber}`); continue; }
    const explanation = explanationMap.get(key);
    if (!explanation) warnings.push(`No explanation found for ${q.module} Q${q.questionNumber}`);
    merged.push({
      ...q,
      correctAnswer: answer.correctAnswer,
      explanation: explanation?.explanation ?? null,
      distractorAnalysis: explanation?.distractorAnalysis ?? {},
    });
  }
  return { merged, warnings };
}

async function apiCall<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const ct = res.headers.get('content-type') || '';
    let msg = `Server error (${res.status})`;
    if (ct.includes('application/json')) {
      const data = await res.json();
      msg = data.error || msg;
    }
    throw new Error(msg);
  }
  return res.json();
}

// Parse API call — answers return JSON, questions/explanations stream raw text
async function parseApiCall<T>(body: unknown): Promise<T> {
  const res = await fetch('/api/parent/upload-questions/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const ct = res.headers.get('content-type') || '';
    let msg = `Server error (${res.status})`;
    if (ct.includes('application/json')) {
      const data = await res.json();
      msg = data.error || msg;
    }
    throw new Error(msg);
  }

  // Answers return plain JSON
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return res.json();
  }

  // Questions/explanations: Claude's raw text is streamed, accumulate it all
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
  }

  // Check for server error
  if (accumulated.includes('__ERROR__:')) {
    const errMsg = accumulated.split('__ERROR__:').pop()?.trim() || 'Server error';
    throw new Error(errMsg);
  }

  // Remove the __DONE__ marker
  accumulated = accumulated.replace('__DONE__', '').trim();

  // Extract JSON array from Claude's response
  const jsonMatch = accumulated.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('Could not find JSON in response. First 500 chars:', accumulated.slice(0, 500));
    throw new Error('Could not extract JSON from AI response');
  }

  const jsonStr = jsonMatch[0];
  const type = (body as { type: string }).type as PdfType;

  try {
    if (type === 'questions') {
      const parsed = JSON.parse(jsonStr);
      const data = parsed.map((q: ParsedQuestion) => ({
        module: q.module,
        questionNumber: q.questionNumber,
        section: (q.module?.toLowerCase().includes('math') ? 'math' : 'reading_writing') as 'math' | 'reading_writing',
        questionText: q.questionText,
        passageText: q.passageText || null,
        answerChoices: q.answerChoices,
      }));
      return { type, data } as T;
    } else {
      const parsed = JSON.parse(jsonStr);
      const data = parsed.map((e: ParsedExplanation) => ({
        module: e.module,
        questionNumber: e.questionNumber,
        explanation: e.explanation,
        distractorAnalysis: e.distractorAnalysis || null,
      }));
      return { type, data } as T;
    }
  } catch (err) {
    console.error('JSON parse failed. JSON length:', jsonStr.length, 'Last 100 chars:', jsonStr.slice(-100));
    throw new Error(`Failed to parse AI response: ${err instanceof Error ? err.message : err}`);
  }
}

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
  const [pdfTexts, setPdfTexts] = useState<{ name: string; text: string; type: PdfType }[]>([]);
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

  async function handleExtractText() {
    if (!testLabel.trim()) { setError('Please enter a test label'); return; }
    if (files.length < 2) { setError('Please upload at least 2 PDF files (questions + answers)'); return; }

    setError(null);
    setStep('processing');

    try {
      const extracted: { name: string; text: string; type: PdfType }[] = [];
      for (const file of files) {
        setProcessingStatus(`Extracting text from ${file.name}...`);
        const { extractTextFromPdfClient } = await import('@/lib/pdf-extract-client');
        const text = await extractTextFromPdfClient(file);
        const type = detectPdfType(text);
        extracted.push({ name: file.name, text, type });
      }
      setPdfTexts(extracted);
      setStep('review_types');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract text');
      setStep('upload');
    }
  }

  function updatePdfType(index: number, newType: PdfType) {
    setPdfTexts((prev) => prev.map((p, i) => i === index ? { ...p, type: newType } : p));
  }

  async function handleProcess() {
    setError(null);
    setStep('processing');

    try {
      // Validate
      const questionsTexts = pdfTexts.filter((p) => p.type === 'questions');
      const answersTexts = pdfTexts.filter((p) => p.type === 'answers');
      const explanationsTexts = pdfTexts.filter((p) => p.type === 'explanations');

      if (questionsTexts.length === 0) {
        throw new Error('Could not detect a questions PDF. Detected: ' + pdfTexts.map(p => `${p.name} → ${p.type}`).join(', '));
      }
      if (answersTexts.length === 0) {
        throw new Error('Could not detect an answers PDF. Detected: ' + pdfTexts.map(p => `${p.name} → ${p.type}`).join(', '));
      }

      // Step 2: Parse each PDF type with Claude
      // Split into 4 calls by module to stay within Claude's output token limit
      const SAT_MODULES = [
        'Reading and Writing Module 1',
        'Reading and Writing Module 2',
        'Math Module 1',
        'Math Module 2',
      ];

      const questionsText = questionsTexts.map((p) => p.text).join('\n\n---NEW PDF---\n\n');
      const allParsedQuestions: ParsedQuestion[] = [];
      for (let i = 0; i < SAT_MODULES.length; i++) {
        setProcessingStatus(`Parsing questions: ${SAT_MODULES[i]} (${i + 1}/4)...`);
        const qResult = await parseApiCall<{ data: ParsedQuestion[] }>(
          { type: 'questions', text: questionsText, moduleFilter: SAT_MODULES[i] }
        );
        allParsedQuestions.push(...qResult.data);
      }

      setProcessingStatus('Parsing answers PDF with AI...');
      const answersText = answersTexts.map((p) => p.text).join('\n\n');
      const aResult = await parseApiCall<{ data: ParsedAnswer[] }>(
        { type: 'answers', text: answersText }
      );

      let parsedExplanations: ParsedExplanation[] = [];
      const warnings: string[] = [];
      if (explanationsTexts.length > 0) {
        const explanationsText = explanationsTexts.map((p) => p.text).join('\n\n');
        for (let i = 0; i < SAT_MODULES.length; i++) {
          setProcessingStatus(`Parsing explanations: ${SAT_MODULES[i]} (${i + 1}/4)...`);
          const eResult = await parseApiCall<{ data: ParsedExplanation[] }>(
            { type: 'explanations', text: explanationsText, moduleFilter: SAT_MODULES[i] }
          );
          parsedExplanations.push(...eResult.data);
        }
      } else {
        warnings.push('No explanations PDF detected — questions will have no explanations.');
      }

      // Step 3: Deterministic match (runs in browser, instant)
      setProcessingStatus('Matching questions with answers...');
      const { merged, warnings: matchWarnings } = matchAndMerge(
        allParsedQuestions,
        aResult.data,
        parsedExplanations
      );
      warnings.push(...matchWarnings);

      // Step 4: Classify in batches (separate API calls)
      const BATCH_SIZE = 15;
      const allClassifications = new Map<string, ClassificationResult>();
      const totalBatches = Math.ceil(merged.length / BATCH_SIZE);

      for (let i = 0; i < merged.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        setProcessingStatus(`Classifying skills & difficulty... (batch ${batchNum}/${totalBatches})`);
        const batch = merged.slice(i, i + BATCH_SIZE);
        const cResult = await apiCall<{ classifications: ClassificationResult[] }>(
          '/api/parent/upload-questions/classify',
          { batch }
        );
        for (const r of cResult.classifications) {
          allClassifications.set(`${r.module}_${r.questionNumber}`, r);
        }
      }

      // Step 5: Apply classifications
      const classified: ClassifiedQuestion[] = merged.map((q) => {
        const c = allClassifications.get(`${q.module}_${q.questionNumber}`);
        return {
          ...q,
          subSkillId: c?.subSkillId ?? (q.section === 'math' ? 'M-01' : 'RW-01'),
          difficulty: c?.difficulty ?? 3,
        };
      });

      setQuestions(classified);
      setSummary({
        total: allParsedQuestions.length,
        matched: merged.length,
        classified: classified.length,
        warnings,
      });
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
      const data = await apiCall<{ inserted: number }>(
        '/api/parent/upload-questions/confirm',
        { questions, testLabel: testLabel.trim() }
      );
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
    setPdfTexts([]);
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
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Upload the official College Board Bluebook practice test PDFs.
              Questions, answers, and explanations should each be in a separate
              PDF file. The system will automatically detect which file is which.
            </p>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Test Label</label>
              <input
                type="text"
                value={testLabel}
                onChange={(e) => setTestLabel(e.target.value)}
                placeholder="e.g., Practice Test 1"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 md:text-sm"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Used to generate unique question IDs (e.g., cb_practice_test_1_rw_m1_q1)
              </p>
            </div>

            <div>
              <input ref={fileInputRef} type="file" multiple accept=".pdf" onChange={handleFileSelect} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 px-6 py-8 text-sm text-gray-500 dark:text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-600"
              >
                <FileText className="h-6 w-6" />
                <span>Click to select PDF files</span>
              </button>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected files ({files.length})</p>
                {files.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-red-500" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">({(file.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <button type="button" onClick={() => removeFile(i)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={handleExtractText} disabled={files.length < 2 || !testLabel.trim()} className="w-full">
              Upload & Process
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 1b: Review detected PDF types
  if (step === 'review_types') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confirm PDF Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Verify each file is correctly identified. Change the type if needed.
          </p>
          {pdfTexts.map((pdf, i) => (
            <div key={pdf.name} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-red-500" />
              <span className="flex-1 truncate text-sm">{pdf.name}</span>
              <select
                value={pdf.type}
                onChange={(e) => updatePdfType(i, e.target.value as PdfType)}
                className="rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm"
              >
                <option value="questions">Questions</option>
                <option value="answers">Answers</option>
                <option value="explanations">Explanations</option>
              </select>
            </div>
          ))}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep('upload'); setPdfTexts([]); }} className="flex-1">Back</Button>
            <Button onClick={handleProcess} className="flex-1">Process PDFs</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 2: Processing
  if (step === 'processing') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600 dark:text-gray-300">{processingStatus}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Please don&apos;t close this page</p>
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
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>Parsed Results — {testLabel}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <span className="text-2xl font-bold">{summary.total}</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Questions found</p>
              </div>
              <div>
                <span className="text-2xl font-bold text-green-600">{summary.matched}</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Matched w/ answers</p>
              </div>
              <div>
                <span className="text-2xl font-bold text-blue-600">{summary.classified}</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Classified</p>
              </div>
            </div>
            {summary.warnings.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-xs font-medium text-amber-600">Warnings ({summary.warnings.length}):</p>
                {summary.warnings.slice(0, 5).map((w, i) => (
                  <p key={i} className="text-xs text-amber-500">{w}</p>
                ))}
                {summary.warnings.length > 5 && (
                  <p className="text-xs text-amber-400">...and {summary.warnings.length - 5} more</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Reading & Writing ({rwQuestions.length}) | Math ({mathQuestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-gray-900">
                  <tr className="border-b text-left text-xs text-gray-500 dark:text-gray-400">
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
                      <td className="py-1.5 pr-2 text-gray-400 dark:text-gray-500">{q.questionNumber}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        <Badge variant="outline" className="text-xs">{q.module}</Badge>
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        <span className="text-xs" title={SKILL_NAMES[q.subSkillId] ?? q.subSkillId}>{q.subSkillId}</span>
                      </td>
                      <td className="py-1.5 pr-2">{q.difficulty}</td>
                      <td className="py-1.5 pr-2 font-medium">{q.correctAnswer}</td>
                      <td className="py-1.5 max-w-xs truncate text-gray-600 dark:text-gray-300">
                        {q.questionText.slice(0, 60)}{q.questionText.length > 60 ? '...' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={reset} className="flex-1">Cancel</Button>
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
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {insertedCount} questions from &ldquo;{testLabel}&rdquo; have been imported to the question bank.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">These questions will now appear in study sessions.</p>
          <Button onClick={reset} variant="outline">Upload Another Test</Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
