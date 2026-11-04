import type { Metadata } from "next";
import "@fontsource-variable/source-sans-3";
import "@fontsource/frank-ruhl-libre/400.css";
import "@fontsource/frank-ruhl-libre/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "כולל ערב תורתך שעשועי – Attendance",
  description: "Attendance and payroll for Kollel Erev",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
