import type { Metadata } from 'next';
import './globals.css';
import './companion.css';
export const metadata: Metadata = { title: 'AlgoPilot — Your study companion', description: 'Adaptive interview preparation. Track attempts, strengthen recall, and build a study plan that fits your life.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
