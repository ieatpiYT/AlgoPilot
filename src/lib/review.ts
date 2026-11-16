import type { Problem } from './types.ts';
export function review(problem: Problem, now = new Date()) {
  let interval = 1, failures = 0;
  for (const attempt of problem.attempts) {
    if (attempt.outcome === 'failed') { failures++; interval = Math.max(0.25, 1 / failures); }
    else { failures = 0; interval = attempt.outcome === 'hints' ? Math.max(1, Math.min(3, interval * 0.75)) : Math.min(90, Math.max(2, interval * (1.3 + attempt.confidence * 0.3))); }
    if (attempt.confidence <= 2) interval = Math.max(0.25, interval * 0.5);
  }
  const last = problem.attempts.at(-1);
  const due = last ? new Date(Date.parse(last.at) + interval * 86400000) : now;
  const overdue = Math.max(0, (now.getTime() - due.getTime()) / 86400000);
  const score = overdue * 10 + (last?.outcome === 'failed' ? 50 : last?.outcome === 'hints' ? 20 : 0) + (6 - (last?.confidence ?? 1)) * 5;
  const reason = !last ? 'Ready for your first attempt.' : `${last.outcome === 'failed' ? 'Rebuild recall after an unsuccessful attempt' : last.confidence <= 2 ? 'Strengthen low-confidence recall' : last.outcome === 'hints' ? 'Practice solving without hints' : 'Reinforce independent recall'}. Review interval: ${Math.round(interval * 24)} hours.`;
  return { due, score, reason, interval };
}
export function recommendations(problems: Problem[], now = new Date()) {
  return problems.map(problem => ({ problem, ...review(problem, now) })).filter(x => x.due <= now).sort((a,b) => b.score - a.score);
}
