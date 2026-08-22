import React, { useState, useEffect, useMemo } from "react";
import {
  Dumbbell,
  Languages,
  ListChecks,
  Settings as SettingsIcon,
  Home as HomeIcon,
  Plus,
  X,
  Bell,
  BellOff,
  MapPin,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  Flame,
  UtensilsCrossed,
  Sparkles,
  Clock,
  Pill,
  Play,
  Square,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

/* ---------------------------------------------------------
   design tokens (Apple / iOS inspired — light, glassy, RTL)
---------------------------------------------------------- */
const RING = {
  work: "#0A84FF", // iOS blue
  gym: "#FF375F", // apple fitness "move" red
  language: "#30D158", // apple fitness "exercise" green
  activity: "#FF9F0A", // apple fitness "stand" orange-ish
};

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const REMINDER_OPTIONS = [
  { value: 0, label: "بوقتها بالضبط" },
  { value: 5, label: "قبل 5 دقائق" },
  { value: 10, label: "قبل 10 دقائق" },
  { value: 15, label: "قبل 15 دقيقة" },
  { value: 30, label: "قبل 30 دقيقة" },
];

function timeToMin(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function rangesOverlap(startA, endA, startB, endB) {
  if (startA == null || endA == null || startB == null || endB == null) return false;
  return startA < endB && startB < endA;
}

// checks a candidate activity {date, time, durationMin} against the fixed daily
// blocks (work/gym/language/other, which recur every day) and other saved activities
// on the same date. Returns a list of human-readable names it collides with.
function findConflicts({ date, time, durationMin }, blocks, activities, excludeId) {
  const start = timeToMin(time);
  if (start == null) return [];
  const end = start + (Number(durationMin) || 60);
  const conflicts = [];

  blocks.forEach((b) => {
    if (rangesOverlap(start, end, timeToMin(b.start), timeToMin(b.end))) conflicts.push(b.name);
  });

  activities
    .filter((a) => a.id !== excludeId && a.date === date)
    .forEach((a) => {
      const aStart = timeToMin(a.time);
      const aEnd = aStart + (Number(a.durationMin) || 60);
      if (rangesOverlap(start, end, aStart, aEnd)) conflicts.push(a.name);
    });

  return conflicts;
}

const DEFAULT_STATE = {
  blocks: [
    { id: "work", name: "الشغل", start: "08:00", end: "17:00", color: RING.work },
    { id: "gym", name: "الجيم", start: "17:15", end: "18:15", color: RING.gym },
    { id: "language", name: "تعلم اللغة", start: "18:45", end: "19:45", color: RING.language },
    { id: "activity", name: "أنشطة أخرى", start: "20:00", end: "21:00", color: RING.activity },
  ],
  doneToday: {}, // { blockId: true }
  gym: {
    splits: [
      { id: "push", name: "Push" },
      { id: "pull", name: "Pull" },
      { id: "legs", name: "Legs" },
    ],
    exercises: [
      { id: "e1", splitId: "push", name: "بنش برس", targetSets: "4×8" },
      { id: "e2", splitId: "pull", name: "سحب علوي", targetSets: "3×12" },
      { id: "e3", splitId: "legs", name: "سكوات", targetSets: "4×10" },
    ],
    logs: [], // { id, exerciseId, date, sets: [{weight, reps}] }
    nextTargets: {}, // exerciseId -> weight (string/number)
    sessions: [], // { id, date, startTime, endTime, durationMin }
    activeSessionStart: null,
    supplements: [
      { id: "sup1", name: "كرياتين", dose: 5, unit: "غم", time: "08:00", reminder: true },
      { id: "sup2", name: "مغنيسيوم", dose: 1, unit: "ملغم", time: "21:00", reminder: true },
    ],
    meals: [
      { id: "m1", name: "فطور - شوفان وبيض", calories: 450 },
      { id: "m2", name: "غدا - صدر دجاج وأرز", calories: 650 },
    ],
  },
  language: {
    level: "A1",
    target: "B1",
    progress: 22,
    words: [
      { id: "g1", el: "Καλημέρα", ar: "صباح الخير" },
      { id: "g2", el: "Ευχαριστώ", ar: "شكراً" },
    ],
  },
  activities: [],
  settings: {
    notifications: { gym: true, language: true, activity: true, work: false, supplements: true },
    reminderMinutes: 10,
    locations: { gym: "" },
  },
};

// Standalone storage: localStorage-backed, same shape as window.storage
const storage = {
  async get(key) {
    const v = localStorage.getItem(key);
    return v !== null ? { value: v } : null;
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { value };
  },
};

function useAppState() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get("app-state");
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          // migrate old gym shape (flat workouts array) to the new splits/exercises shape
          if (parsed.gym && !parsed.gym.splits) {
            parsed.gym = { ...DEFAULT_STATE.gym, meals: parsed.gym.meals || DEFAULT_STATE.gym.meals };
          }
          setState((s) => ({ ...s, ...parsed, gym: { ...s.gym, ...parsed.gym } }));
        }
      } catch (e) {
        // no saved state yet — fine, use defaults
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      storage.set("app-state", JSON.stringify(state)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [state, loaded]);

  return [state, setState];
}

