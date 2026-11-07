import "./globals.css";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import InstallPwaPrompt from "@/components/pwa/InstallPwaPrompt";

export const metadata = {
  title: "Village Finance",
  description: "Village Finance Management System — Micro-Lending & Rural Collection Routes",
  manifest: "/manifest.json",
  applicationName: "Village Finance",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Village Finance",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen font-sans selection:bg-blue-600 selection:text-white">
        <ServiceWorkerRegister />
        <InstallPwaPrompt />
        {children}
      </body>
    </html>
  );
}
