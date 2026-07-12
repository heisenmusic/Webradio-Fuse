"use client";

import { useCallback, useEffect, useState } from "react";
import { Store as StoreIcon } from "lucide-react";
import { createStore, currentTenantId, listStores, type StoreDto } from "@/lib/api";
import {
  Card,
  DemoNotice,
  ErrorText,
  Field,
  PageHeader,
  PrimaryButton,
  inputCls,
  useAdminGate,
} from "@/components/admin/ui";

/** Cadastro de lojas do tenant. */
export default function StoresPage() {
  const gate = useAdminGate();
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      setStores(await listStores());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => {
    if (gate === "ready") void reload();
  }, [gate, reload]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tenantId = currentTenantId();
      if (!tenantId) throw new Error("Sessão sem tenant — faça login novamente.");
      await createStore({
        tenantId,
        code,
        name,
        city,
        state: state || undefined,
        timezone,
      });
      setCode("");
      setName("");
      setCity("");
      setState("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar loja");
    } finally {
      setSaving(false);
    }
  };

  if (gate === "demo") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <PageHeader title="Lojas" subtitle="Cadastro de lojas do tenant" />
        <DemoNotice />
      </main>
    );
  }
  if (gate !== "ready") return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        title="Lojas"
        subtitle="Cada loja executa a programação no seu próprio fuso — o campo timezone é informativo"
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-fuse-muted">
            Nova loja
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Código">
                <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="LOJA-002" className={inputCls} />
              </Field>
              <Field label="UF">
                <input value={state} onChange={(e) => setState(e.target.value)} placeholder="SP" className={inputCls} />
              </Field>
            </div>
            <Field label="Nome">
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Loja Center Norte" className={inputCls} />
            </Field>
            <Field label="Cidade">
              <input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo" className={inputCls} />
            </Field>
            <Field label="Timezone (IANA)">
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls} />
            </Field>
            <ErrorText error={error} />
            <PrimaryButton disabled={saving}>{saving ? "Salvando…" : "Criar loja"}</PrimaryButton>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-fuse-muted/70">
            Configure o player da loja com este código (painel de configurações do player) para que
            heartbeats, programação e comandos remotos sejam vinculados corretamente.
          </p>
        </Card>

        <div className="flex flex-col gap-3">
          {stores.length === 0 && (
            <Card className="text-center text-sm text-fuse-muted">
              <StoreIcon size={20} className="mx-auto mb-2 opacity-50" />
              Nenhuma loja cadastrada ainda.
            </Card>
          )}
          {stores.map((s) => (
            <Card key={s.id} className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="mt-0.5 text-sm text-fuse-muted">
                  {s.code} · {s.city}
                  {s.state ? `, ${s.state}` : ""} · {s.timezone}
                </div>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs capitalize text-fuse-muted">
                {s.health.toLowerCase().replace(/_/g, " ")}
              </span>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
