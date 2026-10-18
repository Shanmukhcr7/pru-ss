import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../lib/authContext";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "ParentVision — iOS Parental Control & Live Screen Dashboard",
  description: "Secure, authenticated parental control dashboard and low-latency WebRTC live screen supervision platform for iOS devices.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white antialiased">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
          <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
            ParentVision Platform &bull; Apple ReplayKit & Screen Time Compliant &bull; End-to-End DTLS-SRTP Media
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
