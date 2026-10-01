import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Splash, scriptSplash } from "@/components/splash/splash";
import { RegistrarServiceWorker } from "@/components/layout/registrar-sw";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "SIGNA · Logística", template: "%s · SIGNA" },
  description: "Pedidos de viaje, flota y depósito de Signa Desarrollos.",
  applicationName: "SIGNA",
  appleWebApp: { capable: true, title: "SIGNA", statusBarStyle: "black" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={archivo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptSplash }} />
        <link rel="preload" as="image" href="/img/inicio-app.jpg" media="(max-width: 1023px), (orientation: portrait)" />
        <link rel="preload" as="image" href="/img/inicio-sistema.jpg" media="(min-width: 1024px) and (orientation: landscape)" />
      </head>
      <body className="min-h-dvh font-sans">
        <Splash />
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
