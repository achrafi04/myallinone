"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Exo = { id: string; name: string; muscles: string[]; imageUrl?: string };
type SetEntry = { exoId: string; weightKg: number; reps: number; rpe?: number };
type WorkoutLog = { id: string; dateISO: string; dayType: "PUSH" | "PULL" | "LEGS"; notes?: string; sets: SetEntry[] };
type WeightLog = { dateISO: string; weightKg: number };

type Reminder = { id: string; title: string; timeHHMM: string; enabled: boolean; kind: "water" | "meal" | "supp" };
type WaterLog = { date: string; ml: number };

type NutritionState = {
  todaysChecklist: Record<string, boolean>;
  notes: string;
};

type AppState = {
  waterGoalMl: number;
  waterTodayMl: number;
  waterTodayDate: string;
  waterHistory: WaterLog[]; // for graphs
  bodyweight: WeightLog[];

  exercises: Exo[];
  workoutTemplates: Record<WorkoutLog["dayType"], { exoId: string; defaultRestSec: number }[]>;
  logs: WorkoutLog[];

  reminders: Reminder[];
  nutrition: NutritionState;
};

const LS_KEY = "myallinone_v2";
const todayKey = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const DEFAULT_EXOS: Exo[] = [
  { id: "incline_db_press", name: "Incline Dumbbell Bench Press", muscles: ["chest", "front delts", "triceps"] },
  { id: "bench_press", name: "Barbell Bench Press", muscles: ["chest", "triceps"] },
  { id: "pec_deck", name: "Chest Butterfly / Pec Deck", muscles: ["chest"] },
  { id: "lat_pulldown", name: "Lat Pulldown", muscles: ["lats", "back"] },
  { id: "1arm_row", name: "One-Arm Dumbbell Row", muscles: ["lats", "back"] },
  { id: "cable_row", name: "Seated Cable Row", muscles: ["back"] },
  { id: "pullover", name: "Cable Pullover", muscles: ["lats"] },
  { id: "lateral_raise", name: "Lateral Raise", muscles: ["side delts"] },
  { id: "triceps_ext", name: "Machine Tricep Extension", muscles: ["triceps"] },
  { id: "ez_curl", name: "EZ Bar Curl", muscles: ["biceps"] },
  { id: "incline_curl", name: "Incline Dumbbell Curl", muscles: ["biceps"] },
  { id: "leg_press", name: "Leg Press", muscles: ["legs"] },
  { id: "leg_curl", name: "Leg Curl", muscles: ["hamstrings"] },
  { id: "leg_ext", name: "Leg Extension", muscles: ["quads"] },
  { id: "calves", name: "Standing Calf Raise", muscles: ["calves"] },
];

const DEFAULT_STATE: AppState = {
  waterGoalMl: 3000,
  waterTodayMl: 0,
  waterTodayDate: todayKey(),
  waterHistory: [],
  bodyweight: [],
  exercises: DEFAULT_EXOS,
  workoutTemplates: {
    PUSH: [
      { exoId: "incline_db_press", defaultRestSec: 120 },
      { exoId: "bench_press", defaultRestSec: 150 },
      { exoId: "pec_deck", defaultRestSec: 90 },
      { exoId: "lateral_raise", defaultRestSec: 75 },
      { exoId: "triceps_ext", defaultRestSec: 75 },
    ],
    PULL: [
      { exoId: "lat_pulldown", defaultRestSec: 120 },
      { exoId: "1arm_row", defaultRestSec: 120 },
      { exoId: "cable_row", defaultRestSec: 105 },
      { exoId: "pullover", defaultRestSec: 75 },
      { exoId: "ez_curl", defaultRestSec: 75 },
      { exoId: "incline_curl", defaultRestSec: 75 },
    ],
    LEGS: [
      { exoId: "leg_press", defaultRestSec: 150 },
      { exoId: "leg_curl", defaultRestSec: 90 },
      { exoId: "leg_ext", defaultRestSec: 90 },
      { exoId: "calves", defaultRestSec: 75 },
    ],
  },
  logs: [],
  reminders: [
    { id: "r1", title: "Eau (500ml)", timeHHMM: "10:30", enabled: true, kind: "water" },
    { id: "r2", title: "Déjeuner / repas", timeHHMM: "13:30", enabled: true, kind: "meal" },
    { id: "r3", title: "Collation", timeHHMM: "17:00", enabled: true, kind: "meal" },
    { id: "r4", title: "Créatine (5g)", timeHHMM: "19:30", enabled: true, kind: "supp" },
  ],
  nutrition: {
    todaysChecklist: {
      "Petit-déj (même petit)": false,
      "Déjeuner": false,
      "Collation": false,
      "Dîner": false,
      "Eau ≥ 2.5L": false,
      "Créatine 5g": false,
    },
    notes: "",
  },
};

