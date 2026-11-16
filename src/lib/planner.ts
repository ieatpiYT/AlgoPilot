import type { Session, Settings } from './types.ts';
export function localParts(date: Date, timezone: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export function overlaps(a: Pick<Session, 'start'|'end'>, b: Pick<Session, 'start'|'end'>) { return Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end); }
export function zonedTime(value: string, timezone: string): Date | null {
  const target = Date.parse(value + 'Z');
  if (!Number.isFinite(target)) return null;
  let guess = target;
  for (let i = 0; i < 4; i++) { const p = localParts(new Date(guess), timezone); guess += target - Date.parse(`${p.date}T${p.time}:00Z`); }
  const date = new Date(guess), p = localParts(date, timezone);
  return `${p.date}T${p.time}` === value ? date : null;
}
export function generatePlan(settings: Settings, existing: Session[], now = new Date()): Session[] {
  const result: Session[] = [], counts = new Map<string, number>();
  const week = (date: string) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0,10); };
  for (const s of existing.filter(s => s.status !== 'skipped')) { const key = week(localParts(new Date(s.start), settings.timezone).date); counts.set(key, (counts.get(key) ?? 0) + 1); }
  const start = localParts(now, settings.timezone).date;
  for (let day = 0; day < 28; day++) {
    const d = new Date(start + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + day); const date = d.toISOString().slice(0,10), key = week(date);
    if (settings.interview && date > settings.interview) break;
    for (const window of settings.availability.filter(w => w.day === d.getUTCDay()).sort((a,b) => a.start.localeCompare(b.start))) {
      const from = zonedTime(`${date}T${window.start}`, settings.timezone), to = zonedTime(`${date}T${window.end}`, settings.timezone);
      if (!from || !to) continue;
      for (let t = from.getTime(); t + settings.length * 60000 <= to.getTime(); t += settings.length * 60000) {
        if ((counts.get(key) ?? 0) >= settings.goal) break;
        const candidate: Session = { id: crypto.randomUUID(), start: new Date(t).toISOString(), end: new Date(t + settings.length * 60000).toISOString(), status: 'scheduled' };
        if (t <= now.getTime() || [...existing.filter(s => s.status !== 'skipped'), ...result].some(s => overlaps(s, candidate))) continue;
        result.push(candidate); counts.set(key, (counts.get(key) ?? 0) + 1); break;
      }
    }
  }
  return result;
}
