"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MonitorPlay, Trash2, UploadCloud } from "lucide-react";
import {
  createSignage,
  deleteSignage,
  listSignage,
  mediaUrl,
  uploadMedia,
  type SignageDto,
} from "@/lib/api";
import {
  Card,
  DangerButton,
  DemoNotice,
  ErrorText,
  Field,
  PageHeader,
  PrimaryButton,
  inputCls,
  useAdminGate,
} from "@/components/admin/ui";

const KINDS = [
  ["IMAGE", "Imagem"],
  ["BANNER", "Banner"],
  ["CAMPAIGN", "Campanha"],
  ["NOTICE", "Comunicado"],
  ["GOAL", "Meta"],
  ["RANKING", "Ranking de vendas"],
  ["QR_CODE", "QR Code"],
] as const;

const IMAGE_KINDS = ["IMAGE", "BANNER", "CAMPAIGN", "QR_CODE"];

/** Digital Signage — conteúdo visual exibido nos players das lojas. */
export default function SignagePage() {
  const gate = useAdminGate();
  const [items, setItems] = useState<SignageDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState("NOTICE");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [durationSec, setDurationSec] = useState("15");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isImageKind = IMAGE_KINDS.includes(kind);

  const reload = useCallback(async () => {
    try {
      setItems(await listSignage());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => {
    if (gate === "ready") void reload();
  }, [gate, reload]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const asset = await uploadMedia(file);
      setAssetUrl(asset.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isImageKind && !assetUrl) throw new Error("Envie a imagem do conteúdo.");
      await createSignage({
        kind,
        title,
        body: body || undefined,
        assetUrl: assetUrl || undefined,
        durationSec: Number(durationSec) || 15,
      });
      setTitle("");
      setBody("");
      setAssetUrl("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar conteúdo");
    } finally {
      setSaving(false);
    }
  };

  if (gate === "demo") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <PageHeader title="Digital Signage" subtitle="Conteúdo visual dos players" />
        <DemoNotice />
      </main>
    );
  }
  if (gate !== "ready") return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        title="Digital Signage"
        subtitle="Imagens, banners, campanhas, metas e comunicados exibidos nos players"
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-fuse-muted">
            Novo conteúdo
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Tipo">
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
                {KINDS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Título">
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </Field>
            {isImageKind ? (
              <Field label="Imagem">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-fuse-border px-4 py-4 text-sm text-fuse-muted transition-colors hover:border-fuse-primary hover:text-white disabled:opacity-50"
                >
                  <UploadCloud size={16} />
                  {uploading ? "Enviando…" : assetUrl ? "Imagem enviada ✓" : "Enviar imagem"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </Field>
            ) : (
              <Field label="Texto">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="Conteúdo exibido em tela"
                  className={inputCls}
                />
              </Field>
            )}
            <Field label="Duração em tela (segundos)">
              <input
                type="number"
                min={3}
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                className={inputCls}
              />
            </Field>
            <ErrorText error={error} />
            <PrimaryButton disabled={saving}>{saving ? "Salvando…" : "Publicar"}</PrimaryButton>
          </form>
        </Card>

        <div className="flex flex-col gap-3">
          {items.length === 0 && (
            <Card className="text-center text-sm text-fuse-muted">
              <MonitorPlay size={20} className="mx-auto mb-2 opacity-50" />
              Nenhum conteúdo publicado ainda.
            </Card>
          )}
          {items.map((s) => (
            <Card key={s.id} className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                {s.assetUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(s.assetUrl)}
                    alt={s.title}
                    className="h-14 w-20 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.title}</span>
                    <span className="rounded-full bg-fuse-accent/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-fuse-accent">
                      {s.kind}
                    </span>
                  </div>
                  {s.body && <div className="mt-0.5 truncate text-sm text-fuse-muted">{s.body}</div>}
                  <div className="mt-0.5 text-xs text-fuse-muted/70">{s.durationSec}s em tela</div>
                </div>
              </div>
              <DangerButton
                onClick={() => {
                  void deleteSignage(s.id).then(reload);
                }}
              >
                <Trash2 size={13} />
              </DangerButton>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
