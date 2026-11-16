'use client';
import { useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Outcome, Problem, Settings } from '@/lib/types';
import { Dialog, Field } from './dialog';

export type EditorState = { problem?: Problem; mode: 'new' | 'edit' | 'attempt' };
export function ProblemEditor({ editor, preferred, onClose, onSave }: {
  editor: EditorState; preferred: Settings['difficulty']; onClose: () => void;
  onSave: (problem: Problem) => boolean;
}) {
  const p = editor.problem;
  const [step, setStep] = useState(editor.mode === 'attempt' ? 1 : 0);
  const [title, setTitle] = useState(p?.title ?? '');
  const [url, setUrl] = useState(p?.url ?? '');
  const [topics, setTopics] = useState(p?.topics.join(', ') ?? '');
  const [difficulty, setDifficulty] = useState(p?.difficulty ?? preferred);
  const [outcome, setOutcome] = useState<Outcome>('independent');
  const [minutes, setMinutes] = useState('25');
  const [confidence, setConfidence] = useState(3);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const heading = useRef<HTMLParagraphElement>(null);
  function changeStep(next: number) { setError(''); setStep(next); requestAnimationFrame(() => heading.current?.focus()); }
  function validDetails() {
    if (!title.trim()) { setError('Give this problem a name so you can find it again.'); return false; }
    if (url.trim() && !/^https:\/\/(www\.)?leetcode\.com\/problems\/[^\s]+$/.test(url.trim())) {
      setError('That link doesn’t look like a LeetCode problem. Use https://leetcode.com/problems/… or leave it blank.'); return false;
    }
    return true;
  }
  return <Dialog title={editor.mode === 'edit' ? 'Edit problem' : editor.mode === 'attempt' ? 'How did practice go?' : 'A little practice, logged.'} description={editor.mode === 'attempt' ? p?.title : 'No perfect scores needed. Every attempt helps.'} onClose={onClose}>
    {editor.mode === 'new' && <ol className="stepper" aria-label="Problem steps"><li aria-current={step === 0 ? 'step' : undefined}>1 <span>The problem</span></li><li aria-current={step === 1 ? 'step' : undefined}>2 <span>How it went</span></li></ol>}
    <p ref={heading} tabIndex={-1} className="step-heading">{step === 0 ? 'What did you work on?' : 'A quick check-in'}</p>
    <form onSubmit={e => {
      e.preventDefault();
      if (!validDetails()) { if (step === 1 && editor.mode === 'new') setStep(0); return; }
      if (step === 0 && editor.mode === 'new') { changeStep(1); return; }
      if (editor.mode !== 'edit' && (!minutes || !Number.isFinite(Number(minutes)) || Number(minutes) < 0 || Number(minutes) > 1440)) { setError('Add a practice time between 0 and 1,440 minutes.'); return; }
      const next: Problem = {
        id: p?.id ?? crypto.randomUUID(), title: title.trim(), url: url.trim(),
        topics: Array.from(new Set(topics.split(',').map(t => t.trim()).filter(Boolean))), difficulty,
        attempts: editor.mode === 'edit' ? p!.attempts : [...(p?.attempts ?? []), {
          id: crypto.randomUUID(), at: new Date().toISOString(), minutes: Number(minutes), outcome, confidence, notes: notes.trim(),
        }],
      };
      if (!onSave(next)) setError('We couldn’t save that yet. Your entries are still here. Check that browser storage is available, then try again.');
    }}>
      {error && <p className="alert" role="alert">{error}</p>}
      {step === 0 ? <>
        <Field label="Problem name"><input autoFocus required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Two Sum"/></Field>
        <Field label="Difficulty"><select value={difficulty} onChange={e => setDifficulty(e.target.value as Problem['difficulty'])}>{['Easy','Medium','Hard'].map(d => <option key={d}>{d}</option>)}</select></Field>
        <details className="disclosure" open={editor.mode === 'edit' ? true : undefined}><summary>Add a link or topics <span>Optional</span></summary>
          <Field label="LeetCode problem link"><input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://leetcode.com/problems/two-sum/"/></Field>
          <Field label="Topics, separated by commas"><input value={topics} onChange={e => setTopics(e.target.value)} placeholder="Arrays, Hash maps"/></Field>
          <p className="subtle">Topics help you spot what needs a little more practice.</p>
        </details>
      </> : <>
        {p?.url && <a className="practice-link" href={p.url} target="_blank" rel="noreferrer">Open problem to practice ↗</a>}
        <fieldset className="outcome-options"><legend>How did it go?</legend>{([
          ['independent', 'Got it on my own', 'I found a solution independently.'],
          ['hints', 'Needed a little help', 'Hints helped me get there.'],
          ['failed', 'Still figuring it out', 'A good one to come back to.'],
        ] as const).map(([value,label,help]) => <label key={value} className={outcome === value ? 'selected' : ''}><input type="radio" name="outcome" value={value} checked={outcome === value} onChange={() => setOutcome(value)}/><span><strong>{label}</strong><small>{help}</small></span></label>)}</fieldset>
        <div className="form-grid"><Field label="Time spent (minutes)"><input type="number" min="0" max="1440" required value={minutes} onChange={e => setMinutes(e.target.value)}/></Field>
          <Field label="How confident do you feel?"><select value={confidence} onChange={e => setConfidence(Number(e.target.value))}>{['1 · Lots to revisit','2 · A few gaps','3 · Getting there','4 · Feeling good','5 · Could teach it'].map((v,i) => <option key={v} value={i+1}>{v}</option>)}</select></Field></div>
        <details className="disclosure"><summary>Add a reflection <span>Optional</span></summary><Field label="A note for future you"><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What helped? What would you try next time?"/></Field></details>
        <p className="helper-note">We’ll use this check-in to choose when to revisit the problem.</p>
      </>}
      <div className="modal-actions"><button type="button" onClick={() => step === 1 && editor.mode === 'new' ? changeStep(0) : onClose()}>{step === 1 && editor.mode === 'new' ? 'Back' : 'Cancel'}</button><button className="primary" type="submit">{editor.mode === 'edit' ? 'Save changes' : step === 0 ? 'Next: how it went' : 'Save practice'}<ArrowRight size={16}/></button></div>
    </form>
  </Dialog>;
}
