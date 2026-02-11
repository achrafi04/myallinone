"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Exo = {
  id: string;
  name: string;
  muscles: string[];
  imageUrl?: string; // you paste any image URL you want
};

type SetEntry = {
  exoId: string;
  weightKg: number;
  reps: number;
  rpe?: number; // optional effort 1-10
};

type WorkoutLog = {
  id: string;
  dateISO: string;
  dayType: "PUSH" | "PULL" | "LEGS";
  notes?: string;
  sets: SetEntry[];
};

type WeightLog = { dateISO: string; weightKg: number };

type AppState = {
  waterGoalMl: number;
  waterTodayMl: number;
  waterTodayDate: string; // YYYY-MM-DD
  bodyweight: WeightLog[];
  exercises: Exo[];
  workoutTemplates: Record<WorkoutLog["dayType"], { exoId: string; defaultRestSec: number }[]>;
  logs: WorkoutLog[];
};

const LS_KEY = "myallinone_v1";
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
      parsed.waterTodayDate = t;
      parsed.waterTodayMl = 0;
    }
    // basic fallback
    parsed.exercises ||= DEFAULT_EXOS;
    parsed.workoutTemplates ||= DEFAULT_STATE.workoutTemplates;
    parsed.logs ||= [];
    parsed.bodyweight ||= [];
    parsed.waterGoalMl ||= 3000;
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
  } catch {
    // ignore
  }
}

