"use client";

// Piloto interno: upload de um modelo de referência -> extração da estrutura
// via IA -> render com marca/conteúdo novos. Sem preocupação de design ainda
// (uso só do time interno) — o objetivo aqui é validar o motor ponta a ponta.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EXAMPLE_CONTENT = JSON.stringify(
  [
    {
      title: "TSH",
      subtitle: "na mulher",
      cards: [
        { group: "low", label: "BAIXA /\nATENÇÃO", value: "< 0,4 mUI/L", bullets: ["Taquicardia e ansiedade", "Insônia e tremores", "Perda de peso"] },
        { group: "normal", label: "NORMAL /\nFAIXA FISIOLÓGICA", value: "0,4 – 4,0 mUI/L", bullets: ["Metabolismo equilibrado", "Energia estável", "Ciclo regular"] },
        { group: "high", label: "ALTA /\nATENÇÃO", value: "> 4,0 mUI/L", bullets: ["Fadiga e ganho de peso", "Queda de cabelo", "Frio constante"] },
      ],
      footerLabel: "IMPORTANTE",
      footerText: "TSH isolado não fecha diagnóstico — interpretar sempre com T4 livre e sintomas clínicos.",
    },
  ],
  null,
  2
);

export default function CarouselToolPage() {
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [specText, setSpecText] = useState("");
  const [contentText, setContentText] = useState(EXAMPLE_CONTENT);
  const [brandName, setBrandName] = useState("Dr. Exemplo");
  const [brandHandle, setBrandHandle] = useState("@drexemplo");
  const [brandPrimary, setBrandPrimary] = useState("#1b6fb8");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [mainPhotoFile, setMainPhotoFile] = useState<File | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    if (!referenceFile) return;
    setExtracting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", referenceFile);
      const res = await fetch("/api/carousel/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao extrair modelo.");
      setSpecText(JSON.stringify(data.spec, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleRender() {
    setRendering(true);
    setError(null);
    setImages([]);
    try {
      const spec = JSON.parse(specText);
      const slides = JSON.parse(contentText);
      const brand = {
        name: brandName,
        handle: brandHandle,
        primary: brandPrimary,
        avatarPhotoBase64: avatarFile ? await fileToBase64(avatarFile) : undefined,
        mainPhotoBase64: mainPhotoFile ? await fileToBase64(mainPhotoFile) : undefined,
      };

      const res = await fetch("/api/carousel/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, brand, slides }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao renderizar.");
      setImages(data.images);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Clonador de Carrossel (piloto interno)</h1>
        <p className="text-sm text-muted-foreground">
          Sobe um modelo de referência, extrai a estrutura, e gera de novo com marca/conteúdo diferentes.
          Sem tela bonita ainda — é só pra validar o motor.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Modelo de referência</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setReferenceFile(e.target.files?.[0] ?? null)}
          />
          <Button onClick={handleExtract} disabled={!referenceFile || extracting}>
            {extracting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Analisar modelo (extrair estrutura)
          </Button>
          <p className="text-xs text-muted-foreground">
            Requer <code>ANTHROPIC_API_KEY</code> configurada no ambiente. Sem ela, cole a spec manualmente abaixo.
          </p>
          <Label htmlFor="spec">Estrutura extraída (JSON — pode editar)</Label>
          <textarea
            id="spec"
            className="w-full h-64 font-mono text-xs border rounded-md p-2 bg-muted/20"
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            placeholder="Clique em 'Analisar modelo' ou cole uma spec manualmente."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Marca do cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Handle (@usuario)</Label>
            <Input value={brandHandle} onChange={(e) => setBrandHandle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cor primária</Label>
            <Input value={brandPrimary} onChange={(e) => setBrandPrimary(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Foto de perfil (avatar)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Foto principal (modelo/paciente)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setMainPhotoFile(e.target.files?.[0] ?? null)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Conteúdo dos slides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="content">Conteúdo (JSON — um objeto por slide)</Label>
          <textarea
            id="content"
            className="w-full h-56 font-mono text-xs border rounded-md p-2 bg-muted/20"
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
          />
          <Button onClick={handleRender} disabled={!specText || rendering}>
            {rendering && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Gerar slides
          </Button>
        </CardContent>
      </Card>

      {images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`data:image/png;base64,${img}`}
                alt={`Slide ${i + 1}`}
                className="rounded-md border w-full"
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