/* ---------------------------------------------------------
   shared bits
---------------------------------------------------------- */
function GlassCard({ children, style, className = "" }) {
  return (
    <div
      className={className}
      style={{
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 22,
        border: "1px solid rgba(0,0,0,0.05)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Ring({ pct, color, size = 64, stroke = 8, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 46,
        height: 28,
        borderRadius: 999,
        border: "none",
        padding: 3,
        background: checked ? "#30D158" : "rgba(120,120,128,0.32)",
        display: "flex",
        justifyContent: checked ? "flex-start" : "flex-end",
        cursor: "pointer",
        transition: "background 0.2s ease",
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          transition: "transform 0.2s ease",
        }}
      />
    </button>
  );
}

/* ---------------------------------------------------------
   Home
---------------------------------------------------------- */
function Home({ state, setState, goTo }) {
  const toggleDone = (id) =>
    setState((s) => ({ ...s, doneToday: { ...s.doneToday, [id]: !s.doneToday[id] } }));

  const today = new Date();
  const dayName = DAY_NAMES[today.getDay()];

  return (
    <div style={{ padding: "20px 18px 100px" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 14, color: "#8E8E93", fontWeight: 500 }}>{dayName}</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#1C1C1E", letterSpacing: -0.5 }}>
          يومك بلمحة
        </div>
      </div>

      <GlassCard style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          {state.blocks.map((b) => {
            const done = state.doneToday[b.id];
            return (
              <div key={b.id} style={{ textAlign: "center" }}>
                <button
                  onClick={() => toggleDone(b.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", position: "relative" }}
                >
                  <Ring pct={done ? 100 : 0} color={b.color} size={58} stroke={7} />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {done && <Check size={20} color={b.color} strokeWidth={3} />}
                  </div>
                </button>
                <div style={{ fontSize: 12, marginTop: 6, color: "#3A3A3C", fontWeight: 600 }}>
                  {b.name}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", margin: "6px 4px 10px" }}>
        جدول اليوم
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {state.blocks.map((b) => (
          <GlassCard
            key={b.id}
            className="tap-card"
            style={{
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: b.id === "gym" || b.id === "language" ? "pointer" : "default",
            }}
          >
            <div
              onClick={() => {
                if (b.id === "gym") goTo("gym");
                if (b.id === "language") goTo("language");
              }}
              style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}
            >
              <div style={{ width: 8, height: 40, borderRadius: 6, background: b.color }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#1C1C1E" }}>{b.name}</div>
                <div style={{ fontSize: 13, color: "#8E8E93" }}>
                  {b.start} - {b.end}
                </div>
              </div>
            </div>
            {(b.id === "gym" || b.id === "language") && (
              <ChevronLeft size={20} color="#C7C7CC" />
            )}
          </GlassCard>
        ))}
      </div>

      {state.activities.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", margin: "22px 4px 10px" }}>
            نشاطات إضافية
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {state.activities.slice(0, 3).map((a) => (
              <GlassCard key={a.id} style={{ padding: "14px 18px" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1C1C1E" }}>{a.name}</div>
                <div style={{ fontSize: 13, color: "#8E8E93" }}>
                  {a.date} · {a.time}
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Gym (Apple Fitness inspired)
---------------------------------------------------------- */
function Gym({ state, setState }) {
  const [subTab, setSubTab] = useState("training");
  const [trainingView, setTrainingView] = useState("splits"); // splits | splitDetail | exerciseDetail
  const [selectedSplitId, setSelectedSplitId] = useState(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);

  const openSplit = (id) => {
    setSelectedSplitId(id);
    setTrainingView("splitDetail");
  };
  const openExercise = (id) => {
    setSelectedExerciseId(id);
    setTrainingView("exerciseDetail");
  };
  const backToSplits = () => {
    setTrainingView("splits");
    setSelectedSplitId(null);
  };
  const backToSplitDetail = () => {
    setTrainingView("splitDetail");
    setSelectedExerciseId(null);
  };

  return (
    <div style={{ padding: "20px 18px 100px" }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#1C1C1E", marginBottom: 4 }}>الجيم</div>
      <div style={{ fontSize: 14, color: "#8E8E93", marginBottom: 18 }}>
        تدريب، تتبع تطور، مكملات ووقت الجلسة
      </div>

      <GlassCard style={{ padding: 6, display: "flex", marginBottom: 18, gap: 2 }}>
        {[
          { id: "training", label: "التدريب", icon: Dumbbell },
          { id: "time", label: "الوقت", icon: Clock },
          { id: "supplements", label: "المكملات", icon: Pill },
          { id: "food", label: "الطعام", icon: UtensilsCrossed },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSubTab(t.id);
              if (t.id !== "training") {
                setTrainingView("splits");
                setSelectedExerciseId(null);
              }
            }}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 14,
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              background: subTab === t.id ? "#FF375F" : "transparent",
              color: subTab === t.id ? "white" : "#1C1C1E",
              fontWeight: 700,
              fontSize: 11,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </GlassCard>

      {subTab === "training" && trainingView === "splits" && (
        <SplitsList state={state} setState={setState} onOpenSplit={openSplit} />
      )}
      {subTab === "training" && trainingView === "splitDetail" && (
        <SplitDetail
          state={state}
          setState={setState}
          splitId={selectedSplitId}
          onBack={backToSplits}
          onOpenExercise={openExercise}
        />
      )}
      {subTab === "training" && trainingView === "exerciseDetail" && (
        <ExerciseDetail
          state={state}
          setState={setState}
          exerciseId={selectedExerciseId}
          onBack={backToSplitDetail}
        />
      )}

      {subTab === "time" && <SessionTime state={state} setState={setState} />}
      {subTab === "supplements" && <Supplements state={state} setState={setState} />}
      {subTab === "food" && <GymFood state={state} setState={setState} />}
    </div>
  );
}

/* ---- Splits list (Push / Pull / Legs / whatever the user names them) ---- */
function SplitsList({ state, setState, onOpenSplit }) {
  const [newSplit, setNewSplit] = useState("");

  const addSplit = () => {
    if (!newSplit.trim()) return;
    setState((s) => ({
      ...s,
      gym: {
        ...s.gym,
        splits: [...s.gym.splits, { id: "sp" + Date.now(), name: newSplit.trim() }],
      },
    }));
    setNewSplit("");
  };

  const removeSplit = (id) =>
    setState((s) => ({
      ...s,
      gym: {
        ...s.gym,
        splits: s.gym.splits.filter((sp) => sp.id !== id),
        exercises: s.gym.exercises.filter((e) => e.splitId !== id),
      },
    }));

  const countFor = (splitId) => state.gym.exercises.filter((e) => e.splitId === splitId).length;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {state.gym.splits.map((sp) => (
          <GlassCard
            key={sp.id}
            style={{
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
          >
            <div onClick={() => onOpenSplit(sp.id)} style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#1C1C1E" }}>{sp.name}</div>
              <div style={{ fontSize: 13, color: "#8E8E93" }}>{countFor(sp.id)} تمارين</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSplit(sp.id);
                }}
                style={iconBtnStyle}
              >
                <Trash2 size={15} color="#C7C7CC" />
              </button>
              <ChevronLeft size={20} color="#C7C7CC" onClick={() => onOpenSplit(sp.id)} />
            </div>
          </GlassCard>
        ))}
        {state.gym.splits.length === 0 && (
          <GlassCard style={{ padding: 24, textAlign: "center" }}>
            <div style={{ color: "#8E8E93", fontSize: 14 }}>ما في تقسيمات بعد - ضيف وحدة تحت</div>
          </GlassCard>
        )}
      </div>
      <GlassCard style={{ padding: 14, display: "flex", gap: 8 }}>
        <input
          value={newSplit}
          onChange={(e) => setNewSplit(e.target.value)}
          placeholder="اسم التقسيم - مثلاً Push"
          style={inputStyle}
        />
        <button onClick={addSplit} style={addBtnStyle("#FF375F")}>
          <Plus size={18} color="white" />
        </button>
      </GlassCard>
    </>
  );
}

/* ---- Exercises inside one split ---- */
function SplitDetail({ state, setState, splitId, onBack, onOpenExercise }) {
  const split = state.gym.splits.find((sp) => sp.id === splitId);
  const exercises = state.gym.exercises.filter((e) => e.splitId === splitId);
  const [name, setName] = useState("");
  const [sets, setSets] = useState("");

  const addExercise = () => {
    if (!name.trim()) return;
    setState((s) => ({
      ...s,
      gym: {
        ...s.gym,
        exercises: [
          ...s.gym.exercises,
          { id: "e" + Date.now(), splitId, name: name.trim(), targetSets: sets.trim() || "-" },
        ],
      },
    }));
    setName("");
    setSets("");
  };

  const removeExercise = (id) =>
    setState((s) => ({ ...s, gym: { ...s.gym, exercises: s.gym.exercises.filter((e) => e.id !== id) } }));

  if (!split) return null;

  return (
    <>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: "#FF375F",
          fontWeight: 600,
          fontSize: 15,
          cursor: "pointer",
          marginBottom: 12,
          padding: 0,
        }}
      >
        <ChevronRight size={18} />
        كل التقسيمات
      </button>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#1C1C1E", marginBottom: 14 }}>{split.name}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {exercises.map((ex) => (
          <GlassCard
            key={ex.id}
            style={{
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
          >
            <div onClick={() => onOpenExercise(ex.id)} style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1C1C1E" }}>{ex.name}</div>
              <div style={{ fontSize: 13, color: "#8E8E93" }}>{ex.targetSets}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeExercise(ex.id);
                }}
                style={iconBtnStyle}
              >
                <Trash2 size={15} color="#C7C7CC" />
              </button>
              <TrendingUp size={17} color="#FF375F" onClick={() => onOpenExercise(ex.id)} />
            </div>
          </GlassCard>
        ))}
        {exercises.length === 0 && (
          <GlassCard style={{ padding: 20, textAlign: "center" }}>
            <div style={{ color: "#8E8E93", fontSize: 14 }}>ضيف أول تمرين لهاد اليوم</div>
          </GlassCard>
        )}
      </div>

      <GlassCard style={{ padding: 14, display: "flex", gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم التمرين" style={inputStyle} />
        <input
          value={sets}
          onChange={(e) => setSets(e.target.value)}
          placeholder="مجموعات مثل 4×8"
          style={{ ...inputStyle, width: 110 }}
        />
        <button onClick={addExercise} style={addBtnStyle("#FF375F")}>
          <Plus size={18} color="white" />
        </button>
      </GlassCard>
    </>
  );
}

/* ---- Single exercise: weight/reps tracking + progress chart ---- */
function ExerciseDetail({ state, setState, exerciseId, onBack }) {
  const ex = state.gym.exercises.find((e) => e.id === exerciseId);
  const logs = state.gym.logs
    .filter((l) => l.exerciseId === exerciseId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextTarget = state.gym.nextTargets[exerciseId] || "";

  const [rows, setRows] = useState([{ weight: "", reps: "" }]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const updateRow = (i, key, val) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));
  const addRow = () => setRows((r) => [...r, { weight: "", reps: "" }]);
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

  const saveLog = () => {
    const validSets = rows
      .filter((r) => r.weight !== "" && r.reps !== "")
      .map((r) => ({ weight: Number(r.weight), reps: Number(r.reps) }));
    if (validSets.length === 0) return;
    setState((s) => ({
      ...s,
      gym: {
        ...s.gym,
        logs: [...s.gym.logs, { id: "log" + Date.now(), exerciseId, date, sets: validSets }],
      },
    }));
    setRows([{ weight: "", reps: "" }]);
  };

  const setNextTarget = (val) =>
    setState((s) => ({ ...s, gym: { ...s.gym, nextTargets: { ...s.gym.nextTargets, [exerciseId]: val } } }));

  const lastLog = logs[logs.length - 1];
  const currentWeight = lastLog ? Math.max(...lastLog.sets.map((se) => se.weight)) : null;

  const chartData = logs.map((l) => ({
    date: l.date.slice(5), // MM-DD
    weight: Math.max(...l.sets.map((se) => se.weight)),
  }));

  if (!ex) return null;

  return (
    <>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: "#FF375F",
          fontWeight: 600,
          fontSize: 15,
          cursor: "pointer",
          marginBottom: 12,
          padding: 0,
        }}
      >
        <ChevronRight size={18} />
        رجوع
      </button>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#1C1C1E", marginBottom: 4 }}>{ex.name}</div>
      <div style={{ fontSize: 13, color: "#8E8E93", marginBottom: 16 }}>{ex.targetSets}</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <GlassCard style={{ padding: 14, flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#8E8E93", marginBottom: 4 }}>الوزن الحالي</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1C1C1E" }}>
            {currentWeight !== null ? `${currentWeight} كغم` : "-"}
          </div>
        </GlassCard>
        <GlassCard style={{ padding: 14, flex: 1 }}>
          <div style={{ fontSize: 12, color: "#8E8E93", marginBottom: 4, textAlign: "center" }}>الوزن التالي</div>
          <input
            value={nextTarget}
            onChange={(e) => setNextTarget(e.target.value)}
            placeholder="مثلاً 62.5"
            style={{ ...inputStyle, textAlign: "center", border: "none", background: "transparent", fontWeight: 800, fontSize: 18, padding: 0 }}
          />
        </GlassCard>
      </div>

      {chartData.length > 1 && (
        <GlassCard style={{ padding: "16px 8px 8px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", marginBottom: 6, paddingRight: 10 }}>
            تطور الوزن
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8E8E93" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8E8E93" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 12 }} />
              <Line type="monotone" dataKey="weight" stroke="#FF375F" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", margin: "6px 4px 10px" }}>
        تسجيل جولة جديدة
      </div>
      <GlassCard style={{ padding: 16, marginBottom: 16 }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ ...inputStyle, width: "100%", marginBottom: 10 }}
        />
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#8E8E93", width: 20 }}>{i + 1}</span>
            <input
              value={row.weight}
              onChange={(e) => updateRow(i, "weight", e.target.value)}
              placeholder="وزن كغم"
              type="number"
              style={inputStyle}
            />
            <input
              value={row.reps}
              onChange={(e) => updateRow(i, "reps", e.target.value)}
              placeholder="عدات"
              type="number"
              style={inputStyle}
            />
            {rows.length > 1 && (
              <button onClick={() => removeRow(i)} style={iconBtnStyle}>
                <X size={14} color="#C7C7CC" />
              </button>
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={addRow}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 12,
              border: "1px dashed rgba(0,0,0,0.15)",
              background: "transparent",
              color: "#8E8E93",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + جولة
          </button>
          <button onClick={saveLog} style={{ ...addBtnStyle("#FF375F"), flex: 1, borderRadius: 12, height: 40 }}>
            <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>حفظ</span>
          </button>
        </div>
      </GlassCard>

      {logs.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", margin: "6px 4px 10px" }}>السجل</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...logs].reverse().map((l) => (
              <GlassCard key={l.id} style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginBottom: 4 }}>{l.date}</div>
                <div style={{ fontSize: 13, color: "#8E8E93" }}>
                  {l.sets.map((se, i) => `${se.weight}كغم×${se.reps}`).join(" · ")}
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ---- Session time tracking: check-in / check-out ---- */
function SessionTime({ state, setState }) {
  const [, forceTick] = useState(0);
  const active = !!state.gym.activeSessionStart;

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);

  const startSession = () =>
    setState((s) => ({ ...s, gym: { ...s.gym, activeSessionStart: new Date().toISOString() } }));

  const endSession = () => {
    setState((s) => {
      const start = new Date(s.gym.activeSessionStart);
      const end = new Date();
      const durationMin = Math.max(1, Math.round((end - start) / 60000));
      return {
        ...s,
        gym: {
          ...s.gym,
          activeSessionStart: null,
          sessions: [
            ...s.gym.sessions,
            {
              id: "sess" + Date.now(),
              date: end.toISOString().slice(0, 10),
              startTime: start.toTimeString().slice(0, 5),
              endTime: end.toTimeString().slice(0, 5),
              durationMin,
            },
          ],
        },
      };
    });
  };

  const elapsed = active ? Math.floor((Date.now() - new Date(state.gym.activeSessionStart)) / 1000) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const chartData = state.gym.sessions.slice(-8).map((s) => ({ date: s.date.slice(5), minutes: s.durationMin }));

  return (
    <>
      <GlassCard style={{ padding: 28, textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: "#8E8E93", marginBottom: 10 }}>
          {active ? "الجلسة شغالة" : "ما في جلسة حالياً"}
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, color: "#1C1C1E", letterSpacing: 1, marginBottom: 18 }}>
          {active ? `${mm}:${ss}` : "00:00"}
        </div>
        <button
          onClick={active ? endSession : startSession}
          style={{
            border: "none",
            borderRadius: 999,
            padding: "14px 32px",
            background: active ? "#1C1C1E" : "#FF375F",
            color: "white",
            fontWeight: 700,
            fontSize: 15,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          {active ? <Square size={16} /> : <Play size={16} />}
          {active ? "إنهاء الجلسة" : "بدء الجلسة"}
        </button>
      </GlassCard>

      {chartData.length > 0 && (
        <GlassCard style={{ padding: "16px 8px 8px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", marginBottom: 6, paddingRight: 10 }}>
            الوقت بالجيم (دقائق)
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData}>
              <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8E8E93" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8E8E93" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 12 }} />
              <Bar dataKey="minutes" fill="#FF9F0A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {state.gym.sessions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...state.gym.sessions].reverse().slice(0, 6).map((s) => (
            <GlassCard key={s.id} style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1C1C1E" }}>{s.date}</div>
              <div style={{ fontSize: 13, color: "#8E8E93" }}>
                {s.startTime} - {s.endTime} · {s.durationMin} د
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </>
  );
}

/* ---- Supplements ---- */
function Supplements({ state, setState }) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [unit, setUnit] = useState("غم");
  const [time, setTime] = useState("08:00");

  const addSupplement = () => {
    if (!name.trim()) return;
    setState((s) => ({
      ...s,
      gym: {
        ...s.gym,
        supplements: [
          ...s.gym.supplements,
          { id: "sup" + Date.now(), name: name.trim(), dose: Number(dose) || 0, unit, time, reminder: true },
        ],
      },
    }));
    setName("");
    setDose("");
  };

  const removeSupplement = (id) =>
    setState((s) => ({ ...s, gym: { ...s.gym, supplements: s.gym.supplements.filter((x) => x.id !== id) } }));

  const toggleReminder = (id) =>
    setState((s) => ({
      ...s,
      gym: {
        ...s.gym,
        supplements: s.gym.supplements.map((x) => (x.id === id ? { ...x, reminder: !x.reminder } : x)),
      },
    }));

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {state.gym.supplements.map((sup) => (
          <GlassCard key={sup.id} style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "rgba(255,55,95,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Pill size={18} color="#FF375F" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1C1C1E" }}>{sup.name}</div>
                <div style={{ fontSize: 13, color: "#8E8E93" }}>
                  {sup.dose} {sup.unit} · {sup.time}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Toggle checked={sup.reminder} onChange={() => toggleReminder(sup.id)} />
              <button onClick={() => removeSupplement(sup.id)} style={iconBtnStyle}>
                <Trash2 size={15} color="#C7C7CC" />
              </button>
            </div>
          </GlassCard>
        ))}
        {state.gym.supplements.length === 0 && (
          <GlassCard style={{ padding: 20, textAlign: "center" }}>
            <div style={{ color: "#8E8E93", fontSize: 14 }}>ما في مكملات مضافة</div>
          </GlassCard>
        )}
      </div>

      <GlassCard style={{ padding: 16 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم المكمل - مثلاً كرياتين"
          style={{ ...inputStyle, width: "100%", marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="الجرعة" type="number" style={inputStyle} />
          <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ ...inputStyle, width: 90 }}>
            <option value="غم">غم</option>
            <option value="ملغم">ملغم</option>
            <option value="كبسولة">كبسولة</option>
            <option value="ملعقة">ملعقة</option>
          </select>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...inputStyle, width: 110 }} />
        </div>
        <button onClick={addSupplement} style={{ ...addBtnStyle("#FF375F"), width: "100%", borderRadius: 12, height: 42 }}>
          <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>إضافة مكمل</span>
        </button>
      </GlassCard>
    </>
  );
}

/* ---- Food (unchanged from before) ---- */
function GymFood({ state, setState }) {
  const [newMeal, setNewMeal] = useState("");
  const [newCal, setNewCal] = useState("");

  const removeMeal = (id) =>
    setState((s) => ({ ...s, gym: { ...s.gym, meals: s.gym.meals.filter((m) => m.id !== id) } }));

  const addMeal = () => {
    if (!newMeal.trim()) return;
    setState((s) => ({
      ...s,
      gym: {
        ...s.gym,
        meals: [...s.gym.meals, { id: "m" + Date.now(), name: newMeal.trim(), calories: Number(newCal) || 0 }],
      },
    }));
    setNewMeal("");
    setNewCal("");
  };

  const totalCal = state.gym.meals.reduce((sum, m) => sum + m.calories, 0);

  return (
    <>
      <GlassCard style={{ padding: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <Flame size={22} color="#FF9F0A" />
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: "#1C1C1E" }}>{totalCal} سعرة</div>
          <div style={{ fontSize: 12, color: "#8E8E93" }}>إجمالي اليوم</div>
        </div>
      </GlassCard>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {state.gym.meals.map((m) => (
          <GlassCard key={m.id} style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1C1C1E" }}>{m.name}</div>
              <div style={{ fontSize: 13, color: "#8E8E93" }}>{m.calories} سعرة</div>
            </div>
            <button onClick={() => removeMeal(m.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
              <Trash2 size={16} color="#C7C7CC" />
            </button>
          </GlassCard>
        ))}
      </div>
      <GlassCard style={{ padding: 14, display: "flex", gap: 8 }}>
        <input value={newMeal} onChange={(e) => setNewMeal(e.target.value)} placeholder="اسم الوجبة" style={inputStyle} />
        <input value={newCal} onChange={(e) => setNewCal(e.target.value)} placeholder="سعرات" type="number" style={{ ...inputStyle, width: 90 }} />
        <button onClick={addMeal} style={addBtnStyle("#FF9F0A")}>
          <Plus size={18} color="white" />
        </button>
      </GlassCard>
    </>
  );
}

/* ---------------------------------------------------------
   Language
---------------------------------------------------------- */
function Language({ state, setState }) {
  const [el, setEl] = useState("");
  const [ar, setAr] = useState("");
  const [flipped, setFlipped] = useState({});

  const addWord = () => {
    if (!el.trim() || !ar.trim()) return;
    setState((s) => ({
      ...s,
      language: {
        ...s.language,
        words: [...s.language.words, { id: "g" + Date.now(), el: el.trim(), ar: ar.trim() }],
      },
    }));
    setEl("");
    setAr("");
  };

  const removeWord = (id) =>
    setState((s) => ({
      ...s,
      language: { ...s.language, words: s.language.words.filter((w) => w.id !== id) },
    }));

  return (
    <div style={{ padding: "20px 18px 100px" }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#1C1C1E", marginBottom: 18 }}>
        تعلم اللغة اليونانية
      </div>

      <GlassCard style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: "#1C1C1E" }}>
            {state.language.level} → {state.language.target}
          </div>
          <div style={{ fontSize: 13, color: "#30D158", fontWeight: 700 }}>{state.language.progress}%</div>
        </div>
        <div style={{ height: 10, borderRadius: 8, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div
            style={{
              width: `${state.language.progress}%`,
              height: "100%",
              background: "#30D158",
              borderRadius: 8,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </GlassCard>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", margin: "6px 4px 10px" }}>
        بطاقات الكلمات — إضغط للقلب
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {state.language.words.map((w) => (
          <div
            key={w.id}
            onClick={() => setFlipped((f) => ({ ...f, [w.id]: !f[w.id] }))}
            style={{ cursor: "pointer", position: "relative" }}
          >
            <GlassCard
              style={{
                padding: "22px 14px",
                textAlign: "center",
                minHeight: 70,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16, color: "#1C1C1E" }}>
                {flipped[w.id] ? w.ar : w.el}
              </div>
            </GlassCard>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeWord(w.id);
              }}
              style={{
                position: "absolute",
                top: -6,
                left: -6,
                background: "#C7C7CC",
                border: "2px solid white",
                borderRadius: "50%",
                width: 22,
                height: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={12} color="white" />
            </button>
          </div>
        ))}
      </div>

      <GlassCard style={{ padding: 14, display: "flex", gap: 8 }}>
        <input value={el} onChange={(e) => setEl(e.target.value)} placeholder="باليونانية" style={inputStyle} />
        <input value={ar} onChange={(e) => setAr(e.target.value)} placeholder="بالعربي" style={inputStyle} />
        <button onClick={addWord} style={addBtnStyle("#30D158")}>
          <Plus size={18} color="white" />
        </button>
      </GlassCard>
    </div>
  );
}

/* ---------------------------------------------------------
   Activities — fully open / user-defined
---------------------------------------------------------- */
function Activities({ state, setState }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [day, setDay] = useState(DAY_NAMES[0]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [reminderOffset, setReminderOffset] = useState(state.settings.reminderMinutes ?? 10);
  const [editingId, setEditingId] = useState(null);
  const [conflicts, setConflicts] = useState([]);

  const resetForm = () => {
    setName("");
    setDay(DAY_NAMES[0]);
    setDate("");
    setTime("");
    setDurationMin(60);
    setReminderOffset(state.settings.reminderMinutes ?? 10);
    setEditingId(null);
    setConflicts([]);
    setShowForm(false);
  };

  const commitSave = () => {
    const payload = { name: name.trim(), day, date, time, durationMin: Number(durationMin) || 60, reminderOffset };
    if (editingId) {
      setState((s) => ({
        ...s,
        activities: s.activities.map((a) => (a.id === editingId ? { ...a, ...payload } : a)),
      }));
    } else {
      setState((s) => ({ ...s, activities: [...s.activities, { id: "a" + Date.now(), ...payload }] }));
    }
    resetForm();
  };

  const attemptSave = () => {
    if (!name.trim() || !date || !time) return;
    const found = findConflicts({ date, time, durationMin }, state.blocks, state.activities, editingId);
    if (found.length > 0) {
      setConflicts(found);
      return;
    }
    commitSave();
  };

  const edit = (a) => {
    setName(a.name);
    setDay(a.day);
    setDate(a.date);
    setTime(a.time);
    setDurationMin(a.durationMin || 60);
    setReminderOffset(a.reminderOffset ?? state.settings.reminderMinutes ?? 10);
    setEditingId(a.id);
    setConflicts([]);
    setShowForm(true);
  };

  const remove = (id) => setState((s) => ({ ...s, activities: s.activities.filter((a) => a.id !== id) }));

  const sorted = useMemo(
    () => [...state.activities].sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [state.activities]
  );

  const reminderLabel = (offset) =>
    REMINDER_OPTIONS.find((r) => r.value === Number(offset))?.label || "بوقتها بالضبط";

  return (
    <div style={{ padding: "20px 18px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#1C1C1E" }}>أنشطتي</div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "none",
            background: "#FF9F0A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(255,159,10,0.4)",
          }}
        >
          <Plus size={20} color="white" />
        </button>
      </div>

      {showForm && (
        <GlassCard style={{ padding: 18, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: "#1C1C1E" }}>
            {editingId ? "تعديل النشاط" : "نشاط جديد"}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم النشاط"
            style={{ ...inputStyle, width: "100%", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <select
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                setConflicts([]);
              }}
              style={{ ...inputStyle, flex: 1 }}
            >
              {DAY_NAMES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setConflicts([]);
              }}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setConflicts([]);
              }}
              style={{ ...inputStyle, flex: 1 }}
            />
            <select
              value={durationMin}
              onChange={(e) => {
                setDurationMin(Number(e.target.value));
                setConflicts([]);
              }}
              style={{ ...inputStyle, width: 110 }}
            >
              {[15, 30, 45, 60, 90, 120].map((d) => (
                <option key={d} value={d}>
                  {d} د
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#8E8E93", marginBottom: 6 }}>التنبيه</div>
            <select
              value={reminderOffset}
              onChange={(e) => setReminderOffset(Number(e.target.value))}
              style={{ ...inputStyle, width: "100%" }}
            >
              {REMINDER_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {conflicts.length > 0 && (
            <GlassCard
              style={{
                padding: 12,
                marginBottom: 12,
                background: "rgba(255,55,95,0.08)",
                border: "1px solid rgba(255,55,95,0.25)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FF375F", marginBottom: 4 }}>
                في تعارض بالوقت مع: {conflicts.join("، ")}
              </div>
              <div style={{ fontSize: 12, color: "#8E8E93" }}>غيّر الوقت، أو احفظ رغم التعارض</div>
            </GlassCard>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            {conflicts.length > 0 ? (
              <button
                onClick={commitSave}
                style={{ ...addBtnStyle("#FF375F"), flex: 1, borderRadius: 14, height: 44 }}
              >
                <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>احفظ رغم التعارض</span>
              </button>
            ) : (
              <button onClick={attemptSave} style={{ ...addBtnStyle("#FF9F0A"), flex: 1, borderRadius: 14, height: 44 }}>
                <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>حفظ</span>
              </button>
            )}
            <button
              onClick={resetForm}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 14,
                border: "none",
                background: "rgba(0,0,0,0.06)",
                color: "#1C1C1E",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              إلغاء
            </button>
          </div>
        </GlassCard>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.length === 0 && !showForm && (
          <GlassCard style={{ padding: 24, textAlign: "center" }}>
            <Sparkles size={26} color="#C7C7CC" style={{ marginBottom: 8 }} />
            <div style={{ color: "#8E8E93", fontSize: 14 }}>ما في نشاطات مضافة بعد — إضغط + لتضيف أول نشاط</div>
          </GlassCard>
        )}
        {sorted.map((a) => (
          <GlassCard
            key={a.id}
            style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1C1C1E" }}>{a.name}</div>
              <div style={{ fontSize: 13, color: "#8E8E93" }}>
                {a.day} {a.date && `· ${a.date}`} {a.time && `· ${a.time}`} {a.durationMin && `· ${a.durationMin} د`}
              </div>
              <div style={{ fontSize: 12, color: "#FF9F0A", marginTop: 2 }}>{reminderLabel(a.reminderOffset)}</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => edit(a)} style={iconBtnStyle}>
                <Pencil size={15} color="#8E8E93" />
              </button>
              <button onClick={() => remove(a.id)} style={iconBtnStyle}>
                <Trash2 size={15} color="#C7C7CC" />
              </button>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Settings
---------------------------------------------------------- */
function Settings({ state, setState }) {
  const setNotif = (key, val) =>
    setState((s) => ({ ...s, settings: { ...s.settings, notifications: { ...s.settings.notifications, [key]: val } } }));

  const setBlockName = (id, name) =>
    setState((s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === id ? { ...b, name } : b)) }));

  const setLocation = (val) =>
    setState((s) => ({ ...s, settings: { ...s.settings, locations: { ...s.settings.locations, gym: val } } }));

  const notifLabels = {
    gym: "تنبيه الجيم",
    language: "تنبيه اللغة",
    activity: "تنبيه الأنشطة",
    work: "تنبيه الشغل",
    supplements: "تنبيه المكملات",
  };

  return (
    <div style={{ padding: "20px 18px 100px" }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#1C1C1E", marginBottom: 18 }}>الإعدادات</div>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", margin: "6px 4px 10px" }}>التنبيهات</div>
      <GlassCard style={{ marginBottom: 18 }}>
        {Object.keys(notifLabels).map((key, i) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderTop: i > 0 ? "1px solid rgba(0,0,0,0.05)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {state.settings.notifications[key] ? (
                <Bell size={17} color="#0A84FF" />
              ) : (
                <BellOff size={17} color="#C7C7CC" />
              )}
              <span style={{ fontSize: 15, color: "#1C1C1E", fontWeight: 600 }}>{notifLabels[key]}</span>
            </div>
            <Toggle checked={state.settings.notifications[key]} onChange={(v) => setNotif(key, v)} />
          </div>
        ))}
      </GlassCard>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", margin: "6px 4px 10px" }}>
        وقت التنبيه الافتراضي للنشاطات الجديدة
      </div>
      <GlassCard style={{ padding: "14px 16px", marginBottom: 18 }}>
        <select
          value={state.settings.reminderMinutes}
          onChange={(e) =>
            setState((s) => ({ ...s, settings: { ...s.settings, reminderMinutes: Number(e.target.value) } }))
          }
          style={{ ...inputStyle, width: "100%" }}
        >
          {REMINDER_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </GlassCard>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", margin: "6px 4px 10px" }}>
        أسماء الفترات
      </div>
      <GlassCard style={{ marginBottom: 18 }}>
        {state.blocks.map((b, i) => (
          <div
            key={b.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderTop: i > 0 ? "1px solid rgba(0,0,0,0.05)" : "none",
            }}
          >
            <div style={{ width: 8, height: 24, borderRadius: 4, background: b.color }} />
            <input
              value={b.name}
              onChange={(e) => setBlockName(b.id, e.target.value)}
              style={{ ...inputStyle, flex: 1, border: "none", background: "transparent", padding: "6px 4px" }}
            />
          </div>
        ))}
      </GlassCard>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", margin: "6px 4px 10px" }}>
        موقع الجيم
      </div>
      <GlassCard style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <MapPin size={17} color="#8E8E93" />
        <input
          value={state.settings.locations.gym}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="رابط أو اسم الموقع من خرائط جوجل"
          style={{ ...inputStyle, flex: 1, border: "none", background: "transparent", padding: "6px 4px" }}
        />
      </GlassCard>
      <div style={{ fontSize: 12, color: "#B0B0B5", padding: "0 4px" }}>
        ملاحظة: هاي نسخة أولية — التنبيهات الفعلية وربط خرائط جوجل الحقيقي بيحتاجوا صلاحيات جهاز ومفتاح API، رح نضيفهم لما ننشر التطبيق فعلياً.
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   shared styles
---------------------------------------------------------- */
const inputStyle = {
  flex: 1,
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "white",
  color: "#1C1C1E",
  minWidth: 0,
};

const addBtnStyle = (bg) => ({
  border: "none",
  borderRadius: 12,
  width: 44,
  background: bg,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
});

const iconBtnStyle = {
  background: "rgba(0,0,0,0.04)",
  border: "none",
  borderRadius: 10,
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

/* ---------------------------------------------------------
   App shell — bottom tab bar
---------------------------------------------------------- */
export default function App() {
  const [state, setState] = useAppState();
  const [tab, setTab] = useState("home");

  const tabs = [
    { id: "home", label: "الرئيسية", icon: HomeIcon },
    { id: "gym", label: "الجيم", icon: Dumbbell },
    { id: "language", label: "اللغة", icon: Languages },
    { id: "activities", label: "الأنشطة", icon: ListChecks },
    { id: "settings", label: "الإعدادات", icon: SettingsIcon },
  ];

  return (
    <div
      dir="rtl"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Tahoma, Arial, sans-serif",
        minHeight: "100vh",
        maxWidth: 420,
        margin: "0 auto",
        background: "linear-gradient(180deg, #F2F2F7 0%, #EDEDF2 100%)",
        position: "relative",
      }}
    >
      {tab === "home" && <Home state={state} setState={setState} goTo={setTab} />}
      {tab === "gym" && <Gym state={state} setState={setState} />}
      {tab === "language" && <Language state={state} setState={setState} />}
      {tab === "activities" && <Activities state={state} setState={setState} />}
      {tab === "settings" && <Settings state={state} setState={setState} />}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 420,
        }}
      >
        <div
          style={{
            margin: "0 12px 14px",
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderRadius: 26,
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            display: "flex",
            padding: "8px 4px",
          }}
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  padding: "6px 0",
                  cursor: "pointer",
                }}
              >
                <Icon size={22} color={active ? "#FF375F" : "#8E8E93"} strokeWidth={active ? 2.3 : 2} />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    color: active ? "#FF375F" : "#8E8E93",
                  }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
