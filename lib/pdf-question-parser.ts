import Anthropic from '@anthropic-ai/sdk';
import { loadPrompt, interpolatePrompt } from './prompt-utils';
import { MODELS } from './claude';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ============================================
// Types
// ============================================

export interface ParsedQuestion {
  module: string;
  questionNumber: number;
  section: 'math' | 'reading_writing';
  questionText: string;
  passageText: string | null;
  answerChoices: Record<string, string>;
}

export interface ParsedAnswer {
  module: string;
  questionNumber: number;
  correctAnswer: string;
}

export interface ParsedExplanation {
  module: string;
  questionNumber: number;
  explanation: string;
  distractorAnalysis: Record<string, string> | null;
}

export interface ClassifiedQuestion extends ParsedQuestion {
  correctAnswer: string;
  explanation: string | null;
  distractorAnalysis: Record<string, string>;
  subSkillId: string;
  difficulty: number;
}

export type PdfType = 'questions' | 'answers' | 'explanations';

export interface UploadResult {
  questions: ClassifiedQuestion[];
  summary: {
    total: number;
    matched: number;
    classified: number;
    warnings: string[];
  };
}

// ============================================
// PDF Text Extraction
// ============================================

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const pdf = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await pdf.getText();
  await pdf.destroy();
  return result.text;
}

// ============================================
// PDF Type Detection
// ============================================

export function detectPdfType(text: string): PdfType {
  const first2000 = text.slice(0, 2000).toLowerCase();

  // Answer key: dense pattern of question numbers with single-letter answers
  const answerPattern = /(?:correct answer|answer[:\s]|^[\s]*\d+[\.\)]\s*[abcd]\s*$)/gim;
  const answerMatches = first2000.match(answerPattern);
  if (answerMatches && answerMatches.length >= 5) {
    return 'answers';
  }

  // Check for answer key table patterns (Number | Domain | Skill | Answer)
  if (
    first2000.includes('answer') &&
    first2000.includes('domain') &&
    first2000.includes('skill')
  ) {
    return 'answers';
  }

  // Explanations: contain rationale/explanation keywords
  const explanationKeywords = [
    'rationale',
    'explanation',
    'choice a is',
    'choice b is',
    'the correct answer is',
    'this is correct because',
    'is the best answer',
  ];
  const explanationHits = explanationKeywords.filter((kw) =>
    first2000.includes(kw)
  ).length;
  if (explanationHits >= 2) {
    return 'explanations';
  }

  // Default: questions PDF (has passages, answer choices A-D, module headers)
  return 'questions';
}

// ============================================
// Claude-Based Parsing
// ============================================

function extractJsonFromResponse(text: string): string {
  // Try to find JSON array in the response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) return jsonMatch[0];

  // Try removing markdown code fences
  const cleaned = text
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim();
  return cleaned;
}

