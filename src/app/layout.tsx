import type { Metadata } from "next";
import { Lora, Sora } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Identidade "Doctor Creator Ops": Lora para títulos, Sora para o
// restante da interface — usadas em todo o app, não só na tela de login.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Doctor Creator Ops",
  description:
    "Central de operação da agência: qualidade de roteiros, reuniões e visão geral dos clientes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${lora.variable} ${sora.variable} font-sans antialiased`}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
