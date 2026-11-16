'use client';
import { useState } from 'react';
import type { Session } from '@/lib/types';
import { localParts, overlaps, zonedTime } from '@/lib/planner';
import { Dialog, Field } from './dialog';
export function RescheduleDialog({ session, sessions, timezone, onClose, onSave }: {
  session: Session; sessions: Session[]; timezone: string; onClose:()=>void; onSave:(s:Session)=>boolean;
}) {
  const p=localParts(new Date(session.start),timezone);
  const [value,setValue]=useState(`${p.date}T${p.time}`),[error,setError]=useState('');
  return <Dialog title="Find a better time" description={`Life happens. Move this session to a time that suits you. Times are in ${timezone}.`} onClose={onClose}><form onSubmit={e=>{
    e.preventDefault(); const date=zonedTime(value,timezone);
    if(!date||date<=new Date()){setError('Choose a future time. If the clocks change that day, try a different hour.');return;}
    const next={...session,start:date.toISOString(),end:new Date(date.getTime()+Date.parse(session.end)-Date.parse(session.start)).toISOString()};
    if(sessions.some(s=>s.id!==session.id&&s.status!=='skipped'&&overlaps(s,next))){setError('You already have a session then. Pick a time before or after it.');return;}
    if(!onSave(next))setError('We couldn’t save the new time. Please try again.');
  }}>{error&&<p className="alert" role="alert">{error}</p>}<Field label="New date and time"><input autoFocus type="datetime-local" required value={value} onChange={e=>setValue(e.target.value)}/></Field><p className="helper-note">Your {Math.round((Date.parse(session.end)-Date.parse(session.start))/60000)}-minute session can move outside your usual availability.</p><div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit">Move session</button></div></form></Dialog>;
}
