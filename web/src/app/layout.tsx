import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// the tool's font. latin-ext has the kahakō vowels (ā, ō, ū); Next downloads
// it at build time and serves it with the tool, so browsers don't call Google
const rubik = Rubik({
  subsets: ["latin", "latin-ext"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Feasim: Hawaii Housing Lab",
  description: "How housing policy changes what can be built on Hawaii parcels",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-US" className={rubik.variable}>
      <body>
        <div className="h-screen bg-[#eef2f6] text-slate-900">
          <main className="h-full">{children}</main>
        </div>
      </body>
    </html>
  );
}
