import type { Metadata } from 'next';
import './globals.css';
import './companion.css';
export const metadata: Metadata = { title: 'Ryluno — Your study companion', description: 'An adaptive technical interview preparation companion with intelligent study planning and Fo-powered accountability.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