export default function Page() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [tab, setTab] = useState<"TODAY" | "WORKOUT" | "LIB" | "STATS">("TODAY");

  // timers
  const [restSec, setRestSec] = useState<number>(0);
  const [restRunning, setRestRunning] = useState(false);
  const restRef = useRef<number | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

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

  const waterPct = Math.min(100, Math.round((state.waterTodayMl / state.waterGoalMl) * 100));

  const exoById = useMemo(() => {
    const m = new Map<string, Exo>();
    state.exercises.forEach((e) => m.set(e.id, e));
    return m;
  }, [state.exercises]);

  // ====== TODAY ======
  const addWater = (ml: number) => {
    setState((s) => ({ ...s, waterTodayMl: Math.max(0, s.waterTodayMl + ml) }));
  };

  const addBodyWeight = (w: number) => {
    const d = todayKey();
    setState((s) => {
      const filtered = s.bodyweight.filter((x) => x.dateISO !== d);
      return { ...s, bodyweight: [...filtered, { dateISO: d, weightKg: w }].sort((a, b) => a.dateISO.localeCompare(b.dateISO)) };
    });
  };

  // ====== WORKOUT ======
  const [dayType, setDayType] = useState<WorkoutLog["dayType"]>("PUSH");
  const [activeLog, setActiveLog] = useState<WorkoutLog>(() => ({ id: uid(), dateISO: new Date().toISOString(), dayType: "PUSH", sets: [] }));

  useEffect(() => {
    setActiveLog((l) => ({ ...l, dayType }));
  }, [dayType]);

  const addSet = (exoId: string) => {
    // auto-suggest weight from last time
    const last = [...state.logs]
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
      .flatMap((l) => l.sets)
      .find((s) => s.exoId === exoId);
    const suggested = last?.weightKg ?? 0;
    setActiveLog((l) => ({
      ...l,
      sets: [...l.sets, { exoId, weightKg: suggested, reps: last?.reps ?? 10 }],
    }));
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
    setRestSec(sec);
    setRestRunning(true);
  };

  const saveWorkout = () => {
    if (activeLog.sets.length === 0) return;
    const toSave: WorkoutLog = { ...activeLog, id: uid(), dateISO: new Date().toISOString() };
    setState((s) => ({ ...s, logs: [toSave, ...s.logs] }));
    setActiveLog({ id: uid(), dateISO: new Date().toISOString(), dayType, sets: [] });
  };

  // ====== LIB ======
  const addExercise = (name: string, musclesCSV: string, imageUrl: string) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) + "_" + Math.random().toString(36).slice(2, 6);
    const muscles = musclesCSV
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    setState((s) => ({
      ...s,
      exercises: [...s.exercises, { id, name, muscles, imageUrl: imageUrl || undefined }],
    }));
  };

  const updateExerciseImage = (id: string, imageUrl: string) => {
    setState((s) => ({
      ...s,
      exercises: s.exercises.map((e) => (e.id === id ? { ...e, imageUrl: imageUrl || undefined } : e)),
    }));
  };

  // ====== STATS ======
  const latestWeight = useMemo(() => {
    const sorted = [...state.bodyweight].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    return sorted[0]?.weightKg;
  }, [state.bodyweight]);

  const recentLogs = state.logs.slice(0, 5);

  return (
    <div className="wrap">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="h1">MyAllInOneTracker</div>
          <div className="muted">Gym • Eau • Poids • Notes (local, privé)</div>
        </div>
        <div className="row">
          <button className={`btn ${tab === "TODAY" ? "primary" : ""}`} onClick={() => setTab("TODAY")}>Aujourd’hui</button>
          <button className={`btn ${tab === "WORKOUT" ? "primary" : ""}`} onClick={() => setTab("WORKOUT")}>Salle</button>
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
            <div className="muted">Raccourci salle</div>
            <div className="row">
              <button className="btn primary" onClick={() => setTab("WORKOUT")}>Démarrer une séance</button>
              <button className="btn" onClick={() => setTab("LIB")}>Ajouter images exos</button>
            </div>
            <div className="sep" />
            <div className="muted">Dernières séances :</div>
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
            <div className="muted">Ajoute tes séries (poids + reps). Le poids est pré-rempli depuis ta dernière séance.</div>

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
            <textarea className="textarea" value={activeLog.notes || ""} onChange={(e) => setActiveLog((l) => ({ ...l, notes: e.target.value }))} placeholder="Ex: bonne forme, +2.5kg, pas assez dormi..." />
          </div>

          <div className="card">
            <div className="muted">Séries enregistrées (dans la séance en cours)</div>
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
                      <div className="name">
                        <span className="muted">Série #{idx + 1}</span>
                      </div>
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
            <div className="muted">Chrono en cours : <b>{formatTime(restSec)}</b> {restRunning ? "(go)" : ""}</div>
            <div className="row">
              <button className="btn" onClick={() => setRestRunning((x) => !x)} disabled={restSec === 0}>{restRunning ? "Pause" : "Reprendre"}</button>
              <button className="btn" onClick={() => { setRestRunning(false); setRestSec(0); }}>Stop</button>
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
            <div className="muted">Astuce images : tu colles une URL d’image (ex: site de muscu). Si tu laisses vide, pas d’image.</div>
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
            <div className="h1">Poids</div>
            <div className="muted">Tu peux exporter plus tard. Pour l’instant c’est local.</div>
            <div className="sep" />
            <div className="list">
              {[...state.bodyweight].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).map((w) => (
                <div key={w.dateISO} className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">{w.dateISO}</span>
                  <span>{w.weightKg} kg</span>
                </div>
              ))}
              {state.bodyweight.length === 0 && <div className="muted">Aucune entrée.</div>}
            </div>
          </div>

          <div className="card">
            <div className="h1">Séances</div>
            <div className="muted">5 dernières séances</div>
            <div className="sep" />
            <div className="list">
              {recentLogs.map((l) => (
                <div key={l.id} className="card" style={{ padding: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="pill">{l.dayType}</span>
                    <span className="muted">{new Date(l.dateISO).toLocaleString("fr-FR")}</span>
                  </div>
                  <div className="sep" />
                  <div className="muted">{l.sets.length} séries</div>
                  {l.notes ? <div style={{ marginTop: 6 }}>{l.notes}</div> : null}
                </div>
              ))}
              {recentLogs.length === 0 && <div className="muted">Aucune séance.</div>}
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 24 }} />
      <div className="muted" style={{ fontSize: 12 }}>
        Prochain upgrade possible: notifications iPhone (rappels eau/repas), cloud sync (Supabase), graphiques.
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
