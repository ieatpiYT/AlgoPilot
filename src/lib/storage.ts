import type { Data } from './types.ts';
export const STORAGE_KEY = 'algopilot.v1';
const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown) => typeof x === 'string';
const num = (x: unknown, min: number, max: number) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const date = (x: unknown) => str(x) && Number.isFinite(Date.parse(x as string));
const time = (x: unknown) => str(x) && /^([01]\d|2[0-3]):[0-5]\d$/.test(x as string);
export function validateData(input: unknown): Data {
  const fail = () => { throw new Error('Invalid backup. Expected a valid AlgoPilot version 1 export.'); };
  if (!obj(input) || input.version !== 1 || !Array.isArray(input.problems) || !Array.isArray(input.sessions) || !obj(input.settings)) return fail();
  const s = input.settings;
  try { new Intl.DateTimeFormat('en', { timeZone: s.timezone as string }).format(); } catch { return fail(); }
  if (!str(s.timezone) || !num(s.length, 15, 180) || !num(s.goal, 1, 21) || !Number.isInteger(s.goal) || !['Easy','Medium','Hard'].includes(s.difficulty as string) || !str(s.interview) || (s.interview !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(s.interview as string) || !date(s.interview))) || typeof s.accountability !== 'boolean' || !Array.isArray(s.availability)) return fail();
  if (!s.availability.every(w => obj(w) && Number.isInteger(w.day) && num(w.day,0,6) && time(w.start) && time(w.end) && (w.start as string) < (w.end as string))) return fail();
  const ids = new Set<string>(); const id = (x: unknown) => { if (!str(x) || !x || ids.has(x as string)) return false; ids.add(x as string); return true; };
  for (const p of input.problems) {
    if (!obj(p) || !id(p.id) || !str(p.title) || !p.title.trim() || !str(p.url) || (p.url && !/^https:\/\/(www\.)?leetcode\.com\/problems\/[^\s]+$/.test(p.url)) || !Array.isArray(p.topics) || !p.topics.every(str) || !['Easy','Medium','Hard'].includes(p.difficulty as string) || !Array.isArray(p.attempts)) return fail();
    let previous = 0;
    for (const a of p.attempts) { if (!obj(a) || !id(a.id) || !date(a.at) || Date.parse(a.at as string) < previous || !num(a.minutes,0,1440) || !['independent','hints','failed'].includes(a.outcome as string) || !num(a.confidence,1,5) || !Number.isInteger(a.confidence) || !str(a.notes)) return fail(); previous = Date.parse(a.at as string); }
  }
  for (const v of input.sessions) if (!obj(v) || !id(v.id) || !date(v.start) || !date(v.end) || Date.parse(v.end as string) <= Date.parse(v.start as string) || !['scheduled','completed','skipped'].includes(v.status as string)) return fail();
  const active = input.sessions.filter(v => v.status !== 'skipped').sort((a,b) => Date.parse(a.start)-Date.parse(b.start));
  if (active.some((v,i) => i > 0 && Date.parse(v.start) < Date.parse(active[i-1].end))) return fail();
  return input as Data;
}
export function saveData(data: Data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(validateData(data))); }
