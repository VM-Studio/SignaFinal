import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Splash, scriptSplash } from "@/components/splash/splash";
import { RegistrarSW } from "@/components/layout/registrar-sw";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SIGNA · Logística", template: "%s · SIGNA" },
  description: "Pedidos de viaje, flota y depósito de Signa Desarrollos.",
  applicationName: "SIGNA",
  appleWebApp: { capable: true, title: "SIGNA", statusBarStyle: "black" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function LayoutRaiz({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={archivo.variable} style={{ backgroundColor: "#000000" }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptSplash }} />
      </head>
      <body className="min-h-dvh font-sans">
        <Splash />
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
