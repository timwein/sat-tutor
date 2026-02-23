import * as fs from 'fs';
import * as path from 'path';

const promptCache = new Map<string, string>();

export function loadPrompt(promptName: string): string {
  if (promptCache.has(promptName)) {
    return promptCache.get(promptName)!;
  }
  const promptPath = path.join(process.cwd(), 'prompts', `${promptName}.md`);
  const content = fs.readFileSync(promptPath, 'utf-8');
  promptCache.set(promptName, content);
  return content;
}

export function interpolatePrompt(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
