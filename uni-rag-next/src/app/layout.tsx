// src/app/layout.tsx
import "./globals.css";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MFU AI Assistant – RAG Chatbot",
  description: "Multi-Agent AI Service for Students – MFU RAG Chatbot",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body className="app-body">
        {/* Global Topbar (Dynamic) */}
        <Navbar />

        {/* พื้นที่เนื้อหาของแต่ละหน้า */}
        <main className="global-main">{children}</main>
      </body>
    </html>
  );
}
