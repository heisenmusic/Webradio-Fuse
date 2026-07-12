import { describe, expect, it } from "vitest";
import {
  announcementDueKey,
  classifyQuality,
  formatUptime,
  type ScheduledAnnouncement,
} from "./index";

const base: ScheduledAnnouncement = {
  id: "a1",
  label: "Teste",
  audioUrl: "https://cdn/x.mp3",
  time: "08:00",
  daysOfWeek: [],
  priority: "normal",
};

// Qua, 15 de abril de 2026 (dia da semana 3) — horário LOCAL do dispositivo.
const at = (h: number, m: number) => new Date(2026, 3, 15, h, m, 0);

describe("announcementDueKey — programação no horário do dispositivo", () => {
  it("dispara no minuto exato", () => {
    expect(announcementDueKey(base, at(8, 0))).toBe("a1:2026-4-15:480");
  });

  it("não dispara fora do minuto", () => {
    expect(announcementDueKey(base, at(7, 59))).toBeNull();
    expect(announcementDueKey(base, at(8, 1))).toBeNull();
  });

  it("respeita os dias da semana habilitados", () => {
    const weekdaysOnly = { ...base, daysOfWeek: [1, 2, 4, 5] }; // sem quarta (3)
    expect(announcementDueKey(weekdaysOnly, at(8, 0))).toBeNull();
    const withWednesday = { ...base, daysOfWeek: [3] };
    expect(announcementDueKey(withWednesday, at(8, 0))).not.toBeNull();
  });

  it("repete a cada N minutos após o horário base", () => {
    const repeating = { ...base, repeatEveryMin: 30 };
    expect(announcementDueKey(repeating, at(8, 30))).toBe("a1:2026-4-15:510");
    expect(announcementDueKey(repeating, at(9, 0))).toBe("a1:2026-4-15:540");
    expect(announcementDueKey(repeating, at(8, 15))).toBeNull();
    // não repete antes do horário base
    expect(announcementDueKey(repeating, at(7, 30))).toBeNull();
  });

  it("gera chave idempotente por minuto (evita disparo duplo)", () => {
    const k1 = announcementDueKey(base, at(8, 0));
    const k2 = announcementDueKey(base, new Date(2026, 3, 15, 8, 0, 42));
    expect(k1).toBe(k2);
  });

  it("respeita a janela de datas startsOn/endsOn", () => {
    const windowed = { ...base, startsOn: "2026-05-01", endsOn: "2026-05-31" };
    expect(announcementDueKey(windowed, at(8, 0))).toBeNull(); // antes da janela
    expect(announcementDueKey(windowed, new Date(2026, 4, 10, 8, 0))).not.toBeNull();
    expect(announcementDueKey(windowed, new Date(2026, 5, 10, 8, 0))).toBeNull(); // depois
  });

  it("ignora horário malformado", () => {
    expect(announcementDueKey({ ...base, time: "abc" }, at(8, 0))).toBeNull();
  });
});

describe("classifyQuality", () => {
  it("offline quando desconectado", () => {
    expect(classifyQuality({ stallsLast5Min: 0, online: false })).toBe("offline");
  });

  it("degrada conforme stalls acumulam", () => {
    expect(classifyQuality({ stallsLast5Min: 0, online: true })).toBe("excellent");
    expect(classifyQuality({ stallsLast5Min: 1, online: true })).toBe("good");
    expect(classifyQuality({ stallsLast5Min: 3, online: true })).toBe("fair");
    expect(classifyQuality({ stallsLast5Min: 6, online: true })).toBe("poor");
  });

  it("considera latência média", () => {
    expect(classifyQuality({ stallsLast5Min: 0, avgLatencyMs: 500, online: true })).toBe("good");
  });
});

describe("formatUptime", () => {
  it("formata segundos, minutos e horas", () => {
    expect(formatUptime(42)).toBe("42s");
    expect(formatUptime(125)).toBe("2m 05s");
    expect(formatUptime(3_725)).toBe("1h 02m");
  });
});
