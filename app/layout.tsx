import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BoilerHub",
  description: "Purdue Unified Dashboard",
  manifest: "/manifest.json",
  themeColor: "#CEB888",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="text-black pb-20 font-sans">
        <main>{children}</main>
      </body>
    </html>
  );
}
