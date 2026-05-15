import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, ActivityIndicator, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../hooks/useHaptics';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDate(str) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtShortDate(str) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

function fmtN(n) { return parseFloat(n).toFixed(1); }

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ label, open, onToggle, right, c, children }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}
        style={[ss.header, { borderBottomColor: c.borderSubtle }]}>
        <Text style={[ss.label, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {right}
          <Text style={{ color: c.textMuted, fontSize: 12 }}>{open ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>
      {open && <View style={ss.body}>{children}</View>}
    </View>
  );
}
const ss = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, marginBottom: 8 },
  label:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  body:   { marginBottom: 10 },
});

// ─── Pill Select ──────────────────────────────────────────────────────────────

function PillSelect({ options, value, onChange, c }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
      {options.map(opt => (
        <TouchableOpacity key={opt} onPress={() => onChange(opt)}
          style={[ps.pill, {
            borderColor:       value === opt ? c.blue : c.borderSubtle,
            backgroundColor:   value === opt ? c.blueGlow : 'transparent',
          }]}>
          <Text style={[ps.txt, { color: value === opt ? c.blue : c.textMuted, fontFamily: MONO }]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const ps = StyleSheet.create({
  pill: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  txt:  { fontSize: 11, fontWeight: '600' },
});

// ─── Add Card Modal ───────────────────────────────────────────────────────────

const AddCardModal = React.memo(function AddCardModal({ visible, onClose, onCreate }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [name, setName] = useState('');

  useEffect(() => { if (visible) setName(''); }, [visible]);

  const handle = () => {
    if (!name.trim()) return Alert.alert('Required', 'Card name is required.');
    onCreate(name.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={am.overlay}>
        <View style={[am.sheet, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
          <View style={[am.header, { borderBottomColor: c.borderSubtle }]}>
            <Text style={[am.title, { color: c.textPrimary, fontFamily: MONO }]}>Add Program Card</Text>
            <TouchableOpacity onPress={onClose}
              style={[am.close, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
              <Text style={{ color: c.textMuted, fontSize: 14 }}>×</Text>
            </TouchableOpacity>
          </View>
          <View style={am.body}>
            <Text style={[am.lbl, { color: c.textMuted, fontFamily: MONO }]}>CARD NAME</Text>
            <TextInput
              style={[am.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              value={name} onChangeText={setName}
              placeholder="e.g. Fall 1, Off-Season 3"
              placeholderTextColor={c.textMuted} autoCorrect={false}
            />
            <Text style={[am.hint, { color: c.textMuted, fontFamily: MONO }]}>
              Add your trainer program names as quick reference labels.
            </Text>
            <View style={[am.actions, { borderTopColor: c.borderSubtle }]}>
              <TouchableOpacity onPress={onClose}
                style={[am.btn, { borderColor: c.borderSubtle }]}>
                <Text style={[am.btnTxt, { color: c.textMuted, fontFamily: MONO }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handle}
                style={[am.btn, { borderColor: c.blue, backgroundColor: c.blueGlow }]}>
                <Text style={[am.btnTxt, { color: c.blue, fontFamily: MONO }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
});
const am = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:   { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, overflow: 'hidden' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  title:   { fontSize: 15, fontWeight: '600', flex: 1 },
  close:   { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body:    { padding: 16, paddingBottom: 32 },
  lbl:     { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, marginBottom: 4 },
  input:   { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginBottom: 8 },
  hint:    { fontSize: 10, lineHeight: 15, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 14, borderTopWidth: 1 },
  btn:     { flex: 1, borderWidth: 1, borderRadius: 20, paddingVertical: 8, alignItems: 'center' },
  btnTxt:  { fontSize: 12, fontWeight: '600' },
});

// ─── Weight Chart ─────────────────────────────────────────────────────────────

function WeightChart({ data, c }) {
  const vals  = data.map(w => w.val);
  const minW  = Math.min(...vals);
  const maxW  = Math.max(...vals);
  const range = maxW - minW || 1;

  return (
    <View style={[wc.wrap, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
      <Text style={[wc.title, { color: c.textMuted, fontFamily: MONO }]}>WEIGHT OVER TIME</Text>
      <View style={wc.row}>
        {data.map((w, i) => {
          const h = Math.max(4, Math.round(((w.val - minW) / range) * 68) + 6);
          const isLatest = i === data.length - 1;
          const col = isLatest ? c.blue : c.teal;
          return (
            <View key={w.id} style={wc.col}>
              <Text style={[wc.val, { color: col, fontFamily: MONO }]}>{fmtN(w.val)}</Text>
              <View style={[wc.bar, { height: h, backgroundColor: col, opacity: isLatest ? 1 : 0.6 }]} />
              <Text style={[wc.date, { color: c.textMuted, fontFamily: MONO }]}>{fmtShortDate(w.date)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
const wc = StyleSheet.create({
  wrap:  { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10 },
  title: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  row:   { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 90 },
  col:   { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  val:   { fontSize: 8, fontWeight: '600', textAlign: 'center' },
  bar:   { width: '100%', borderRadius: 3 },
  date:  { fontSize: 8, textAlign: 'center' },
});

// ─── Met Card ─────────────────────────────────────────────────────────────────

function MetCard({ label, value, sub, color, c }) {
  return (
    <View style={[mc.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
      <Text style={[mc.label, { color: c.textMuted,              fontFamily: MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[mc.value, { color: color || c.textPrimary,   fontFamily: MONO }]}>{value}</Text>
      {!!sub && <Text style={[mc.sub, { color: c.textMuted, fontFamily: MONO }]}>{sub}</Text>}
    </View>
  );
}
const mc = StyleSheet.create({
  card:  { width: '30%', flexGrow: 1, borderWidth: 1, borderRadius: 8, padding: 11, margin: 3 },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginBottom: 3 },
  value: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  sub:   { fontSize: 9, marginTop: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WorkoutTrackerScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const { triggerHaptic } = useHaptics();
  const c = theme.colors;

  const [cards,    setCards]    = useState([]);
  const [sessions, setSessions] = useState([]);
  const [weights,  setWeights]  = useState([]);
  const [prs,      setPrs]      = useState({ squat: '', bench: '', dead: '' });
  const [idC,      setIdC]      = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [saved,    setSaved]    = useState(false);

  const [cardsOpen,  setCardsOpen]  = useState(true);
  const [logOpen,    setLogOpen]    = useState(true);
  const [histOpen,   setHistOpen]   = useState(true);
  const [weightOpen, setWeightOpen] = useState(true);

  const [fProg,  setFProg]  = useState('P1');
  const [fDay,   setFDay]   = useState('Day 1');
  const [fWeek,  setFWeek]  = useState('Week 1');
  const [fRPE,   setFRPE]   = useState('');
  const [fNotes, setFNotes] = useState('');

  const [fWeight,    setFWeight]    = useState('');
  const [fWtDate,    setFWtDate]    = useState(new Date());
  const [fWtNote,    setFWtNote]    = useState('');
  const [datePicker, setDatePicker] = useState(false);

  const [addCardModal, setAddCardModal] = useState(false);

  const cardsRef   = useRef(cards);
  const sessRef    = useRef(sessions);
  const weightsRef = useRef(weights);
  const prsRef     = useRef(prs);
  const idCRef     = useRef(idC);
  const userRef    = useRef(user);
  useEffect(() => { cardsRef.current   = cards;    }, [cards]);
  useEffect(() => { sessRef.current    = sessions; }, [sessions]);
  useEffect(() => { weightsRef.current = weights;  }, [weights]);
  useEffect(() => { prsRef.current     = prs;      }, [prs]);
  useEffect(() => { idCRef.current     = idC;      }, [idC]);
  useEffect(() => { userRef.current    = user;     }, [user]);

  const docRef = () => {
    const uid = userRef.current?.uid;
    if (!uid) return null;
    return firebase.firestore().collection('users').doc(uid).collection('localStorage').doc('data');
  };

  const writeAll = async (ca, se, we, pr, id) => {
    const ref = docRef();
    if (!ref) return;
    await ref.set({
      workout_cards:    JSON.stringify(ca),
      workout_sessions: JSON.stringify(se),
      workout_weights:  JSON.stringify(we),
      workout_prs:      JSON.stringify(pr),
      workout_id:       String(id),
    }, { merge: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const ref  = docRef();
      if (!ref) return;
      const snap = await ref.get();
      const d    = snap.exists ? snap.data() : {};
      setCards(JSON.parse(d.workout_cards    || '[]'));
      setSessions(JSON.parse(d.workout_sessions || '[]'));
      setWeights(JSON.parse(d.workout_weights  || '[]'));
      setPrs(JSON.parse(d.workout_prs || '{"squat":"","bench":"","dead":""}'));
      setIdC(parseInt(d.workout_id || '1', 10));
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  // ── PR update ────────────────────────────────────────────────────────────────

  const updatePR = useCallback(async (key, val) => {
    const updated = { ...prsRef.current, [key]: val };
    setPrs(updated);
    try {
      const ref = docRef();
      if (ref) await ref.set({ workout_prs: JSON.stringify(updated) }, { merge: true });
    } catch { /* silent */ }
  }, []);

  // ── Cards ─────────────────────────────────────────────────────────────────────

  const handleAddCard = useCallback(async (name) => {
    triggerHaptic();
    const id = idCRef.current;
    const card = {
      id, name,
      addedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
    const updated = [...cardsRef.current, card];
    const newId = id + 1;
    setCards(updated);
    setIdC(newId);
    setAddCardModal(false);
    try { await writeAll(updated, sessRef.current, weightsRef.current, prsRef.current, newId); }
    catch (err) { Alert.alert('Save error', err.message); }
  }, []);

  const handleDeleteCard = useCallback((id) => {
    Alert.alert('Remove card?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = cardsRef.current.filter(c2 => c2.id !== id);
        setCards(updated);
        try { await writeAll(updated, sessRef.current, weightsRef.current, prsRef.current, idCRef.current); }
        catch (err) { Alert.alert('Save error', err.message); }
      }},
    ]);
  }, []);

  // ── Session ───────────────────────────────────────────────────────────────────

  const handleLogSession = async () => {
    triggerHaptic();
    const id = idCRef.current;
    const session = {
      id, prog: fProg, day: fDay, week: fWeek,
      rpe: fRPE, notes: fNotes.trim(),
      date: new Date().toISOString(),
    };
    const updated = [session, ...sessRef.current];
    const newId = id + 1;
    setSessions(updated);
    setIdC(newId);
    setFRPE(''); setFNotes('');
    try { await writeAll(cardsRef.current, updated, weightsRef.current, prsRef.current, newId); }
    catch (err) { Alert.alert('Save error', err.message); }
  };

  const handleDeleteSession = useCallback((id) => {
    Alert.alert('Delete session?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const updated = sessRef.current.filter(s => s.id !== id);
        setSessions(updated);
        try { await writeAll(cardsRef.current, updated, weightsRef.current, prsRef.current, idCRef.current); }
        catch (err) { Alert.alert('Save error', err.message); }
      }},
    ]);
  }, []);

  // ── Weight ────────────────────────────────────────────────────────────────────

  const handleLogWeight = async () => {
    triggerHaptic();
    const val = parseFloat(fWeight);
    if (isNaN(val) || val <= 0) return Alert.alert('Invalid', 'Please enter a valid weight.');
    const id = idCRef.current;
    const entry = { id, val, date: fmtDateKey(fWtDate), note: fWtNote.trim() };
    const raw = [...weightsRef.current, entry];
    raw.sort((a, b) => new Date(b.date) - new Date(a.date));
    const newId = id + 1;
    setWeights(raw);
    setIdC(newId);
    setFWeight(''); setFWtNote('');
    try { await writeAll(cardsRef.current, sessRef.current, raw, prsRef.current, newId); }
    catch (err) { Alert.alert('Save error', err.message); }
  };

  const handleDeleteWeight = useCallback((id) => {
    Alert.alert('Delete entry?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const updated = weightsRef.current.filter(w => w.id !== id).sort((a, b) => new Date(b.date) - new Date(a.date));
        setWeights(updated);
        try { await writeAll(cardsRef.current, sessRef.current, updated, prsRef.current, idCRef.current); }
        catch (err) { Alert.alert('Save error', err.message); }
      }},
    ]);
  }, []);

  // ── Derived weight metrics ────────────────────────────────────────────────────

  const sorted = [...weights].sort((a, b) => new Date(b.date) - new Date(a.date));
  const asc    = [...weights].sort((a, b) => new Date(a.date) - new Date(b.date));
  const currentW    = sorted.length > 0 ? sorted[0].val : null;
  const startW      = asc.length    > 0 ? asc[0].val    : null;
  const lowW        = weights.length > 0 ? Math.min(...weights.map(w => w.val)) : null;
  const totalChange = currentW != null && startW != null ? currentW - startW : null;
  const lastChange  = sorted.length >= 2 ? sorted[0].val - sorted[1].val : null;
  const chartData   = asc.slice(-12);

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={[st.centered, { backgroundColor: c.bgBase }]}><ActivityIndicator color={c.red} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgBase }}>
      {saved && (
        <View style={[st.savedBadge, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
          <Text style={[st.savedText, { color: c.green, fontFamily: MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── PR Bar ─────────────────────────────────────────────────────── */}
        <View style={st.prRow}>
          {[
            { key: 'squat', label: 'Squat PR' },
            { key: 'bench', label: 'Bench PR' },
            { key: 'dead',  label: 'Deadlift PR' },
          ].map(({ key, label }) => (
            <View key={key} style={[st.prCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
              <Text style={[st.prLabel, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>
              <TextInput
                style={[st.prInput, { color: c.green, fontFamily: MONO }]}
                value={prs[key]} onChangeText={v => updatePR(key, v)}
                placeholder="0" placeholderTextColor={c.textMuted} keyboardType="numeric"
              />
              <Text style={[st.prUnit, { color: c.textMuted, fontFamily: MONO }]}>lbs</Text>
            </View>
          ))}
        </View>

        {/* ── Program Cards ──────────────────────────────────────────────── */}
        <Section
          label="Program Cards" open={cardsOpen} onToggle={() => setCardsOpen(v => !v)}
          right={
            <TouchableOpacity onPress={() => setAddCardModal(true)}
              style={[st.smBtn, { borderColor: c.blue, backgroundColor: c.blueGlow }]}>
              <Text style={[st.smBtnTxt, { color: c.blue, fontFamily: MONO }]}>+ Add Card</Text>
            </TouchableOpacity>
          }
          c={c}
        >
          {cards.length === 0 ? (
            <View style={[st.emptyBox, { borderColor: c.borderSubtle }]}>
              <Text style={[st.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>
                No program cards yet. Add your trainer program names as reference labels.
              </Text>
            </View>
          ) : (
            <View style={st.cardGrid}>
              {cards.map(card => (
                <View key={card.id} style={[st.progCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                  <TouchableOpacity onPress={() => handleDeleteCard(card.id)} style={st.cardDel}>
                    <Text style={{ color: c.textMuted, fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                  <Text style={[st.cardName, { color: c.textPrimary, fontFamily: MONO }]}>{card.name}</Text>
                  <Text style={[st.cardDate, { color: c.textMuted, fontFamily: MONO }]}>Added {card.addedAt}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* ── Log a Session ──────────────────────────────────────────────── */}
        <Section label="Log a Session" open={logOpen} onToggle={() => setLogOpen(v => !v)} c={c}>
          <View style={[st.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>

            <View style={st.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={[st.fLabel, { color: c.textMuted, fontFamily: MONO }]}>PROGRAM</Text>
                <PillSelect options={['P1','P2','P3','P4']} value={fProg} onChange={setFProg} c={c} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.fLabel, { color: c.textMuted, fontFamily: MONO }]}>DAY</Text>
                <PillSelect options={['Day 1','Day 2','Day 3']} value={fDay} onChange={setFDay} c={c} />
              </View>
            </View>

            <View style={[st.formRow, { marginTop: 10 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.fLabel, { color: c.textMuted, fontFamily: MONO }]}>WEEK</Text>
                <PillSelect options={['Week 1','Week 2','Week 3','Week 4']} value={fWeek} onChange={setFWeek} c={c} />
              </View>
              <View style={{ width: 80 }}>
                <Text style={[st.fLabel, { color: c.textMuted, fontFamily: MONO }]}>RPE (1-10)</Text>
                <TextInput
                  style={[st.fInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={fRPE} onChangeText={setFRPE}
                  placeholder="—" placeholderTextColor={c.textMuted} keyboardType="numeric"
                />
              </View>
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={[st.fLabel, { color: c.textMuted, fontFamily: MONO }]}>NOTES</Text>
              <TextInput
                style={[st.fInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                value={fNotes} onChangeText={setFNotes}
                placeholder="Anything notable..." placeholderTextColor={c.textMuted}
              />
            </View>

            <View style={st.formActions}>
              <TouchableOpacity onPress={handleLogSession}
                style={[st.logBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                <Text style={[st.logBtnTxt, { color: c.green, fontFamily: MONO }]}>+ Log Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* ── Session History ────────────────────────────────────────────── */}
        <Section label="Session History" open={histOpen} onToggle={() => setHistOpen(v => !v)} c={c}>
          {sessions.length === 0 ? (
            <View style={[st.emptyBox, { borderColor: c.borderSubtle }]}>
              <Text style={[st.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No sessions logged yet.</Text>
            </View>
          ) : (
            <View style={{ gap: 5 }}>
              {sessions.map(s => (
                <View key={s.id} style={[st.sessItem, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[st.sessMain, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>
                      {s.prog} — {s.day} {s.week}
                    </Text>
                    <Text style={[st.sessMeta, { color: c.textMuted, fontFamily: MONO }]}>
                      {new Date(s.date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}
                      {s.rpe   ? ` · RPE ${s.rpe}`  : ''}
                      {s.notes ? ` · ${s.notes}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteSession(s.id)}>
                    <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* ── Weight Tracker ─────────────────────────────────────────────── */}
        <Section label="Weight Tracker" open={weightOpen} onToggle={() => setWeightOpen(v => !v)} c={c}>

          {/* Metrics */}
          <View style={st.metGrid}>
            <MetCard label="Current"      value={currentW  != null ? fmtN(currentW) : '—'}  sub="lbs"         color={c.blue}  c={c} />
            <MetCard label="Starting"     value={startW    != null ? fmtN(startW)   : '—'}  sub="first logged"                c={c} />
            <MetCard
              label="Total Change"
              value={totalChange != null ? (totalChange >= 0 ? '+' : '') + fmtN(totalChange) + ' lbs' : '—'}
              sub={totalChange != null ? (totalChange < 0 ? 'lost' : totalChange > 0 ? 'gained' : 'no change') : ''}
              color={totalChange != null ? (totalChange < 0 ? c.green : totalChange > 0 ? c.amber : undefined) : undefined}
              c={c}
            />
            <MetCard
              label="Last Weigh-in"
              value={lastChange != null ? (lastChange >= 0 ? '+' : '') + fmtN(lastChange) + ' lbs' : '—'}
              sub={lastChange != null ? (lastChange < 0 ? '↓ from prev' : lastChange > 0 ? '↑ from prev' : 'same') : 'need 2+ entries'}
              color={lastChange != null ? (lastChange < 0 ? c.green : lastChange > 0 ? c.amber : undefined) : undefined}
              c={c}
            />
            <MetCard label="Lowest"  value={lowW    != null ? fmtN(lowW)   : '—'}  sub="all time"    color={c.green} c={c} />
            <MetCard label="Entries" value={String(weights.length)}                 sub="weigh-ins"                  c={c} />
          </View>

          {/* Chart */}
          {chartData.length >= 2 && <WeightChart data={chartData} c={c} />}

          {/* Log weight form */}
          <View style={[st.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <View style={[st.formRow, { flexWrap: 'wrap' }]}>
              <View style={{ width: 120 }}>
                <Text style={[st.fLabel, { color: c.textMuted, fontFamily: MONO }]}>WEIGHT (LBS)</Text>
                <TextInput
                  style={[st.fInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={fWeight} onChangeText={setFWeight}
                  placeholder="e.g. 185.5" placeholderTextColor={c.textMuted} keyboardType="decimal-pad"
                />
              </View>
              <View style={{ width: 130 }}>
                <Text style={[st.fLabel, { color: c.textMuted, fontFamily: MONO }]}>DATE</Text>
                <TouchableOpacity onPress={() => setDatePicker(true)}
                  style={[st.dateBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}>
                  <Text style={[st.dateTxt, { color: c.textPrimary, fontFamily: MONO }]}>{fmtDateKey(fWtDate)}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, minWidth: 110 }}>
                <Text style={[st.fLabel, { color: c.textMuted, fontFamily: MONO }]}>NOTE (OPTIONAL)</Text>
                <TextInput
                  style={[st.fInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={fWtNote} onChangeText={setFWtNote}
                  placeholder="e.g. morning..." placeholderTextColor={c.textMuted}
                />
              </View>
            </View>
            <View style={st.formActions}>
              <TouchableOpacity onPress={handleLogWeight}
                style={[st.logBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                <Text style={[st.logBtnTxt, { color: c.green, fontFamily: MONO }]}>+ Log Weight</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date picker */}
          {datePicker && Platform.OS === 'android' && (
            <DateTimePicker value={fWtDate} mode="date" display="default"
              onChange={(e, d) => { setDatePicker(false); if (d) setFWtDate(d); }} />
          )}
          {datePicker && Platform.OS === 'ios' && (
            <>
              <DateTimePicker value={fWtDate} mode="date" display="spinner"
                onChange={(e, d) => { if (d) setFWtDate(d); }} />
              <TouchableOpacity onPress={() => setDatePicker(false)} style={{ alignItems: 'flex-end', paddingRight: 4, paddingBottom: 8 }}>
                <Text style={{ color: c.blue, fontWeight: '600', fontFamily: MONO }}>Done</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Weight history */}
          {weights.length === 0 ? (
            <View style={[st.emptyBox, { borderColor: c.borderSubtle, marginTop: 8 }]}>
              <Text style={[st.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>
                No weigh-ins yet. Log your first weight above.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 5, marginTop: 8 }}>
              {sorted.map((w, i) => {
                const prev   = sorted[i + 1];
                const change = prev != null ? w.val - prev.val : null;
                const str    = change != null ? (change >= 0 ? '+' : '') + fmtN(change) + ' lbs' : '—';
                const dir    = change == null ? 'same' : change < 0 ? 'down' : change > 0 ? 'up' : 'same';
                const pillColor = dir === 'down' ? c.green : dir === 'up' ? c.red : c.textMuted;
                const pillBg    = dir === 'down' ? c.greenGlow : dir === 'up' ? c.redGlow : c.bgBase;
                return (
                  <View key={w.id} style={[st.weightItem, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.wiVal,  { color: c.textPrimary, fontFamily: MONO }]}>{fmtN(w.val)} lbs</Text>
                      <Text style={[st.wiDate, { color: c.textMuted,   fontFamily: MONO }]}>
                        {fmtDate(w.date)}{w.note ? ` · ${w.note}` : ''}
                      </Text>
                    </View>
                    <View style={[st.wiPill, { backgroundColor: pillBg, borderColor: pillColor }]}>
                      <Text style={[st.wiPillTxt, { color: pillColor, fontFamily: MONO }]}>{str}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteWeight(w.id)} style={{ paddingLeft: 8 }}>
                      <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

        </Section>

      </ScrollView>

      <AddCardModal visible={addCardModal} onClose={() => setAddCardModal(false)} onCreate={handleAddCard} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { padding: 14, paddingBottom: 60 },
  savedBadge: { position: 'absolute', bottom: 16, right: 16, zIndex: 99, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  savedText:  { fontSize: 11, fontWeight: '600' },

  prRow:   { flexDirection: 'row', gap: 6, marginBottom: 16 },
  prCard:  { flex: 1, borderWidth: 1, borderRadius: 10, padding: 11, alignItems: 'center' },
  prLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  prInput: { fontSize: 20, fontWeight: '700', textAlign: 'center', width: '100%', paddingVertical: 0 },
  prUnit:  { fontSize: 9, marginTop: 2 },

  smBtn:    { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  smBtnTxt: { fontSize: 10, fontWeight: '700' },

  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  progCard: { width: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 10, padding: 13, position: 'relative' },
  cardDel:  { position: 'absolute', top: 8, right: 10, padding: 2 },
  cardName: { fontSize: 12, fontWeight: '600', marginBottom: 4, marginRight: 18 },
  cardDate: { fontSize: 10 },

  card:        { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 4 },
  formRow:     { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  formActions: { alignItems: 'flex-end', marginTop: 12 },
  fLabel:      { fontSize: 9, fontWeight: '600', letterSpacing: 0.6, marginBottom: 4 },
  fInput:      { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12 },
  dateBtn:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  dateTxt:     { fontSize: 12 },
  logBtn:      { borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 16 },
  logBtnTxt:   { fontSize: 12, fontWeight: '700' },

  sessItem: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, padding: 9 },
  sessMain: { fontSize: 12, fontWeight: '600' },
  sessMeta: { fontSize: 10, marginTop: 1 },

  metGrid:    { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  weightItem: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 9 },
  wiVal:      { fontSize: 13, fontWeight: '700', marginBottom: 1 },
  wiDate:     { fontSize: 10 },
  wiPill:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginRight: 4 },
  wiPillTxt:  { fontSize: 10, fontWeight: '600' },

  emptyBox: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 22, alignItems: 'center', marginBottom: 4 },
  emptyTxt: { fontSize: 12 },
});
