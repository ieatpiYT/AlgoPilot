'use client';
import { useRef, useState } from 'react';
import { ArrowRight, Sprout, Plus, X } from 'lucide-react';
import type { Settings } from '@/lib/types';
import { localParts } from '@/lib/planner';
import { Dialog, Field } from './dialog';
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export function Onboarding({ initial, onFinish, onClose }: {
  initial: Settings; onFinish: (settings: Settings, addProblem: boolean) => boolean; onClose: () => void;
}) {
  const [settings, setSettings] = useState(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  function move(next: number) { setStep(next); setError(''); requestAnimationFrame(() => heading.current?.focus()); }
  function finish(add: boolean) { if (!onFinish(settings, add)) setError('Your setup is still here. We couldn’t save it to this browser. Please try again.'); }
  return <Dialog title="Let’s find your study rhythm." description="Welcome to Ryluno. Three small steps. You can change everything later." onClose={onClose}>
    <ol className="stepper" aria-label="Setup steps">{['Your goal','Your time','First problem'].map((label,i) => <li key={label} aria-current={step === i ? 'step' : undefined}>{i+1}<span>{label}</span></li>)}</ol>
    <form onSubmit={e => {
      e.preventDefault();
      if (step === 0 && settings.interview && settings.interview < localParts(new Date(), settings.timezone).date) { setError('Choose today or a future interview date. No date yet? Leave it blank.'); return; }
      if (step === 1) {
        try { new Intl.DateTimeFormat('en', {timeZone:settings.timezone}).format(); } catch { setError('Try a timezone such as America/Toronto or Europe/London.'); return; }
        if (!settings.timezone.trim()) { setError('Add your timezone so we can plan the right times.'); return; }
        if (!settings.availability.length || settings.availability.some(w => !w.start || !w.end || w.end <= w.start)) { setError('Add a window with an end time later than its start.'); return; }
        if (!settings.availability.some(w => { const minutes=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3)); return minutes(w.end)-minutes(w.start)>=settings.length; })) { setError('Give yourself at least one window long enough for a study session, or shorten your session.'); return; }
      }
      if (step < 2) move(step+1); else finish(true);
    }}>
      {error && <p role="alert" className="alert">{error}</p>}
      <h3 ref={heading} tabIndex={-1} className="step-heading">{['Small goals make room for big things.','When does practice fit your life?','Start with something you’ve tried.'][step]}</h3>
      {step === 0 && <><Field label="How many sessions would you like each week?"><input type="number" min="1" max="21" required value={settings.goal} onChange={e=>setSettings({...settings,goal:Number(e.target.value)})}/></Field><p className="helper-note">Two or three is a great place to start. Consistency beats cramming.</p><Field label="Interview date (optional)"><input type="date" value={settings.interview} onChange={e=>setSettings({...settings,interview:e.target.value})}/></Field><Field label="What difficulty would you like to practice?"><select value={settings.difficulty} onChange={e=>setSettings({...settings,difficulty:e.target.value as Settings['difficulty']})}>{['Easy','Medium','Hard'].map(d=><option key={d}>{d}</option>)}</select></Field></>}
      {step === 1 && <><div className="form-grid"><Field label="Minutes per session"><input type="number" min="15" max="180" required value={settings.length} onChange={e=>setSettings({...settings,length:Number(e.target.value)})}/></Field><Field label="Your timezone"><input required value={settings.timezone} onChange={e=>setSettings({...settings,timezone:e.target.value.trim()})}/></Field></div><p className="helper-note">These are free-time windows, not commitments. Your plan will fit sessions inside them.</p>{settings.availability.map((w,i)=><div className="availability" key={i}><select aria-label={`Day for window ${i+1}`} value={w.day} onChange={e=>setSettings({...settings,availability:settings.availability.map((x,j)=>j===i?{...x,day:Number(e.target.value)}:x)})}>{days.map((d,j)=><option key={d} value={j}>{d}</option>)}</select><input aria-label={`Start for window ${i+1}`} type="time" required value={w.start} onChange={e=>setSettings({...settings,availability:settings.availability.map((x,j)=>j===i?{...x,start:e.target.value}:x)})}/><span>to</span><input aria-label={`End for window ${i+1}`} type="time" required value={w.end} onChange={e=>setSettings({...settings,availability:settings.availability.map((x,j)=>j===i?{...x,end:e.target.value}:x)})}/><button type="button" aria-label={`Remove window ${i+1}`} onClick={()=>setSettings({...settings,availability:settings.availability.filter((_,j)=>j!==i)})}><X size={16}/></button></div>)}<button type="button" onClick={()=>setSettings({...settings,availability:[...settings.availability,{day:1,start:'18:00',end:'20:00'}]})}><Plus size={16}/> Add a time window</button></>}
      {step === 2 && <div className="onboarding-finish"><div className="seedling" aria-hidden="true"><Sprout size={48}/></div><p>Pick any problem you’ve worked on, even if you didn’t solve it. Tell us how it went, and we’ll help you decide when to try it again.</p><div className="setup-recap"><strong>Your starting plan</strong><span>{settings.goal} sessions a week · {settings.length} minutes each</span><span>{settings.availability.length} availability windows · {settings.timezone}</span></div><p className="subtle">No practice to log yet? Save your setup and come back when you’re ready.</p></div>}
      <div className="modal-actions"><button type="button" onClick={()=>step ? move(step-1) : onClose()}>{step ? 'Back' : 'Set up later'}</button>{step === 2 && <button type="button" onClick={()=>finish(false)}>Save setup</button>}<button className="primary" type="submit">{step === 2 ? 'Log my first problem' : 'Continue'}<ArrowRight size={16}/></button></div>
    </form>
  </Dialog>;
}
