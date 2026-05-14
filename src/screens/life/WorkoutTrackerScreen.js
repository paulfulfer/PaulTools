import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, ActivityIndicator, Platform,
} from 'react-native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

// ─── Default program data (Fall 1 seed) ─────────────────────────────────────

function buildDefaultSections() {
  return [
    {
      title: 'Power + Corrective',
      trisets: [
        {
          header: 'Power Exercise',
          exercises: [
            { name: 'Power Exercise (e.g. DB Jump / KB Swing)', cue: 'Edit name and cue', sets: [{ reps: ['5','6','6','5'], tempo: 'x' }, { reps: ['5','6','6','5'], tempo: '' }, { reps: ['5','6','6','5'], tempo: '' }] },
          ],
        },
        {
          header: 'Corrective',
          exercises: [
            { name: 'Corrective (e.g. Hip Flexor Stretch)', cue: '', sets: [{ reps: ['2x5E','2x5E','2x5E','2x5E'], tempo: '1-1-1' }] },
          ],
        },
      ],
    },
    {
      title: 'Strength 1 — No Rest Btw Exercises, 90s Btw Tri-Set',
      trisets: [
        {
          header: '1A / 1B Tri-Set',
          exercises: [
            { name: '1A: Exercise (e.g. Squat)', cue: 'Form cue', sets: [{ reps: ['8','8','8','8'], tempo: '2-1-1' }, { reps: ['8','8','8','8'], tempo: '' }, { reps: ['8','6','6','8'], tempo: '' }] },
            { name: '1B: Exercise (e.g. Lat Pull Down)', cue: 'Form cue', sets: [{ reps: ['10E','8E','8E','8E'], tempo: '1-1-1' }, { reps: ['10E','8E','8E','8E'], tempo: '' }] },
          ],
        },
      ],
    },
    {
      title: 'Strength 2 / Core — No Rest Btw Exercises, 60s Btw Tri-Set',
      trisets: [
        {
          header: '2A / 2B / 2C Tri-Set',
          exercises: [
            { name: '2A: Exercise', cue: 'Form cue', sets: [{ reps: ['10','12','15','12'], tempo: '2-1-1' }, { reps: ['10','12','15','12'], tempo: '' }] },
            { name: '2B: Exercise', cue: 'Form cue', sets: [{ reps: ['8E','10E','10E','10E'], tempo: '1-1-1' }, { reps: ['8E','10E','10E','10E'], tempo: '' }] },
            { name: '2C: Exercise (Plank / Core)', cue: 'Form cue', sets: [{ reps: ['30s','35s','40s','45s'], tempo: 'TIME' }, { reps: ['30s','35s','40s','45s'], tempo: '' }] },
          ],
        },
      ],
    },
  ];
}

