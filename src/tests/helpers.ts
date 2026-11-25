import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Loads the demo job-application page into the jsdom document (scripts are not executed). */
export function loadDemo(): void {
  const html = readFileSync(join(process.cwd(), 'demo', 'index.html'), 'utf8');
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/gi, '');
}

export function showAllSteps(): void {
  document.querySelectorAll<HTMLElement>('.step').forEach((s) => { s.hidden = false; });
}
