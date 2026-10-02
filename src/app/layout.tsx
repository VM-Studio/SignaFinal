import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Splash, scriptSplash } from "@/components/splash/splash";
import { RegistrarSW } from "@/components/layout/registrar-sw";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Signa · Logística", template: "%s · Signa" },
  description: "Pedidos de viaje, flota y depósito de Signa Desarrollos.",
  applicationName: "Signa",
  appleWebApp: {
    capable: true,
    title: "Signa",
    statusBarStyle: "black",
    // Pantallas de inicio negras con el logo para iPhone (ancho × alto en píxeles físicos).
    startupImage: (
      [[1170, 2532, 3], [1179, 2556, 3], [1284, 2778, 3], [1290, 2796, 3], [1125, 2436, 3], [1242, 2688, 3], [828, 1792, 2], [750, 1334, 2], [1206, 2622, 3], [1320, 2868, 3]] as const
    ).map(([w, h, r]) => ({
      url: `/splash/inicio-${w}x${h}.png`,
      media: `(device-width: ${w / r}px) and (device-height: ${h / r}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
  icons: { icon: "/icons/favicon-48.png", apple: "/icons/apple-touch-icon.png" },
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
    <html lang="es-AR" className={inter.variable} style={{ backgroundColor: "#000000" }} suppressHydrationWarning>
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