async function callClaude(label: string, systemPrompt: string, maxTokens: number): Promise<string> {
  const start = Date.now();
  console.log(`[callClaude] ${label} starting — promptLength=${systemPrompt.length} maxTokens=${maxTokens}`);

  const stream = anthropic.messages.stream({
    model: MODELS.SONNET,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Extract the structured data now. Return ONLY the JSON array.' }],
  });

  const response = await stream.finalMessage();
  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[callClaude] ${label} done in ${elapsed}s — responseLength=${text.length} inputTokens=${response.usage.input_tokens} outputTokens=${response.usage.output_tokens}`);
  return text;
}

/**
 * Split PDF text into chunks by module boundaries.
 * SAT tests have 4 modules: RW Module 1, RW Module 2, Math Module 1, Math Module 2.
 * Splitting avoids hitting token limits when parsing all ~98 questions at once.
 */
function splitTextByModule(pdfText: string): { label: string; text: string }[] {
  // Look for module boundary patterns in the text
  const modulePattern = /(?:^|\n)(.{0,50}(?:Module\s*[12]|MODULE\s*[12]).{0,50})(?:\n|$)/gi;
  const matches = [...pdfText.matchAll(modulePattern)];

  if (matches.length < 2) {
    // Can't reliably split — return as single chunk
    return [{ label: 'all', text: pdfText }];
  }

  const chunks: { label: string; text: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : pdfText.length;
    const chunkText = pdfText.slice(start, end);
    // Only include chunks with meaningful content (at least 500 chars suggests questions)
    if (chunkText.length > 500) {
      chunks.push({ label: matches[i][1].trim(), text: chunkText });
    }
  }

  return chunks.length > 0 ? chunks : [{ label: 'all', text: pdfText }];
}

export async function parseQuestionsPdf(pdfText: string): Promise<ParsedQuestion[]> {
  const chunks = splitTextByModule(pdfText);
  console.log(`[parseQuestionsPdf] textLength=${pdfText.length} chunks=${chunks.length} labels=[${chunks.map(c => c.label).join(', ')}]`);

  if (chunks.length > 1) {
    const results = await Promise.all(
      chunks.map((chunk, i) => parseSingleQuestionsChunk(chunk.text, `questions-chunk${i+1}(${chunk.label})`))
    );
    return results.flat();
  }

  return parseSingleQuestionsChunk(pdfText, 'questions-all');
}

async function parseSingleQuestionsChunk(pdfText: string, label: string): Promise<ParsedQuestion[]> {
  const template = loadPrompt('pdf-parse-questions');
  const systemPrompt = interpolatePrompt(template, { pdf_text: pdfText });

  const responseText = await callClaude(label, systemPrompt, 32000);
  const jsonStr = extractJsonFromResponse(responseText);

  try {
    const parsed = JSON.parse(jsonStr) as ParsedQuestion[];
    // Validate and normalize
    return parsed.map((q) => ({
      module: normalizeModule(q.module),
      questionNumber: q.questionNumber,
      section: q.module.toLowerCase().includes('math') ? 'math' as const : 'reading_writing' as const,
      questionText: q.questionText,
      passageText: q.passageText || null,
      answerChoices: q.answerChoices,
    }));
  } catch (err) {
    throw new Error(`Failed to parse questions JSON: ${err}`);
  }
}

export async function parseAnswersPdf(pdfText: string): Promise<ParsedAnswer[]> {
  console.log(`[parseAnswersPdf] textLength=${pdfText.length}`);
  const template = loadPrompt('pdf-parse-answers');
  const systemPrompt = interpolatePrompt(template, { pdf_text: pdfText });

  const responseText = await callClaude('answers', systemPrompt, 4000);
  const jsonStr = extractJsonFromResponse(responseText);

  try {
    const parsed = JSON.parse(jsonStr) as ParsedAnswer[];
    return parsed.map((a) => ({
      module: normalizeModule(a.module),
      questionNumber: a.questionNumber,
      correctAnswer: a.correctAnswer.toUpperCase(),
    }));
  } catch (err) {
    throw new Error(`Failed to parse answers JSON: ${err}`);
  }
}

export async function parseExplanationsPdf(pdfText: string): Promise<ParsedExplanation[]> {
  const chunks = splitTextByModule(pdfText);
  console.log(`[parseExplanationsPdf] textLength=${pdfText.length} chunks=${chunks.length} labels=[${chunks.map(c => c.label).join(', ')}]`);

  if (chunks.length > 1) {
    const results = await Promise.all(
      chunks.map((chunk, i) => parseSingleExplanationsChunk(chunk.text, `explanations-chunk${i+1}(${chunk.label})`))
    );
    return results.flat();
  }

  return parseSingleExplanationsChunk(pdfText, 'explanations-all');
}

async function parseSingleExplanationsChunk(pdfText: string, label: string): Promise<ParsedExplanation[]> {
  const template = loadPrompt('pdf-parse-explanations');
  const systemPrompt = interpolatePrompt(template, { pdf_text: pdfText });

  const responseText = await callClaude(label, systemPrompt, 32000);
  const jsonStr = extractJsonFromResponse(responseText);

  try {
    const parsed = JSON.parse(jsonStr) as ParsedExplanation[];
    return parsed.map((e) => ({
      module: normalizeModule(e.module),
      questionNumber: e.questionNumber,
      explanation: e.explanation,
      distractorAnalysis: e.distractorAnalysis || null,
    }));
  } catch (err) {
    throw new Error(`Failed to parse explanations JSON: ${err}`);
  }
}

// ============================================
// Deterministic Matching
// ============================================

function matchKey(module: string, questionNumber: number): string {
  return `${module}_${questionNumber}`;
}

function normalizeModule(module: string): string {
  const m = module.trim();
  // Normalize variants like "Reading and Writing Module 1" → "RW Module 1"
  if (/reading/i.test(m) && /module\s*1/i.test(m)) return 'RW Module 1';
  if (/reading/i.test(m) && /module\s*2/i.test(m)) return 'RW Module 2';
  if (/math/i.test(m) && /module\s*1/i.test(m)) return 'Math Module 1';
  if (/math/i.test(m) && /module\s*2/i.test(m)) return 'Math Module 2';
  // Already normalized
  if (/^(RW|Math) Module [12]$/.test(m)) return m;
  return m;
}

export interface MergedQuestion extends ParsedQuestion {
  correctAnswer: string;
  explanation: string | null;
  distractorAnalysis: Record<string, string>;
}

export function matchAndMerge(
  questions: ParsedQuestion[],
  answers: ParsedAnswer[],
  explanations: ParsedExplanation[]
): { merged: MergedQuestion[]; warnings: string[] } {
  const warnings: string[] = [];

  // Build lookup maps
  const answerMap = new Map<string, ParsedAnswer>();
  for (const a of answers) {
    answerMap.set(matchKey(a.module, a.questionNumber), a);
  }

  const explanationMap = new Map<string, ParsedExplanation>();
  for (const e of explanations) {
    explanationMap.set(matchKey(e.module, e.questionNumber), e);
  }

  const merged: MergedQuestion[] = [];

  for (const q of questions) {
    const key = matchKey(q.module, q.questionNumber);
    const answer = answerMap.get(key);

    if (!answer) {
      warnings.push(`No answer found for ${q.module} Q${q.questionNumber}`);
      continue;
    }

    const explanation = explanationMap.get(key);
    if (!explanation) {
      warnings.push(`No explanation found for ${q.module} Q${q.questionNumber}`);
    }

    merged.push({
      ...q,
      correctAnswer: answer.correctAnswer,
      explanation: explanation?.explanation ?? null,
      distractorAnalysis: explanation?.distractorAnalysis ?? {},
    });
  }

  return { merged, warnings };
}

// ============================================
// Batch Classification
// ============================================

export interface ClassificationResult {
  questionNumber: number;
  module: string;
  subSkillId: string;
  difficulty: number;
}

export async function classifyBatch(
  batch: MergedQuestion[]
): Promise<ClassificationResult[]> {
  const questionsForClaude = batch.map((q) => ({
    module: q.module,
    questionNumber: q.questionNumber,
    section: q.section,
    questionText: q.questionText,
    passageText: q.passageText ? q.passageText.slice(0, 500) + '...' : null,
    answerChoices: q.answerChoices,
    correctAnswer: q.correctAnswer,
  }));

  const template = loadPrompt('classify-questions');
  const systemPrompt = interpolatePrompt(template, {
    questions_json: JSON.stringify(questionsForClaude, null, 2),
  });

  const responseText = await callClaude(`classify-batch(${batch.length})`, systemPrompt, 2000);
  const jsonStr = extractJsonFromResponse(responseText);

  try {
    return JSON.parse(jsonStr) as ClassificationResult[];
  } catch {
    // If classification fails, assign defaults
    return batch.map((q) => ({
      questionNumber: q.questionNumber,
      module: q.module,
      subSkillId: q.section === 'math' ? 'M-01' : 'RW-01',
      difficulty: 3,
    }));
  }
}

export async function classifyQuestions(
  questions: MergedQuestion[]
): Promise<ClassifiedQuestion[]> {
  const BATCH_SIZE = 15;
  const allClassifications = new Map<string, ClassificationResult>();

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    const results = await classifyBatch(batch);
    for (const r of results) {
      allClassifications.set(matchKey(r.module, r.questionNumber), r);
    }
  }

  return questions.map((q) => {
    const key = matchKey(q.module, q.questionNumber);
    const classification = allClassifications.get(key);
    return {
      ...q,
      subSkillId: classification?.subSkillId ?? (q.section === 'math' ? 'M-01' : 'RW-01'),
      difficulty: classification?.difficulty ?? 3,
    };
  });
}

// ============================================
// Generate Question IDs
// ============================================

function moduleToIdPart(module: string): { sectionAbbr: string; moduleNum: string } {
  if (module === 'RW Module 1') return { sectionAbbr: 'rw', moduleNum: 'm1' };
  if (module === 'RW Module 2') return { sectionAbbr: 'rw', moduleNum: 'm2' };
  if (module === 'Math Module 1') return { sectionAbbr: 'math', moduleNum: 'm1' };
  if (module === 'Math Module 2') return { sectionAbbr: 'math', moduleNum: 'm2' };
  return { sectionAbbr: 'unk', moduleNum: 'm0' };
}

export function generateQuestionId(
  testLabel: string,
  module: string,
  questionNumber: number
): string {
  const sanitized = testLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const { sectionAbbr, moduleNum } = moduleToIdPart(module);
  return `cb_${sanitized}_${sectionAbbr}_${moduleNum}_q${questionNumber}`;
}

// ============================================
// Full Pipeline
// ============================================

export async function processUploadedPdfs(
  files: { name: string; buffer: Buffer }[],
  testLabel: string
): Promise<UploadResult> {
  const pdfTexts: { type: PdfType; text: string; name: string }[] = [];
  for (const file of files) {
    const text = await extractTextFromPdf(file.buffer);
    const type = detectPdfType(text);
    pdfTexts.push({ type, text, name: file.name });
  }

  return processFromTexts(pdfTexts, testLabel);
}

export async function processExtractedTexts(
  texts: { name: string; text: string }[],
  testLabel: string
): Promise<UploadResult> {
  const pdfTexts = texts.map((t) => ({
    type: detectPdfType(t.text),
    text: t.text,
    name: t.name,
  }));

  return processFromTexts(pdfTexts, testLabel);
}

async function processFromTexts(
  pdfTexts: { type: PdfType; text: string; name: string }[],
  testLabel: string
): Promise<UploadResult> {
  const warnings: string[] = [];

  // Validate: need at least questions + answers
  const questionsPdfs = pdfTexts.filter((p) => p.type === 'questions');
  const answersPdfs = pdfTexts.filter((p) => p.type === 'answers');
  const explanationsPdfs = pdfTexts.filter((p) => p.type === 'explanations');

  if (questionsPdfs.length === 0) {
    throw new Error(
      'Could not detect a questions PDF. Detected types: ' +
        pdfTexts.map((p) => `${p.name} → ${p.type}`).join(', ')
    );
  }
  if (answersPdfs.length === 0) {
    throw new Error(
      'Could not detect an answers PDF. Detected types: ' +
        pdfTexts.map((p) => `${p.name} → ${p.type}`).join(', ')
    );
  }

  // 3. Parse each PDF type with Claude
  const questionsText = questionsPdfs.map((p) => p.text).join('\n\n---NEW PDF---\n\n');
  const answersText = answersPdfs.map((p) => p.text).join('\n\n');
  const explanationsText = explanationsPdfs.map((p) => p.text).join('\n\n');

  const [parsedQuestions, parsedAnswers] = await Promise.all([
    parseQuestionsPdf(questionsText),
    parseAnswersPdf(answersText),
  ]);

  let parsedExplanations: ParsedExplanation[] = [];
  if (explanationsPdfs.length > 0) {
    parsedExplanations = await parseExplanationsPdf(explanationsText);
  } else {
    warnings.push('No explanations PDF detected — questions will have no explanations.');
  }

  // 4. Deterministic match
  const { merged, warnings: matchWarnings } = matchAndMerge(
    parsedQuestions,
    parsedAnswers,
    parsedExplanations
  );
  warnings.push(...matchWarnings);

  // 5. Classify with Claude
  const classified = await classifyQuestions(merged);

  return {
    questions: classified,
    summary: {
      total: parsedQuestions.length,
      matched: merged.length,
      classified: classified.length,
      warnings,
    },
  };
}