function loadState(): AppState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as AppState;

    // rollover water each new day
    const t = todayKey();
    if (parsed.waterTodayDate !== t) {
      // save yesterday into history
      const prevDate = parsed.waterTodayDate;
      const prevMl = parsed.waterTodayMl;
      if (prevDate) {
        const hist = (parsed.waterHistory || []).filter((x) => x.date !== prevDate);
        hist.push({ date: prevDate, ml: prevMl || 0 });
        parsed.waterHistory = hist;
      }
      parsed.waterTodayDate = t;
      parsed.waterTodayMl = 0;

      // reset daily checklist
      if (parsed.nutrition?.todaysChecklist) {
        Object.keys(parsed.nutrition.todaysChecklist).forEach((k) => (parsed.nutrition.todaysChecklist[k] = false));
      }
    }

    parsed.exercises ||= DEFAULT_EXOS;
    parsed.workoutTemplates ||= DEFAULT_STATE.workoutTemplates;
    parsed.logs ||= [];
    parsed.bodyweight ||= [];
    parsed.waterGoalMl ||= 3000;
    parsed.waterHistory ||= [];
    parsed.reminders ||= DEFAULT_STATE.reminders;
    parsed.nutrition ||= DEFAULT_STATE.nutrition;

    return parsed;
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(s: AppState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.04;
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 180);
  } catch {}
}

function minutesUntil(hhmm: string) {
  const [hh, mm] = hhmm.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  let diff = target.getTime() - now.getTime();
  if (diff < 0) diff += 24 * 60 * 60 * 1000; // tomorrow
  return Math.floor(diff / 60000);
}

function msUntil(hhmm: string) {
  const [hh, mm] = hhmm.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  let diff = target.getTime() - now.getTime();
  if (diff < 0) diff += 24 * 60 * 60 * 1000;
  return diff;
}

function requestNotifPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function fireNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification(title, { body });
}

