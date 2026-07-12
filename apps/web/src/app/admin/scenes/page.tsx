"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Trash2, Wand2 } from "lucide-react";
import {
  createEvent,
  createScene,
  deleteScene,
  listScenes,
  type SceneDto,
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

const EVENT_KINDS = [
  ["OPENING", "Abertura"],
  ["LUNCH", "Almoço"],
  ["PROMOTION", "Promoção"],
  ["SHIFT_CHANGE", "Troca de turno"],
  ["CLOSING", "Fechamento"],
  ["CLEANING", "Limpeza"],
  ["INVENTORY", "Inventário"],
  ["CAMPAIGN", "Campanha"],
  ["CUSTOM", "Personalizado"],
] as const;

const ACTION_TEMPLATES = [
  { key: "volume-up", label: "Subir volume (90%)", action: { type: "set-volume", to: 0.9, rampSec: 3 } },
  { key: "volume-down", label: "Reduzir volume (35%)", action: { type: "set-volume", to: 0.35, rampSec: 6 } },
  { key: "viz-premium", label: "Visualizador Premium", action: { type: "set-visualizer", mode: "premium" } },
  { key: "viz-ambient", label: "Visualizador Ambient", action: { type: "set-visualizer", mode: "ambient" } },
  { key: "viz-neon", label: "Visualizador Neon", action: { type: "set-visualizer", mode: "neon" } },
  { key: "wait-5", label: "Aguardar 5s", action: { type: "wait", seconds: 5 } },
] as const;

/** Motor de automação: cenas (sequências de ações) e eventos operacionais. */
export default function ScenesPage() {
  const gate = useAdminGate();
  const [scenes, setScenes] = useState<SceneDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Nova cena
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Novo evento
  const [evtScene, setEvtScene] = useState("");
  const [evtKind, setEvtKind] = useState("OPENING");
  const [evtLabel, setEvtLabel] = useState("");
  const [evtTime, setEvtTime] = useState("08:00");
  const [evtDays, setEvtDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [savingEvt, setSavingEvt] = useState(false);

  const reload = useCallback(async () => {
    try {
      setScenes(await listScenes());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => {
    if (gate === "ready") void reload();
  }, [gate, reload]);

  const handleCreateScene = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const actions: unknown[] = ACTION_TEMPLATES.filter((t) =>
        selectedActions.includes(t.key),
      ).map((t) => t.action);
      if (message.trim()) {
        actions.push({ type: "show-message", text: message.trim(), durationSec: 10 });
      }
      if (actions.length === 0) throw new Error("Selecione ao menos uma ação para a cena.");
      await createScene({ name, description: description || undefined, actions });
      setName("");
      setDescription("");
      setMessage("");
      setSelectedActions([]);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar cena");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEvt(true);
    setError(null);
    try {
      if (!evtScene) throw new Error("Escolha a cena que o evento executa.");
      await createEvent({
        sceneId: evtScene,
        kind: evtKind,
        label: evtLabel,
        time: evtTime,
        daysOfWeek: evtDays,
      });
      setEvtLabel("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar evento");
    } finally {
      setSavingEvt(false);
    }
  };

  if (gate === "demo") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <PageHeader title="Cenas & Eventos" subtitle="Automação operacional das lojas" />
        <DemoNotice />
      </main>
    );
  }
  if (gate !== "ready") return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        title="Cenas & Eventos operacionais"
        subtitle="Abertura, almoço, promoção, fechamento… executados no horário local de cada loja"
      />
      <div className="mt-4">
        <ErrorText error={error} />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        {/* Nova cena */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-fuse-muted">
            <Wand2 size={14} /> Nova cena
          </h2>
          <form onSubmit={handleCreateScene} className="flex flex-col gap-4">
            <Field label="Nome">
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Abertura" className={inputCls} />
            </Field>
            <Field label="Descrição (opcional)">
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Ações (em sequência)">
              <div className="flex flex-col gap-1.5">
                {ACTION_TEMPLATES.map((t) => (
                  <label key={t.key} className="flex items-center gap-2 text-sm text-fuse-muted">
                    <input
                      type="checkbox"
                      checked={selectedActions.includes(t.key)}
                      onChange={(e) =>
                        setSelectedActions((prev) =>
                          e.target.checked ? [...prev, t.key] : prev.filter((k) => k !== t.key),
                        )
                      }
                      className="accent-fuse-primary"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Mensagem em tela (opcional)">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex.: Loja aberta — boas vendas!"
                className={inputCls}
              />
            </Field>
            <PrimaryButton disabled={saving}>{saving ? "Salvando…" : "Criar cena"}</PrimaryButton>
          </form>
        </Card>

        {/* Novo evento */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-fuse-muted">
            <CalendarClock size={14} /> Novo evento
          </h2>
          <form onSubmit={handleCreateEvent} className="flex flex-col gap-4">
            <Field label="Tipo">
              <select value={evtKind} onChange={(e) => setEvtKind(e.target.value)} className={inputCls}>
                {EVENT_KINDS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nome">
              <input required value={evtLabel} onChange={(e) => setEvtLabel(e.target.value)} placeholder="Ex.: Abertura das lojas" className={inputCls} />
            </Field>
            <Field label="Executa a cena">
              <select value={evtScene} onChange={(e) => setEvtScene(e.target.value)} className={inputCls}>
                <option value="">— selecione —</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Horário local">
              <input type="time" required value={evtTime} onChange={(e) => setEvtTime(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Dias da semana">
              <DaysPicker value={evtDays} onChange={setEvtDays} />
            </Field>
            <PrimaryButton disabled={savingEvt}>{savingEvt ? "Salvando…" : "Criar evento"}</PrimaryButton>
          </form>
        </Card>

        {/* Lista */}
        <div className="flex flex-col gap-3">
          {scenes.length === 0 && (
            <Card className="text-center text-sm text-fuse-muted">Nenhuma cena criada ainda.</Card>
          )}
          {scenes.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{s.name}</div>
                  {s.description && <div className="mt-0.5 text-sm text-fuse-muted">{s.description}</div>}
                  <div className="mt-1 text-xs text-fuse-muted/70">{s.actions.length} ações</div>
                </div>
                <DangerButton
                  onClick={() => {
                    void deleteScene(s.id).then(reload);
                  }}
                >
                  <Trash2 size={13} />
                </DangerButton>
              </div>
              {s.events.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5 border-t border-fuse-border/50 pt-3">
                  {s.events.map((e) => (
                    <div key={e.id} className="text-xs text-fuse-muted">
                      ⏱ {e.label} — {e.time} · {formatDays(e.daysOfWeek)}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
