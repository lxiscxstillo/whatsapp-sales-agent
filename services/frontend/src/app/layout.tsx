import type { Metadata } from 'next';
import './globals.css';
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'WhatsApp Sales Agent — Panel de Leads',
  description: 'Gestión de prospectos inmobiliarios via WhatsApp',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