export default function Page() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [tab, setTab] = useState<"TODAY" | "WORKOUT" | "LIB" | "STATS" | "REMIND" | "NUTRI">("TODAY");

  // rest timer
  const [restSec, setRestSec] = useState<number>(0);
  const [restRunning, setRestRunning] = useState(false);
  const restRef = useRef<number | null>(null);

  useEffect(() => saveState(state), [state]);

  useEffect(() => {
    if (!restRunning) return;
    restRef.current = window.setInterval(() => {
      setRestSec((s) => {
        if (s <= 1) {
          beep();
          setRestRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (restRef.current) window.clearInterval(restRef.current);
    };
  }, [restRunning]);

  // ===== reminders loop (simple, app-open only) =====
  const [nowTick, setNowTick] = useState(0);
  const firedTodayRef = useRef<Record<string, string>>({}); // reminderId -> YYYY-MM-DD last fired
  useEffect(() => {
    const t = window.setInterval(() => setNowTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const today = todayKey();
    state.reminders.forEach((r) => {
      if (!r.enabled) return;
      const ms = msUntil(r.timeHHMM);
      // fire within first 2 seconds of the target minute
      if (ms <= 1500) {
        if (firedTodayRef.current[r.id] === today) return;
        firedTodayRef.current[r.id] = today;
        beep();
        fireNotification("Rappel", r.title);
      }
    });
  }, [nowTick, state.reminders]);

  const waterPct = Math.min(100, Math.round((state.waterTodayMl / state.waterGoalMl) * 100));

  const exoById = useMemo(() => {
    const m = new Map<string, Exo>();
    state.exercises.forEach((e) => m.set(e.id, e));
    return m;
  }, [state.exercises]);

  // water
  const addWater = (ml: number) => {
    setState((s) => ({ ...s, waterTodayMl: Math.max(0, s.waterTodayMl + ml) }));
  };

  // weight
  const addBodyWeight = (w: number) => {
    const d = todayKey();
    setState((s) => {
      const filtered = s.bodyweight.filter((x) => x.dateISO !== d);
      return { ...s, bodyweight: [...filtered, { dateISO: d, weightKg: w }].sort((a, b) => a.dateISO.localeCompare(b.dateISO)) };
    });
  };

  // workout
  const [dayType, setDayType] = useState<WorkoutLog["dayType"]>("PUSH");
  const [activeLog, setActiveLog] = useState<WorkoutLog>(() => ({ id: uid(), dateISO: new Date().toISOString(), dayType: "PUSH", sets: [] }));

  useEffect(() => setActiveLog((l) => ({ ...l, dayType })), [dayType]);

  const addSet = (exoId: string) => {
    const last = [...state.logs]
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
      .flatMap((l) => l.sets)
      .find((s) => s.exoId === exoId);
    const suggested = last?.weightKg ?? 0;
    setActiveLog((l) => ({ ...l, sets: [...l.sets, { exoId, weightKg: suggested, reps: last?.reps ?? 10 }] }));
  };

  const updateSet = (idx: number, patch: Partial<SetEntry>) => {
    setActiveLog((l) => {
      const sets = l.sets.slice();
      sets[idx] = { ...sets[idx], ...patch };
      return { ...l, sets };
    });
  };

  const removeSet = (idx: number) => {
    setActiveLog((l) => {
      const sets = l.sets.slice();
      sets.splice(idx, 1);
      return { ...l, sets };
    });
  };

  const startRest = (sec: number) => {
    requestNotifPermission();
    setRestSec(sec);
    setRestRunning(true);
  };

  const saveWorkout = () => {
    if (activeLog.sets.length === 0) return;
    const toSave: WorkoutLog = { ...activeLog, id: uid(), dateISO: new Date().toISOString() };
    setState((s) => ({ ...s, logs: [toSave, ...s.logs] }));
    setActiveLog({ id: uid(), dateISO: new Date().toISOString(), dayType, sets: [], notes: "" });
  };

  // library
  const addExercise = (name: string, musclesCSV: string, imageUrl: string) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) + "_" + Math.random().toString(36).slice(2, 6);
    const muscles = musclesCSV.split(",").map((x) => x.trim()).filter(Boolean);
    setState((s) => ({ ...s, exercises: [...s.exercises, { id, name, muscles, imageUrl: imageUrl || undefined }] }));
  };

  const updateExerciseImage = (id: string, imageUrl: string) => {
    setState((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === id ? { ...e, imageUrl: imageUrl || undefined } : e)) }));
  };

  // reminders management
  const toggleReminder = (id: string) => setState((s) => ({ ...s, reminders: s.reminders.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) }));
  const updateReminderTime = (id: string, timeHHMM: string) => setState((s) => ({ ...s, reminders: s.reminders.map((r) => (r.id === id ? { ...r, timeHHMM } : r)) }));
  const addReminder = () =>
    setState((s) => ({
      ...s,
      reminders: [...s.reminders, { id: uid(), title: "Nouveau rappel", timeHHMM: "12:00", enabled: true, kind: "meal" }],
    }));
  const updateReminderTitle = (id: string, title: string) => setState((s) => ({ ...s, reminders: s.reminders.map((r) => (r.id === id ? { ...r, title } : r)) }));
  const removeReminder = (id: string) => setState((s) => ({ ...s, reminders: s.reminders.filter((r) => r.id !== id) }));

  // nutrition
  const toggleCheck = (k: string) =>
    setState((s) => ({ ...s, nutrition: { ...s.nutrition, todaysChecklist: { ...s.nutrition.todaysChecklist, [k]: !s.nutrition.todaysChecklist[k] } } }));

  const recentLogs = state.logs.slice(0, 5);
  const latestWeight = [...state.bodyweight].sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0]?.weightKg;

  // Graph data helpers
  const waterLast7 = useMemo(() => {
    const t = todayKey();
    const days: string[] = [];
    const dt = new Date(t);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(dt);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const map = new Map<string, number>();
    (state.waterHistory || []).forEach((x) => map.set(x.date, x.ml));
    map.set(t, state.waterTodayMl);
    return days.map((d) => ({ date: d, ml: map.get(d) || 0 }));
  }, [state.waterHistory, state.waterTodayMl]);

  const weightLast30 = useMemo(() => {
    const sorted = [...state.bodyweight].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    // keep last 30 unique dates
    return sorted.slice(-30);
  }, [state.bodyweight]);

  return (
    <div className="wrap">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="h1">MyAllInOneTracker</div>
          <div className="muted">Gym • Eau • Poids • Rappels • Nutrition</div>
        </div>
        <div className="row">
          <button className={`btn ${tab === "TODAY" ? "primary" : ""}`} onClick={() => setTab("TODAY")}>Aujourd’hui</button>
          <button className={`btn ${tab === "WORKOUT" ? "primary" : ""}`} onClick={() => setTab("WORKOUT")}>Salle</button>
          <button className={`btn ${tab === "NUTRI" ? "primary" : ""}`} onClick={() => setTab("NUTRI")}>Nutrition</button>
          <button className={`btn ${tab === "REMIND" ? "primary" : ""}`} onClick={() => setTab("REMIND")}>Rappels</button>
          <button className={`btn ${tab === "LIB" ? "primary" : ""}`} onClick={() => setTab("LIB")}>Exos</button>
          <button className={`btn ${tab === "STATS" ? "primary" : ""}`} onClick={() => setTab("STATS")}>Stats</button>
        </div>
      </div>

      <div className="sep" />

      {tab === "TODAY" && (
        <div className="grid cols2">
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="muted">Eau (objectif {state.waterGoalMl} ml)</div>
                <div className="big">{waterPct}%</div>
                <div className="muted">{state.waterTodayMl} ml aujourd’hui</div>
              </div>
              <div className="pill">{todayKey()}</div>
            </div>
            <div className="sep" />
            <div className="row">
              <button className="btn" onClick={() => addWater(250)}>+250ml</button>
              <button className="btn" onClick={() => addWater(500)}>+500ml</button>
              <button className="btn" onClick={() => addWater(750)}>+750ml</button>
              <button className="btn danger" onClick={() => addWater(-250)}>-250ml</button>
            </div>
            <div className="sep" />
            <div className="row">
              <label className="muted">Objectif (ml):</label>
              <input className="input" type="number" value={state.waterGoalMl} onChange={(e) => setState((s) => ({ ...s, waterGoalMl: Math.max(500, Number(e.target.value || 0)) }))} />
            </div>
          </div>

          <div className="card">
            <div className="muted">Poids du corps</div>
            <div className="big">{latestWeight ? `${latestWeight} kg` : "—"}</div>
            <div className="muted">Note ton poids (1x/jour)</div>
            <div className="sep" />
            <WeightInput onSave={addBodyWeight} />
            <div className="sep" />
            <div className="muted">Derniers poids :</div>
            <div className="list">
              {[...state.bodyweight].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).slice(0, 6).map((w) => (
                <div key={w.dateISO} className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">{w.dateISO}</span>
                  <span>{w.weightKg} kg</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="muted">Chrono repos</div>
            <div className="big">{formatTime(restSec)}</div>
            <div className="row">
              <button className="btn" onClick={() => startRest(60)}>1:00</button>
              <button className="btn" onClick={() => startRest(90)}>1:30</button>
              <button className="btn" onClick={() => startRest(120)}>2:00</button>
              <button className="btn" onClick={() => startRest(150)}>2:30</button>
              <button className="btn" onClick={() => startRest(180)}>3:00</button>
            </div>
            <div className="sep" />
            <div className="row">
              <button className="btn" disabled={!restRunning} onClick={() => setRestRunning(false)}>Pause</button>
              <button className="btn" onClick={() => { setRestRunning(false); setRestSec(0); }}>Stop</button>
              <button className="btn" disabled={restRunning || restSec === 0} onClick={() => setRestRunning(true)}>Reprendre</button>
            </div>
          </div>

          <div className="card">
            <div className="muted">Dernières séances</div>
            <div className="sep" />
            <div className="list">
              {recentLogs.length === 0 && <div className="muted">Aucune séance enregistrée.</div>}
              {recentLogs.map((l) => (
                <div key={l.id} className="row" style={{ justifyContent: "space-between" }}>
                  <span className="pill">{l.dayType}</span>
                  <span className="muted">{new Date(l.dateISO).toLocaleString("fr-FR")}</span>
                  <span>{l.sets.length} séries</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "WORKOUT" && (
        <div className="grid cols2">
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="muted">Séance</div>
                <div className="h1" style={{ margin: 0 }}>{dayType}</div>
              </div>
              <div className="row">
                <select className="select" value={dayType} onChange={(e) => setDayType(e.target.value as any)}>
                  <option value="PUSH">PUSH</option>
                  <option value="PULL">PULL</option>
                  <option value="LEGS">LEGS</option>
                </select>
                <button className="btn primary" onClick={saveWorkout} disabled={activeLog.sets.length === 0}>Enregistrer</button>
              </div>
            </div>

            <div className="sep" />
            <div className="muted">Ajoute tes séries (kg + reps). Le poids se pré-remplit depuis ta dernière séance.</div>

            <div className="sep" />
            <div className="list">
              {state.workoutTemplates[dayType].map((t) => {
                const exo = exoById.get(t.exoId);
                if (!exo) return null;
                return (
                  <div key={t.exoId} className="card" style={{ padding: 12 }}>
                    {exo.imageUrl ? <img className="exo" src={exo.imageUrl} alt={exo.name} /> : null}
                    <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{exo.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{exo.muscles.join(" • ")}</div>
                      </div>
                      <div className="row">
                        <button className="btn" onClick={() => startRest(t.defaultRestSec)}>Repos {formatTime(t.defaultRestSec)}</button>
                        <button className="btn primary" onClick={() => addSet(t.exoId)}>+ Série</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sep" />
            <div className="muted">Notes séance</div>
            <textarea className="textarea" value={activeLog.notes || ""} onChange={(e) => setActiveLog((l) => ({ ...l, notes: e.target.value }))} placeholder="Ex: +2.5kg, bonne forme, fatigué..." />
          </div>

          <div className="card">
            <div className="muted">Séries (séance en cours)</div>
            <div className="sep" />
            {activeLog.sets.length === 0 && <div className="muted">Ajoute une série sur un exercice.</div>}
            <div className="list">
              {activeLog.sets.map((s, idx) => {
                const exo = exoById.get(s.exoId);
                return (
                  <div key={idx} className="card" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 800 }}>{exo?.name || s.exoId}</div>
                      <button className="btn danger" onClick={() => removeSet(idx)}>Suppr</button>
                    </div>
                    <div className="sep" />
                    <div className="set">
                      <div className="name"><span className="muted">Série #{idx + 1}</span></div>
                      <input className="input" type="number" value={s.weightKg} onChange={(e) => updateSet(idx, { weightKg: Number(e.target.value || 0) })} placeholder="kg" />
                      <input className="input" type="number" value={s.reps} onChange={(e) => updateSet(idx, { reps: Number(e.target.value || 0) })} placeholder="reps" />
                      <input className="input" type="number" value={s.rpe ?? ""} onChange={(e) => updateSet(idx, { rpe: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="RPE" />
                    </div>
                    <div className="sep" />
                    <div className="row">
                      <button className="btn" onClick={() => startRest(60)}>1:00</button>
                      <button className="btn" onClick={() => startRest(90)}>1:30</button>
                      <button className="btn" onClick={() => startRest(120)}>2:00</button>
                      <button className="btn" onClick={() => startRest(150)}>2:30</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sep" />
            <div className="muted">Chrono : <b>{formatTime(restSec)}</b> {restRunning ? "(go)" : ""}</div>
            <div className="row">
              <button className="btn" onClick={() => setRestRunning((x) => !x)} disabled={restSec === 0}>{restRunning ? "Pause" : "Reprendre"}</button>
              <button className="btn" onClick={() => { setRestRunning(false); setRestSec(0); }}>Stop</button>
            </div>
          </div>
        </div>
      )}

      {tab === "NUTRI" && (
        <div className="grid cols2">
          <div className="card">
            <div className="h1">Plan alimentaire simple (anti-skip)</div>
            <div className="muted">Objectif: 4 prises minimum. Simple, répétable, efficace.</div>
            <div className="sep" />

            <div className="list">
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 900 }}>Petit-déj (2–5 min)</div>
                <div className="muted">Option KO: yaourt + banane / ou 2–4 œufs + pommes de terre.</div>
                <div className="sep" />
                <div className="muted">Idées :</div>
                <ul style={{ marginTop: 6 }}>
                  <li>2–4 œufs + pommes de terre (ou pain)</li>
                  <li>Yaourt + amandes + banane</li>
                  <li>Thon sandwich (si t’as pas faim tôt)</li>
                </ul>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 900 }}>Déjeuner</div>
                <ul style={{ marginTop: 6 }}>
                  <li>Riz basmati + kefta (ou saucisse si dispo) + yaourt</li>
                  <li>Riz + thon + huile d’olive (calories faciles)</li>
                </ul>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 900 }}>Collation (obligatoire)</div>
                <div className="muted">Si tu rates un repas, tu prends au moins ça.</div>
                <ul style={{ marginTop: 6 }}>
                  <li>Yaourt + amandes (20–30g = petite poignée)</li>
                  <li>Sandwich thon</li>
                  <li>Lait (optionnel) + banane</li>
                </ul>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 900 }}>Dîner</div>
                <ul style={{ marginTop: 6 }}>
                  <li>Pomme de terre + omelette (3–4 œufs)</li>
                  <li>Riz + thon + yaourt</li>
                  <li>Kefta + pommes de terre (poêle / four)</li>
                </ul>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 900 }}>Recettes rapides</div>
                <ul style={{ marginTop: 6 }}>
                  <li><b>Riz + thon</b> : riz basmati + thon + huile d’olive + sel/poivre/citron.</li>
                  <li><b>Kefta poêle</b> : kefta + oignon + épices + riz/pdt.</li>
                  <li><b>Omelette solide</b> : 3–4 œufs + oignon + épices (avec pdt).</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="h1">Checklist du jour</div>
            <div className="muted">Tu coches. Zéro prise de tête.</div>
            <div className="sep" />
            <div className="list">
              {Object.entries(state.nutrition.todaysChecklist).map(([k, v]) => (
                <div key={k} className="row" style={{ justifyContent: "space-between" }}>
                  <span>{k}</span>
                  <button className={`btn ${v ? "primary" : ""}`} onClick={() => toggleCheck(k)}>{v ? "✅" : "⬜"}</button>
                </div>
              ))}
            </div>

            <div className="sep" />
            <div className="muted">Notes nutrition</div>
            <textarea className="textarea" value={state.nutrition.notes} onChange={(e) => setState((s) => ({ ...s, nutrition: { ...s.nutrition, notes: e.target.value } }))} placeholder="Ex: faim faible matin, manger plus tôt, etc." />
          </div>
        </div>
      )}

      {tab === "REMIND" && (
        <div className="grid cols2">
          <div className="card">
            <div className="h1">Rappels (simple)</div>
            <div className="muted">
              Ça bip + notif <b>quand l’app est ouverte</b>. (Sur iPhone: ouvre l’app en mode “écran d’accueil”, ça suffit.)
            </div>
            <div className="sep" />
            <div className="row">
              <button className="btn primary" onClick={() => { requestNotifPermission(); fireNotification("Test", "Notifications activées ✅"); }}>Activer notifications</button>
              <button className="btn" onClick={addReminder}>+ Ajouter rappel</button>
            </div>
            <div className="sep" />

            <div className="list">
              {state.reminders.map((r) => (
                <div key={r.id} className="card" style={{ padding: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 900 }}>{r.title}</div>
                    <button className="btn danger" onClick={() => removeReminder(r.id)}>Suppr</button>
                  </div>

                  <div className="sep" />
                  <div className="row">
                    <label className="muted">Heure</label>
                    <input className="input" type="time" value={r.timeHHMM} onChange={(e) => updateReminderTime(r.id, e.target.value)} />
                    <span className="pill">dans ~{minutesUntil(r.timeHHMM)} min</span>
                    <button className={`btn ${r.enabled ? "primary" : ""}`} onClick={() => toggleReminder(r.id)}>
                      {r.enabled ? "Activé" : "Désactivé"}
                    </button>
                  </div>

                  <div className="sep" />
                  <input className="input" value={r.title} onChange={(e) => updateReminderTitle(r.id, e.target.value)} placeholder="Titre du rappel" style={{ width: "100%" }} />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="h1">Rappels conseillés (prise de masse)</div>
            <div className="sep" />
            <ul>
              <li>10:30 → Eau 500ml</li>
              <li>13:30 → Déjeuner</li>
              <li>17:00 → Collation</li>
              <li>20:30 → Dîner</li>
              <li>Après séance → Créatine 5g + gainer</li>
            </ul>
            <div className="sep" />
            <div className="muted">
              Tip: laisse l’app ouverte pendant la séance → tu auras tes rappels + chrono repos.
            </div>
          </div>
        </div>
      )}

      {tab === "LIB" && (
        <div className="grid cols2">
          <div className="card">
            <div className="h1">Ajouter un exercice</div>
            <AddExerciseForm onAdd={addExercise} />
            <div className="sep" />
            <div className="muted">Images : colle une URL d’image (optionnel).</div>
          </div>
          <div className="card">
            <div className="h1">Bibliothèque</div>
            <div className="list">
              {state.exercises.map((e) => (
                <div key={e.id} className="card" style={{ padding: 12 }}>
                  {e.imageUrl ? <img className="exo" src={e.imageUrl} alt={e.name} /> : null}
                  <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{e.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{e.muscles.join(" • ")}</div>
                    </div>
                  </div>
                  <div className="sep" />
                  <div className="row">
                    <input className="input" placeholder="Image URL" defaultValue={e.imageUrl || ""} onBlur={(ev) => updateExerciseImage(e.id, ev.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "STATS" && (
        <div className="grid cols2">
          <div className="card">
            <div className="h1">Poids (30 derniers)</div>
            <div className="sep" />
            <SimpleLineChart
              points={weightLast30.map((x) => ({ x: x.dateISO.slice(5), y: x.weightKg }))}
              yLabel="kg"
            />
            <div className="sep" />
            <div className="list">
              {[...state.bodyweight].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).slice(0, 10).map((w) => (
                <div key={w.dateISO} className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">{w.dateISO}</span>
                  <span>{w.weightKg} kg</span>
                </div>
              ))}
              {state.bodyweight.length === 0 && <div className="muted">Aucune entrée.</div>}
            </div>
          </div>

          <div className="card">
            <div className="h1">Eau (7 derniers jours)</div>
            <div className="sep" />
            <SimpleBarChart
              bars={waterLast7.map((x) => ({ label: x.date.slice(5), value: x.ml }))}
              maxValue={state.waterGoalMl}
              unit="ml"
            />
            <div className="sep" />
            <div className="muted">Objectif: {state.waterGoalMl} ml</div>
          </div>
        </div>
      )}

      <div style={{ height: 24 }} />
      <div className="muted" style={{ fontSize: 12 }}>
        Prochain upgrade (facultatif): vraies notifs iPhone même app fermée (Web Push) + perf par exercice.
      </div>
    </div>
  );
}

function WeightInput({ onSave }: { onSave: (w: number) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="row">
      <input className="input" value={val} onChange={(e) => setVal(e.target.value)} placeholder="ex: 68.4" inputMode="decimal" />
      <button
        className="btn primary"
        onClick={() => {
          const n = Number(val);
          if (!Number.isFinite(n) || n <= 0) return;
          onSave(Math.round(n * 10) / 10);
          setVal("");
        }}
      >
        Enregistrer
      </button>
    </div>
  );
}

function AddExerciseForm({ onAdd }: { onAdd: (name: string, musclesCSV: string, imageUrl: string) => void }) {
  const [name, setName] = useState("");
  const [muscles, setMuscles] = useState("chest");
  const [img, setImg] = useState("");
  return (
    <div className="list">
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom exo" />
      <input className="input" value={muscles} onChange={(e) => setMuscles(e.target.value)} placeholder="Muscles (séparés par virgule)" />
      <input className="input" value={img} onChange={(e) => setImg(e.target.value)} placeholder="Image URL (optionnel)" />
      <button
        className="btn primary"
        onClick={() => {
          if (!name.trim()) return;
          onAdd(name.trim(), muscles, img);
          setName("");
          setMuscles("chest");
          setImg("");
        }}
      >
        Ajouter
      </button>
    </div>
  );
}

// ---------- Simple charts (no libs) ----------
function SimpleLineChart({ points, yLabel }: { points: { x: string; y: number }[]; yLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    // resize for crisp
    const w = 900;
    const h = 240;
    c.width = w;
    c.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0e1526";
    ctx.fillRect(0, 0, w, h);

    if (points.length < 2) {
      ctx.fillStyle = "#a8b2cc";
      ctx.fillText("Pas assez de points", 20, 30);
      return;
    }

    const ys = points.map((p) => p.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 20;
    const left = 50;
    const right = 15;
    const top = 20;
    const bottom = 35;

    const scaleX = (i: number) => left + (i * (w - left - right)) / (points.length - 1);
    const scaleY = (y: number) => {
      const denom = maxY - minY || 1;
      return top + ((maxY - y) * (h - top - bottom)) / denom;
    };

    // grid
    ctx.strokeStyle = "#22304f";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = top + (i * (h - top - bottom)) / 4;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(w - right, y);
      ctx.stroke();
    }

    // line
    ctx.strokeStyle = "#2f5bff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = scaleX(i);
      const y = scaleY(p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // dots
    ctx.fillStyle = "#e6e9f2";
    points.forEach((p, i) => {
      const x = scaleX(i);
      const y = scaleY(p.y);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // labels
    ctx.fillStyle = "#a8b2cc";
    ctx.font = "14px system-ui";
    ctx.fillText(`${maxY.toFixed(1)} ${yLabel}`, 10, top + 10);
    ctx.fillText(`${minY.toFixed(1)} ${yLabel}`, 10, h - bottom);

    // x labels (few)
    ctx.fillStyle = "#a8b2cc";
    const step = Math.max(1, Math.floor(points.length / 5));
    for (let i = 0; i < points.length; i += step) {
      const x = scaleX(i);
      ctx.fillText(points[i].x, x - 14, h - 12);
    }
  }, [points, yLabel]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: 220, borderRadius: 12, border: "1px solid #22304f" }} />;
}

function SimpleBarChart({ bars, maxValue, unit }: { bars: { label: string; value: number }[]; maxValue: number; unit: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const w = 900;
    const h = 240;
    c.width = w;
    c.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0e1526";
    ctx.fillRect(0, 0, w, h);

    const left = 40;
    const right = 15;
    const top = 20;
    const bottom = 35;

    // grid line at goal
    ctx.strokeStyle = "#22304f";
    ctx.lineWidth = 1;
    const goalY = top + ((maxValue - maxValue) * (h - top - bottom)) / (maxValue || 1);
    ctx.beginPath();
    ctx.moveTo(left, goalY);
    ctx.lineTo(w - right, goalY);
    ctx.stroke();

    const barW = (w - left - right) / bars.length;
    bars.forEach((b, i) => {
      const x = left + i * barW + 10;
      const usableH = h - top - bottom;
      const v = Math.min(maxValue, b.value);
      const bh = (v / (maxValue || 1)) * usableH;
      const y = top + (usableH - bh);

      ctx.fillStyle = "#2f5bff";
      ctx.fillRect(x, y, barW - 20, bh);

      ctx.fillStyle = "#a8b2cc";
      ctx.font = "12px system-ui";
      ctx.fillText(b.label, x, h - 12);
    });

    ctx.fillStyle = "#a8b2cc";
    ctx.font = "14px system-ui";
    ctx.fillText(`max ${maxValue} ${unit}`, 10, 18);
  }, [bars, maxValue, unit]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: 220, borderRadius: 12, border: "1px solid #22304f" }} />;
}
