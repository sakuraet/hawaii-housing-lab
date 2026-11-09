import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feasim: Hawaii Housing Lab",
  description: "How housing policy changes what can be built on Hawaii parcels",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-US">
      <body>
        <div className="h-screen bg-[#eef2f6] text-slate-900">
          <main className="h-full">{children}</main>
        </div>
      </body>
    </html>
  );
}
