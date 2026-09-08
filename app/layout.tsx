import { Home, Book, Utensils, Search } from "lucide-react";
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
        
        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 w-full bg-purdue-black text-purdue-gold border-t border-gray-800 flex justify-around p-4 shadow-lg z-50">
          <button className="flex flex-col items-center hover:text-white transition"><Home size={24}/><span className="text-xs mt-1">Home</span></button>
          <button className="flex flex-col items-center hover:text-white transition"><Book size={24}/><span className="text-xs mt-1">Courses</span></button>
          <button className="flex flex-col items-center hover:text-white transition"><Utensils size={24}/><span className="text-xs mt-1">Dining</span></button>
          <button className="flex flex-col items-center hover:text-white transition"><Search size={24}/><span className="text-xs mt-1">Search</span></button>
        </nav>
      </body>
    </html>
  );
}
