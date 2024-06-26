import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";

import "react-loading-skeleton/dist/skeleton.css"
import "simplebar-react/dist/simplebar.min.css"
import NextTopLoader from 'nextjs-toploader';

import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chat-pdf",
  description: "Chat with your PDFs",
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <NextTopLoader  color="#16a34a"/>
      
      <Providers>
      <body className={cn(
        'min-h-screen font-sans antialiased grainy',
        inter.className
      )}>
        <Toaster />
        <Navbar /> {children}</body>
      </Providers>
    </html>
  );
}