const FALL1_SEED = {
  id: 1, name: 'Fall 1',
  days: [
    {
      label: 'Day 1',
      sections: [
        {
          title: 'Power',
          trisets: [
            { header: 'Med Ball Circuit', exercises: [{ name: 'Med Ball Circuit', cue: '2-3 Rounds per week', sets: [{ reps: ['x15','x15','x15','x15'], tempo: '' }, { reps: ['x10 EA','x10 EA','x10 EA','x10 EA'], tempo: '' }, { reps: ['x10 EA','x10 EA','x10 EA','x10 EA'], tempo: '' }] }] },
            { header: 'Half Kneeling Band T-Spine Rotations', exercises: [{ name: 'Half Kneeling Band T-Spine Rotations', cue: '', sets: [{ reps: ['3x6E','3x6E','3x6E','3x5E'], tempo: 'X' }] }] },
            { header: 'Kratos Belt Squat', exercises: [{ name: 'Kratos Belt Squat', cue: 'FLY', sets: [{ reps: ['3x10','3x12','3x15','3x10'], tempo: 'FLY' }] }] },
          ],
        },
        {
          title: 'Strength 1 — No Rest Btw Exercises, 90s Btw Tri-Set',
          trisets: [
            { header: '1A / 1B Tri-Set', exercises: [
              { name: '1A: BB RDL', cue: '', sets: [{ reps: ['8','8','8','8'], tempo: '2-1-1' }, { reps: ['8','8','8','8'], tempo: '' }, { reps: ['8','6','6','8'], tempo: '' }, { reps: ['8','6','',''], tempo: '' }] },
              { name: '1B: DB Flat Bench', cue: '', sets: [{ reps: ['15','15','12','8'], tempo: '1-1-2' }, { reps: ['15','15','12','8'], tempo: '' }, { reps: ['15','10','10','8'], tempo: '' }, { reps: ['','10','8',''], tempo: '' }] },
            ]},
          ],
        },
        {
          title: 'Strength 2 — No Rest Btw Exercises, 60s Btw Tri-Set',
          trisets: [
            { header: '2A / 2B / 2C Tri-Set', exercises: [
              { name: '2A: TRX Squats + Press', cue: '', sets: [{ reps: ['8','10','10','8'], tempo: '1-1-1' }, { reps: ['8','10','10','8'], tempo: '' }, { reps: ['8','10','10','8'], tempo: '' }] },
              { name: '2B: 1-Arm DB Neutral Grip Row', cue: '', sets: [{ reps: ['8E','8E','8E','6E'], tempo: '1-1-1' }, { reps: ['8E','8E','8E','6E'], tempo: '' }, { reps: ['8E','8E','8E','6E'], tempo: '' }] },
              { name: '2C: Tall Kneeling Plate Chops', cue: '', sets: [{ reps: ['10E','10E','10E','8E'], tempo: '1-1-2' }, { reps: ['10E','10E','10E','8E'], tempo: '' }, { reps: ['10E','10E','10E','8E'], tempo: '' }] },
            ]},
          ],
        },
      ],
    },
    {
      label: 'Day 2',
      sections: [
        {
          title: 'Power',
          trisets: [
            { header: 'Box Jump or KB Swing', exercises: [{ name: 'Box Jump or KB Swing', cue: '', sets: [{ reps: ['5/8','4/8','3/8',''], tempo: '' }, { reps: ['5/8','4/8','3/8',''], tempo: '' }, { reps: ['5/8','4/8','3/8','3/8'], tempo: '' }] }] },
            { header: 'KB Windmills', exercises: [{ name: 'KB Windmills', cue: '', sets: [{ reps: ['3x5E','3x5E','3x5E','3x4E'], tempo: 'slow' }] }] },
          ],
        },
        {
          title: 'Strength 1 — No Rest Btw Exercises, 90s Btw Tri-Set',
          trisets: [
            { header: '1A / 1B Tri-Set', exercises: [
              { name: '1A: Safety Bar Back Squat', cue: '.75 M/S → .7 M/S progression', sets: [{ reps: ['8','8','6','8'], tempo: '2-1-1' }, { reps: ['8','8','8','8'], tempo: '' }, { reps: ['8','6','6','8'], tempo: '' }, { reps: ['8','6','6',''], tempo: '' }] },
              { name: '1B: Kratos 1/2 Kneeling Lat Pull Down', cue: 'Or Lat Pull Down Machine', sets: [{ reps: ['12','10','10','8'], tempo: '1-1-2' }, { reps: ['12','10','10','8'], tempo: '' }, { reps: ['12','10','8','8'], tempo: 'FLY' }, { reps: ['','10','8','8'], tempo: 'FLY' }] },
            ]},
          ],
        },
        {
          title: 'Strength 2 — No Rest Btw Exercises, 60s Btw Tri-Set',
          trisets: [
            { header: '2A / 2B / 2C Tri-Set', exercises: [
              { name: '2A: MB Groin Squeeze + Straight Arm Band Rotations', cue: '', sets: [{ reps: ['10E','10E','10E','10E'], tempo: '1-1-1' }, { reps: ['10E','10E','10E','10E'], tempo: '' }, { reps: ['10E','10E','10E','10E'], tempo: '1-1-1' }] },
              { name: '2B: Tricep Extension', cue: '', sets: [{ reps: ['12','12','15','15'], tempo: '1-1-1' }, { reps: ['12','12','15','15'], tempo: '1-1-1' }, { reps: ['12','15','15','15'], tempo: '1-1-1' }] },
              { name: '2C: Half Plank', cue: '', sets: [{ reps: ['25s','30s','40s','50s'], tempo: 'TIME' }, { reps: ['25s','30s','40s','50s'], tempo: '' }, { reps: ['25s','30s','40s','50s'], tempo: '' }] },
            ]},
          ],
        },
      ],
    },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function lastWeightForEx(sessions, progId, dayLabel, exKey) {
  const prev = sessions
    .filter(s => s.programId === progId && s.dayLabel === dayLabel)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const s of prev) {
    if (s.sets && s.sets[exKey]) {
      const w = s.sets[exKey].filter(Boolean).join(', ');
      if (w) return w;
    }
  }
  return null;
}

// ─── Add Card Modal ───────────────────────────────────────────────────────────

const AddCardModal = React.memo(function AddCardModal({ visible, onClose, onCreate }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [name, setName] = useState('');
  const [numDays, setNumDays] = useState('3');

  useEffect(() => { if (visible) { setName(''); setNumDays('3'); } }, [visible]);

  const handleCreate = () => {
    if (!name.trim()) return Alert.alert('Required', 'Card name is required.');
    onCreate(name.trim(), parseInt(numDays) || 3);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mo.overlay}>
        <View style={[mo.sheet, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
          <View style={[mo.header, { borderBottomColor: c.borderSubtle }]}>
            <Text style={[mo.title, { color: c.textPrimary, fontFamily: MONO }]}>Add Program Card</Text>
            <TouchableOpacity style={[mo.closeBtn, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]} onPress={onClose}>
              <Text style={{ color: c.textMuted, fontSize: 14 }}>×</Text>
            </TouchableOpacity>
          </View>
          <View style={mo.body}>
            <Text style={[mo.label, { color: c.textMuted, fontFamily: MONO }]}>CARD NAME</Text>
            <TextInput
              style={[mo.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              value={name} onChangeText={setName} placeholder="e.g. Fall 1, Off-Season 3"
              placeholderTextColor={c.textMuted} autoCorrect={false}
            />
            <Text style={[mo.label, { color: c.textMuted, fontFamily: MONO, marginTop: 10 }]}>DAYS PER CARD</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {['2', '3', '4'].map(d => (
                <TouchableOpacity key={d} onPress={() => setNumDays(d)}
                  style={[mo.dayBtn, { borderColor: numDays === d ? c.blue : c.borderSubtle, backgroundColor: numDays === d ? c.blueGlow : 'transparent' }]}>
                  <Text style={[mo.dayBtnTxt, { color: numDays === d ? c.blue : c.textMuted, fontFamily: MONO }]}>{d} Days</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[mo.actions, { borderTopColor: c.borderSubtle }]}>
              <TouchableOpacity onPress={onClose} style={[mo.btn, { borderColor: c.borderSubtle }]}>
                <Text style={[mo.btnTxt, { color: c.textMuted, fontFamily: MONO }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} style={[mo.btn, { borderColor: c.blue, backgroundColor: c.blueGlow }]}>
                <Text style={[mo.btnTxt, { color: c.blue, fontFamily: MONO }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const mo = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:     { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, overflow: 'hidden' },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  title:     { fontSize: 15, fontWeight: '600', flex: 1 },
  closeBtn:  { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body:      { padding: 16, paddingBottom: 32 },
  label:     { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, marginBottom: 4 },
  input:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  dayBtn:    { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  dayBtnTxt: { fontSize: 12, fontWeight: '600' },
  actions:   { flexDirection: 'row', gap: 10, marginTop: 20, paddingTop: 14, borderTopWidth: 1 },
  btn:       { flex: 1, borderWidth: 1, borderRadius: 20, paddingVertical: 8, alignItems: 'center' },
  btnTxt:    { fontSize: 12, fontWeight: '600' },
});

// ─── Exercise Block ───────────────────────────────────────────────────────────

function ExerciseBlock({ ex, exKey, activeWeek, lastW, liveWeightsRef, c }) {
  const [weights, setWeights] = useState(() => (ex.sets || []).map(() => ''));

  useEffect(() => {
    setWeights((ex.sets || []).map((_, si) => liveWeightsRef.current[`${exKey}-${si}`] || ''));
  }, [exKey]);

  const updateWeight = (si, val) => {
    liveWeightsRef.current[`${exKey}-${si}`] = val;
    setWeights(prev => { const n = [...prev]; n[si] = val; return n; });
  };

  return (
    <View style={[eb.block, { borderBottomColor: c.borderSubtle }]}>
      <Text style={[eb.name, { color: c.textPrimary, fontFamily: MONO }]}>{ex.name}</Text>
      {!!ex.cue && <Text style={[eb.cue, { color: c.textMuted, fontFamily: MONO }]}>{ex.cue}</Text>}
      {(ex.sets || []).map((set, si) => {
        const prescribed = Array.isArray(set.reps)
          ? (set.reps[activeWeek] ?? set.reps[set.reps.length - 1] ?? '')
          : (set.reps || '');
        return (
          <View key={si} style={eb.setRow}>
            <Text style={[eb.setLabel, { color: c.textMuted, fontFamily: MONO }]}>Set {si + 1}</Text>
            <Text style={[eb.prescribed, { color: c.textSecondary, fontFamily: MONO }]}>{String(prescribed)}</Text>
            {!!set.tempo && <Text style={[eb.tempo, { color: c.textMuted, fontFamily: MONO }]}>{set.tempo}</Text>}
            <TextInput
              style={[eb.weightInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.green, fontFamily: MONO }]}
              value={weights[si] || ''} onChangeText={v => updateWeight(si, v)}
              placeholder="lbs" placeholderTextColor={c.textMuted} keyboardType="numeric"
            />
            {si === 0 && !!lastW && (
              <Text style={[eb.lastW, { color: c.textMuted, fontFamily: MONO }]}>last: {lastW}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const eb = StyleSheet.create({
  block:      { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  name:       { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  cue:        { fontSize: 10, fontStyle: 'italic', marginBottom: 6, lineHeight: 14 },
  setRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  setLabel:   { fontSize: 10, fontWeight: '600', width: 36 },
  prescribed: { fontSize: 11, fontWeight: '600', minWidth: 52 },
  tempo:      { fontSize: 10, minWidth: 44 },
  weightInput:{ width: 64, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  lastW:      { fontSize: 10, fontStyle: 'italic' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WorkoutTrackerScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;

  const [programs,  setPrograms]  = useState([]);
  const [sessions,  setSessions]  = useState([]);
  const [prs,       setPrs]       = useState({ squat: '', bench: '', dead: '' });
  const [idCounter, setIdCounter] = useState(2);
  const [loading,   setLoading]   = useState(true);
  const [saved,     setSaved]     = useState(false);

  const [activeProg, setActiveProg] = useState(null);
  const [activeDay,  setActiveDay]  = useState(0);
  const [activeWeek, setActiveWeek] = useState(0);

  const [addCardModal,   setAddCardModal]   = useState(false);
  const [historyOpen,    setHistoryOpen]    = useState(false);
  const [sessionNotes,   setSessionNotes]   = useState('');
  const [sessionRPE,     setSessionRPE]     = useState('');

  const liveWeightsRef = useRef({});

  const programsRef = useRef(programs);
  const sessionsRef = useRef(sessions);
  const prsRef      = useRef(prs);
  const counterRef  = useRef(idCounter);
  const userRef     = useRef(user);
  useEffect(() => { programsRef.current = programs; }, [programs]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { prsRef.current = prs; }, [prs]);
  useEffect(() => { counterRef.current = idCounter; }, [idCounter]);
  useEffect(() => { userRef.current = user; }, [user]);

  const docRef = () => {
    const uid = userRef.current?.uid;
    if (!uid) return null;
    return firebase.firestore().collection('users').doc(uid).collection('localStorage').doc('data');
  };

  const writeAll = async (progs, sess, prsData, ctr) => {
    const ref = docRef();
    if (!ref) return;
    await ref.set({
      workout_programs: JSON.stringify(progs),
      workout_sessions: JSON.stringify(sess),
      workout_prs:      JSON.stringify(prsData),
      workout_id:       String(ctr),
    }, { merge: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const ref  = docRef();
      if (!ref) return;
      const snap = await ref.get();
      const d    = snap.exists ? snap.data() : {};
      const progs = JSON.parse(d.workout_programs || 'null');
      if (progs && progs.length > 0) {
        setPrograms(progs);
        setActiveProg(progs[0].id);
      } else {
        setPrograms([FALL1_SEED]);
        setActiveProg(FALL1_SEED.id);
        // Don't write seed on load — write on first real save
      }
      setSessions(JSON.parse(d.workout_sessions || '[]'));
      setPrs(JSON.parse(d.workout_prs || '{"squat":"","bench":"","dead":""}'));
      setIdCounter(parseInt(d.workout_id || '2', 10));
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  // ── PR update ───────────────────────────────────────────────────────────────

  const updatePR = useCallback(async (key, val) => {
    const updated = { ...prsRef.current, [key]: val };
    setPrs(updated);
    try { await writeAll(programsRef.current, sessionsRef.current, updated, counterRef.current); }
    catch (err) { Alert.alert('Save error', err.message); }
  }, []);

  // ── Add card ────────────────────────────────────────────────────────────────

  const handleCreateCard = useCallback(async (name, numDays) => {
    const ctr  = counterRef.current;
    const days = Array.from({ length: numDays }, (_, i) => ({ label: `Day ${i + 1}`, sections: buildDefaultSections() }));
    const card = { id: ctr, name, days };
    const updated = [...programsRef.current, card];
    const newCtr = ctr + 1;
    setPrograms(updated);
    setIdCounter(newCtr);
    setActiveProg(card.id);
    setActiveDay(0);
    setActiveWeek(0);
    liveWeightsRef.current = {};
    setAddCardModal(false);
    try { await writeAll(updated, sessionsRef.current, prsRef.current, newCtr); }
    catch (err) { Alert.alert('Save error', err.message); }
  }, []);

  // ── Delete card ─────────────────────────────────────────────────────────────

  const handleDeleteCard = useCallback(() => {
    const pid = activeProg;
    Alert.alert('Delete card?', 'This will also remove all logged sessions for this card.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const updProgs = programsRef.current.filter(p => p.id !== pid);
          const updSess  = sessionsRef.current.filter(s => s.programId !== pid);
          setPrograms(updProgs);
          setSessions(updSess);
          setActiveProg(updProgs.length > 0 ? updProgs[0].id : null);
          setActiveDay(0); setActiveWeek(0);
          liveWeightsRef.current = {};
          try { await writeAll(updProgs, updSess, prsRef.current, counterRef.current); }
          catch (err) { Alert.alert('Save error', err.message); }
        },
      },
    ]);
  }, [activeProg]);

  // ── Log session ─────────────────────────────────────────────────────────────

  const handleLogSession = useCallback(async () => {
    const prog = programsRef.current.find(p => p.id === activeProg);
    if (!prog) return;
    const day = (prog.days || [])[activeDay];
    const session = {
      id: counterRef.current,
      programId: activeProg,
      cardName:  prog.name,
      dayLabel:  day ? day.label : `Day ${activeDay + 1}`,
      week:      activeWeek + 1,
      date:      new Date().toISOString(),
      rpe:       sessionRPE,
      notes:     sessionNotes,
      sets:      { ...liveWeightsRef.current },
    };
    const updSess = [session, ...sessionsRef.current];
    const newCtr  = counterRef.current + 1;
    setSessions(updSess);
    setIdCounter(newCtr);
    liveWeightsRef.current = {};
    setSessionNotes('');
    setSessionRPE('');
    Alert.alert('Session logged!');
    try { await writeAll(programsRef.current, updSess, prsRef.current, newCtr); }
    catch (err) { Alert.alert('Save error', err.message); }
  }, [activeProg, activeDay, activeWeek, sessionNotes, sessionRPE]);

  // ── Delete session ───────────────────────────────────────────────────────────

  const handleDeleteSession = useCallback((id) => {
    Alert.alert('Delete session?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const updSess = sessionsRef.current.filter(s => s.id !== id);
          setSessions(updSess);
          try { await writeAll(programsRef.current, updSess, prsRef.current, counterRef.current); }
          catch (err) { Alert.alert('Save error', err.message); }
        },
      },
    ]);
  }, []);

  // ── Select card/day/week ────────────────────────────────────────────────────

  const selectCard = (id) => {
    setActiveProg(id); setActiveDay(0); setActiveWeek(0);
    liveWeightsRef.current = {};
    setSessionNotes(''); setSessionRPE('');
  };

  const selectDay = (i) => {
    setActiveDay(i);
    liveWeightsRef.current = {};
    setSessionNotes(''); setSessionRPE('');
  };

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={[s.centered, { backgroundColor: c.bgBase }]}><ActivityIndicator color={c.red} size="large" /></View>;
  }

  const prog = programs.find(p => p.id === activeProg);
  const day  = prog ? (prog.days || [])[activeDay] : null;

  // Build exercise render list with global indices for liveWeight keys
  let exGlobalIdx = 0;
  const dayExercises = [];
  if (day) {
    (day.sections || []).forEach(sec => {
      const secExercises = [];
      (sec.trisets || []).forEach(ts => {
        const tsExercises = [];
        (ts.exercises || []).forEach(ex => {
          const exKey = `${activeProg}-${activeDay}-${exGlobalIdx}`;
          const lastW = lastWeightForEx(sessions, activeProg, day.label, exKey);
          tsExercises.push({ ex, exKey, lastW });
          exGlobalIdx++;
        });
        secExercises.push({ header: ts.header, exercises: tsExercises });
      });
      dayExercises.push({ title: sec.title, trisets: secExercises });
    });
  }

  const WEEKS = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];

  return (
    <View style={{ flex: 1, backgroundColor: c.bgBase }}>
      {saved && (
        <View style={[s.savedBadge, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
          <Text style={[s.savedText, { color: c.green, fontFamily: MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── PR Bar ─────────────────────────────────────────────── */}
        <View style={s.prRow}>
          {[
            { key: 'squat', label: 'Squat PR' },
            { key: 'bench', label: 'Bench PR' },
            { key: 'dead',  label: 'Deadlift PR' },
          ].map(({ key, label }) => (
            <View key={key} style={[s.prCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
              <Text style={[s.prLabel, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>
              <TextInput
                style={[s.prInput, { color: c.green, fontFamily: MONO }]}
                value={prs[key]} onChangeText={v => updatePR(key, v)}
                placeholder="0" placeholderTextColor={c.textMuted} keyboardType="numeric"
              />
              <Text style={[s.prUnit, { color: c.textMuted, fontFamily: MONO }]}>lbs</Text>
            </View>
          ))}
        </View>

        {/* ── Card Tabs ──────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}
          contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
          {programs.map(p => (
            <TouchableOpacity key={p.id} onPress={() => selectCard(p.id)}
              style={[s.cardTab, {
                borderColor: p.id === activeProg ? c.blue : c.borderSubtle,
                backgroundColor: p.id === activeProg ? c.blueGlow : c.bgCard,
              }]}>
              <Text style={[s.cardTabTxt, { color: p.id === activeProg ? c.blue : c.textMuted, fontFamily: MONO }]}>
                {p.name.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setAddCardModal(true)}
            style={[s.cardTab, s.cardTabDashed, { borderColor: c.borderSubtle }]}>
            <Text style={[s.cardTabTxt, { color: c.textMuted, fontFamily: MONO }]}>+ Card</Text>
          </TouchableOpacity>
        </ScrollView>

        {!prog ? (
          <View style={[s.emptyBox, { borderColor: c.borderSubtle }]}>
            <Text style={[s.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>
              No program cards yet. Tap "+ Card" to add your first program.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Day + Week Selectors ────────────────────────────── */}
            <View style={s.dayWeekBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                {(prog.days || []).map((d, i) => (
                  <TouchableOpacity key={i} onPress={() => selectDay(i)}
                    style={[s.dayTab, {
                      borderColor: i === activeDay ? c.purple : c.borderSubtle,
                      backgroundColor: i === activeDay ? c.purpleGlow : c.bgCard,
                    }]}>
                    <Text style={[s.dayTabTxt, { color: i === activeDay ? c.purple : c.textMuted, fontFamily: MONO }]}>
                      {d.label.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 4, marginLeft: 8 }}>
                {WEEKS.map((w, i) => (
                  <TouchableOpacity key={i} onPress={() => setActiveWeek(i)}
                    style={[s.weekTab, {
                      borderColor: i === activeWeek ? c.amber : c.borderSubtle,
                      backgroundColor: i === activeWeek ? c.amberGlow : c.bgCard,
                    }]}>
                    <Text style={[s.weekTabTxt, { color: i === activeWeek ? c.amber : c.textMuted, fontFamily: MONO }]}>
                      {w.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Sections ────────────────────────────────────────── */}
            {dayExercises.map((sec, si) => (
              <View key={si} style={{ marginBottom: 10 }}>
                <View style={[s.secTitle, { backgroundColor: c.bgCard }]}>
                  <Text style={[s.secTitleTxt, { color: c.textMuted, fontFamily: MONO }]}>{sec.title.toUpperCase()}</Text>
                </View>
                {sec.trisets.map((ts, ti) => (
                  <View key={ti} style={[s.triset, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                    <View style={[s.trisetHeader, { backgroundColor: c.bgBase, borderBottomColor: c.borderSubtle }]}>
                      <Text style={[s.trisetHeaderTxt, { color: c.textMuted, fontFamily: MONO }]}>{ts.header.toUpperCase()}</Text>
                    </View>
                    {ts.exercises.map(({ ex, exKey, lastW }) => (
                      <ExerciseBlock
                        key={exKey}
                        ex={ex}
                        exKey={exKey}
                        activeWeek={activeWeek}
                        lastW={lastW}
                        liveWeightsRef={liveWeightsRef}
                        c={c}
                      />
                    ))}
                  </View>
                ))}
              </View>
            ))}

            {/* ── RPE + Log Session ───────────────────────────────── */}
            <View style={[s.triset, { backgroundColor: c.bgCard, borderColor: c.borderSubtle, marginBottom: 10 }]}>
              <View style={[s.rpeRow, { borderBottomColor: c.borderSubtle }]}>
                <Text style={[s.rpeLabel, { color: c.textMuted, fontFamily: MONO }]}>RPE</Text>
                <TextInput
                  style={[s.rpeInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.amber, fontFamily: MONO }]}
                  value={sessionRPE} onChangeText={setSessionRPE}
                  placeholder="1-10" placeholderTextColor={c.textMuted} keyboardType="numeric"
                />
                <Text style={[s.rpeScale, { color: c.textMuted, fontFamily: MONO }]}>
                  1-2 easy · 3-4 moderate · 5-7 hard · 8-9 very hard · 10 max
                </Text>
              </View>
              <View style={s.sessionActions}>
                <TextInput
                  style={[s.notesInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={sessionNotes} onChangeText={setSessionNotes}
                  placeholder="Session notes..." placeholderTextColor={c.textMuted}
                />
                <TouchableOpacity onPress={handleLogSession}
                  style={[s.logBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                  <Text style={[s.logBtnTxt, { color: c.green, fontFamily: MONO }]}>Log Session</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteCard}
                  style={[s.logBtn, { backgroundColor: c.redGlow, borderColor: c.red }]}>
                  <Text style={[s.logBtnTxt, { color: c.red, fontFamily: MONO }]}>Delete Card</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* ── Session History ─────────────────────────────────────── */}
        <TouchableOpacity onPress={() => setHistoryOpen(v => !v)}
          style={[s.histHeader, { borderColor: c.borderSubtle }]}>
          <Text style={[s.histLabel, { color: c.textMuted, fontFamily: MONO }]}>SESSION HISTORY</Text>
          <Text style={[s.histToggle, { color: c.textMuted }]}>{historyOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {historyOpen && (
          sessions.length === 0 ? (
            <View style={[s.emptyBox, { borderColor: c.borderSubtle }]}>
              <Text style={[s.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No sessions logged yet.</Text>
            </View>
          ) : (
            sessions.slice(0, 30).map(sess => (
              <View key={sess.id} style={[s.histItem, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                <View style={s.histTop}>
                  <Text style={[s.histDate, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>
                    {sess.cardName} — {sess.dayLabel} Week {sess.week}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {!!sess.rpe && (
                      <Text style={[s.histRPE, { color: c.amber, fontFamily: MONO }]}>RPE {sess.rpe}</Text>
                    )}
                    <TouchableOpacity onPress={() => handleDeleteSession(sess.id)}>
                      <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[s.histMeta, { color: c.textMuted, fontFamily: MONO }]}>
                  {fmtDate(sess.date)}{sess.notes ? ` · ${sess.notes}` : ''}
                </Text>
              </View>
            ))
          )
        )}

      </ScrollView>

      <AddCardModal
        visible={addCardModal}
        onClose={() => setAddCardModal(false)}
        onCreate={handleCreateCard}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:       { padding: 14, paddingBottom: 60 },
  savedBadge:   { position: 'absolute', bottom: 16, right: 16, zIndex: 99, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  savedText:    { fontSize: 11, fontWeight: '600' },

  prRow:        { flexDirection: 'row', gap: 6, marginBottom: 14 },
  prCard:       { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  prLabel:      { fontSize: 9, fontWeight: '600', letterSpacing: 0.6, marginBottom: 4 },
  prInput:      { fontSize: 20, fontWeight: '700', textAlign: 'center', width: '100%', paddingVertical: 0 },
  prUnit:       { fontSize: 9, marginTop: 2 },

  cardTab:      { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  cardTabDashed:{ borderStyle: 'dashed' },
  cardTabTxt:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  dayWeekBar:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dayTab:       { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4 },
  dayTabTxt:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  weekTab:      { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4 },
  weekTabTxt:   { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

  secTitle:     { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 6, alignSelf: 'flex-start' },
  secTitleTxt:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },

  triset:       { borderWidth: 1, borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
  trisetHeader: { paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1 },
  trisetHeaderTxt: { fontSize: 9, fontWeight: '600', letterSpacing: 0.8 },

  rpeRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, flexWrap: 'wrap' },
  rpeLabel:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  rpeInput:     { width: 52, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  rpeScale:     { fontSize: 9, flex: 1, lineHeight: 13 },

  sessionActions: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, flexWrap: 'wrap' },
  notesInput:   { flex: 1, minWidth: 120, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12 },
  logBtn:       { borderWidth: 1, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  logBtnTxt:    { fontSize: 11, fontWeight: '700' },

  histHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 6, borderBottomWidth: 1 },
  histLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  histToggle:   { fontSize: 12 },
  histItem:     { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 6 },
  histTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  histDate:     { fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
  histRPE:      { fontSize: 11, fontWeight: '700' },
  histMeta:     { fontSize: 10 },

  emptyBox:     { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 24, alignItems: 'center', marginBottom: 8 },
  emptyTxt:     { fontSize: 12 },
});
