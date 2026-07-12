"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Megaphone, Trash2, UploadCloud } from "lucide-react";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  listMedia,
  mediaUrl,
  uploadMedia,
  type AnnouncementDto,
  type MediaAssetDto,
} from "@/lib/api";
import {
  Card,
  DangerButton,
  DaysPicker,
  DemoNotice,
  ErrorText,
  Field,
  PageHeader,
  PrimaryButton,
  formatDays,
  inputCls,
  useAdminGate,
} from "@/components/admin/ui";

/** Gestão de avisos programados — executados no horário LOCAL de cada loja. */
export default function AnnouncementsPage() {
  const gate = useAdminGate();
  const [items, setItems] = useState<AnnouncementDto[]>([]);
  const [assets, setAssets] = useState<MediaAssetDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [time, setTime] = useState("08:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [priority, setPriority] = useState("NORMAL");
  const [category, setCategory] = useState("");
  const [assetId, setAssetId] = useState("");
  const [repeatEveryMin, setRepeatEveryMin] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      const [anns, media] = await Promise.all([listAnnouncements(), listMedia("AUDIO")]);
      setItems(anns);
      setAssets(media);
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
      setAssets((prev) => [asset, ...prev]);
      setAssetId(asset.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId) {
      setError("Envie ou selecione um áudio para o aviso.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAnnouncement({
        assetId,
        label,
        time,
        daysOfWeek: days,
        priority,
        category: category || undefined,
        repeatEveryMin: repeatEveryMin ? Number(repeatEveryMin) : undefined,
      });
      setLabel("");
      setCategory("");
      setRepeatEveryMin("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar aviso");
    } finally {
      setSaving(false);
    }
  };

  if (gate === "demo") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <PageHeader title="Avisos programados" subtitle="MP3, WAV e OGG no horário local de cada loja" />
        <DemoNotice />
      </main>
    );
  }
  if (gate !== "ready") return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        title="Avisos programados"
        subtitle="Enviados às lojas e executados no horário local do dispositivo"
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Formulário */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-fuse-muted">
            Novo aviso
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Título">
              <input
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex.: Promoção da tarde"
                className={inputCls}
              />
            </Field>

            <Field label="Áudio (MP3/WAV/OGG)">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-fuse-border px-4 py-4 text-sm text-fuse-muted transition-colors hover:border-fuse-primary hover:text-white disabled:opacity-50"
                >
                  <UploadCloud size={16} />
                  {uploading ? "Enviando…" : "Enviar novo áudio"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/ogg,audio/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
                    e.target.value = "";
                  }}
                />
                <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={inputCls}>
                  <option value="">— ou selecione um áudio existente —</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Horário local">
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Prioridade">
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                  <option value="LOW">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Crítica</option>
                </select>
              </Field>
            </div>

            <Field label="Dias da semana">
              <DaysPicker value={days} onChange={setDays} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria (opcional)">
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="promo, institucional…"
                  className={inputCls}
                />
              </Field>
              <Field label="Repetir a cada (min)">
                <input
                  type="number"
                  min={5}
                  value={repeatEveryMin}
                  onChange={(e) => setRepeatEveryMin(e.target.value)}
                  placeholder="—"
                  className={inputCls}
                />
              </Field>
            </div>

            <ErrorText error={error} />
            <PrimaryButton disabled={saving}>{saving ? "Salvando…" : "Criar aviso"}</PrimaryButton>
          </form>
        </Card>

        {/* Lista */}
        <div className="flex flex-col gap-3">
          {items.length === 0 && (
            <Card className="text-center text-sm text-fuse-muted">
              <Megaphone size={20} className="mx-auto mb-2 opacity-50" />
              Nenhum aviso programado ainda.
            </Card>
          )}
          {items.map((a) => (
            <Card key={a.id} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.label}</span>
                  <span className="rounded-full bg-fuse-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-fuse-primary-soft">
                    {a.priority}
                  </span>
                  {a.category && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-fuse-muted">
                      {a.category}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-fuse-muted">
                  {a.time} · {formatDays(a.daysOfWeek)}
                  {a.repeatEveryMin ? ` · repete a cada ${a.repeatEveryMin}min` : ""}
                </div>
                <audio controls preload="none" src={mediaUrl(a.asset.url)} className="mt-2 h-8 w-full max-w-xs" />
              </div>
              <DangerButton
                onClick={() => {
                  void deleteAnnouncement(a.id).then(reload);
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
