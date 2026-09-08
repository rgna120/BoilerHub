import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "BoilerHub",
  description: "Purdue Unified Dashboard",
  manifest: "/manifest.json",
};

export const viewport: Viewport = { themeColor: "#CEB888" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="text-black">
        <main>{children}</main>
      </body>
    </html>
  );
}
