'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Native modal semantics provide focus containment and Escape handling. */
export function Dialog({ title, description, children, onClose }: {
  title: string; description?: string; children: ReactNode; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="dialog-title" aria-describedby={description ? 'dialog-description' : undefined} onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="section-heading">
      <div><h2 id="dialog-title">{title}</h2>{description && <p id="dialog-description">{description}</p>}</div>
      <button type="button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button>
    </div>
    {children}
  </dialog>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
