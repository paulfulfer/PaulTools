import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../hooks/useHaptics';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });
const EQUIP_TYPES = ['driver', 'wood', 'hybrid', 'iron', 'wedge'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(str) {
  return new Date(str+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
}
function fmtShortDate(str) {
  return new Date(str+'T00:00:00').toLocaleDateString('en-US',{month:'numeric',day:'numeric'});
}

// ─── MetCard ─────────────────────────────────────────────────────────────────

function MetCard({ label, value, sub, color, c }) {
  return (
    <View style={[mc.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
      <Text style={[mc.label, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[mc.value, { color: color || c.textPrimary, fontFamily: MONO }]}>{value}</Text>
      {!!sub && <Text style={[mc.sub, { color: c.textMuted, fontFamily: MONO }]}>{sub}</Text>}
    </View>
  );
}
const mc = StyleSheet.create({
  card:  { flex: 1, minWidth: '44%', borderWidth: 1, borderRadius: 8, padding: 10, margin: 3 },
  label: { fontSize: 9, letterSpacing: 0.8, marginBottom: 3 },
  value: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  sub:   { fontSize: 9, marginTop: 2 },
});

// ─── SecHeader ────────────────────────────────────────────────────────────────

function SecHeader({ title, open, onToggle, c }) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.7}
      style={[sh.row, { borderBottomColor: c.borderSubtle }]}>
      <Text style={[sh.label, { color: c.textMuted, fontFamily: MONO }]}>{title.toUpperCase()}</Text>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>{open ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 10, marginTop: 16, marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
});

// ─── Dispersion Chart (pure View) ─────────────────────────────────────────────

function DispersionChart({ shots, parMargin, activeClub, c }) {
  const [w, setW] = useState(320);
  const cx        = w / 2;
  const maxYards  = parMargin ? Math.max(parMargin * 3, 30) : 40;
  const scale     = (w / 2 - 28) / maxYards;
  const marginPx  = parMargin ? Math.min(parMargin * scale, w / 2 - 10) : 0;
  const H         = 220;

  const isNoClub = !activeClub;
  const noShots  = activeClub && (!shots || shots.length === 0);
  const markers  = [5, 10, 15, 20, 25, 30].filter(y => y * scale < w / 2 - 14);

  return (
    <View style={{ width: '100%', height: H, borderRadius: 8, overflow: 'hidden', backgroundColor: c.bgBase2 }}
      onLayout={e => setW(e.nativeEvent.layout.width)}>

      {/* Green margin zone */}
      {!!parMargin && marginPx > 0 && (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: cx - marginPx, width: marginPx * 2, backgroundColor: c.greenGlow }} />
      )}

      {/* Margin boundary lines */}
      {!!parMargin && marginPx > 0 && (
        <>
          <View style={{ position: 'absolute', top: 0, bottom: 22, left: cx - marginPx - 1, width: 1.5, backgroundColor: c.green, opacity: 0.5 }} />
          <View style={{ position: 'absolute', top: 0, bottom: 22, left: cx + marginPx,     width: 1.5, backgroundColor: c.green, opacity: 0.5 }} />
          <Text style={{ position: 'absolute', top: 5, left: Math.max(2, cx - marginPx - 30), fontSize: 8, color: c.green, fontFamily: MONO }}>
            {parMargin.toFixed(1)}y
          </Text>
          <Text style={{ position: 'absolute', top: 5, left: Math.min(w - 28, cx + marginPx + 5), fontSize: 8, color: c.green, fontFamily: MONO }}>
            {parMargin.toFixed(1)}y
          </Text>
        </>
      )}

      {/* Center line */}
      <View style={{ position: 'absolute', top: 0, bottom: 22, left: cx, width: 1, backgroundColor: c.borderSubtle }} />

      {/* Yard markers */}
      {markers.map(y => (
        <React.Fragment key={y}>
          <Text style={{ position: 'absolute', bottom: 3, left: cx + y * scale - 12, width: 24, textAlign: 'center', fontSize: 8, color: c.textMuted, fontFamily: MONO }}>{y}y</Text>
          <Text style={{ position: 'absolute', bottom: 3, left: cx - y * scale - 12, width: 24, textAlign: 'center', fontSize: 8, color: c.textMuted, fontFamily: MONO }}>{y}y</Text>
        </React.Fragment>
      ))}

      {/* Shot dots */}
      {!isNoClub && !noShots && shots && shots.map((shot, i) => {
        const px       = Math.min(shot.lateral * scale, w / 2 - 10) * (shot.dir === 'L' ? -1 : 1);
        const inMargin = parMargin ? Math.abs(shot.lateral) <= parMargin : true;
        const y        = 18 + (i / Math.max(shots.length - 1, 1)) * (H - 56);
        return (
          <View key={i} style={{
            position: 'absolute', left: cx + px - 6, top: y - 6,
            width: 12, height: 12, borderRadius: 6,
            backgroundColor: inMargin ? c.green : c.red,
            opacity: 0.88, alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 7, fontWeight: '700', color: c.bgCard }}>{i + 1}</Text>
          </View>
        );
      })}

      {/* Empty state */}
      {(isNoClub || noShots) && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.textMuted, fontSize: 12, fontFamily: MONO }}>
            {isNoClub ? 'Select a club to view dispersion' : 'No sessions logged for this club yet'}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Default shot entries ─────────────────────────────────────────────────────

const makeShots = (n = 10) => Array(n).fill(null).map(() => ({ lateral: '', dir: 'R' }));

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MarginTrackerScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const { triggerHaptic } = useHaptics();
  const c = theme.colors;

  // ── Data ──────────────────────────────────────────────────────────────────
  const [sessions,     setSessions]     = useState([]);
  const [equipment,    setEquipment]    = useState({});
  const [distSessions, setDistSessions] = useState([]);
  const [idC,          setIdC]          = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [saved,        setSaved]        = useState(false);

  const [activeClub, setActiveClub] = useState(null);

  // ── Log form ──────────────────────────────────────────────────────────────
  const [fClub,         setFClub]         = useState('');
  const [fDate,         setFDate]         = useState(new Date());
  const [fCarry,        setFCarry]        = useState('');
  const [shots,         setShots]         = useState(makeShots);
  const [showDatePicker,setShowDatePicker]= useState(false);

  // ── Section open ──────────────────────────────────────────────────────────
  const [logOpen,     setLogOpen]     = useState(true);
  const [trendOpen,   setTrendOpen]   = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const sessRef = useRef(sessions);
  const idCRef  = useRef(idC);
  const userRef = useRef(user);
  useEffect(() => { sessRef.current = sessions; }, [sessions]);
  useEffect(() => { idCRef.current  = idC;      }, [idC]);
  useEffect(() => { userRef.current = user;     }, [user]);

  // ── Firestore ─────────────────────────────────────────────────────────────

  const docRef = () => {
    const uid = userRef.current?.uid;
    if (!uid) return null;
    return firebase.firestore().collection('users').doc(uid).collection('localStorage').doc('data');
  };

  const writeAll = async (sess, id) => {
    const ref = docRef();
    if (!ref) return;
    await ref.set({ margin_sessions: JSON.stringify(sess), margin_id: String(id) }, { merge: true });
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
      setSessions(JSON.parse(d.margin_sessions || '[]'));
      setEquipment(JSON.parse(d.golf_equipment  || '{}'));
      setDistSessions(JSON.parse(d.dist_sessions || '[]'));
      setIdC(parseInt(d.margin_id || '1', 10));
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  // ── Club & carry helpers ──────────────────────────────────────────────────

  const getAllClubs = () => {
    const clubs = [];
    EQUIP_TYPES.forEach(type => {
      (equipment[type] || []).forEach(club => {
        const name = [club.make, club.model].filter(Boolean).join(' ').trim() || 'Unnamed';
        if (!clubs.find(x => x.name === name)) clubs.push({ name, type, loft: club.loft || '' });
      });
    });
    [...new Set([...distSessions.map(s => s.club), ...sessions.map(s => s.club)])].forEach(name => {
      if (name && !clubs.find(x => x.name === name)) clubs.push({ name, type: 'other', loft: '' });
    });
    return clubs;
  };

  const getCarry = (clubName) => {
    const cs = distSessions.filter(s => s.club === clubName && s.carry > 0);
    return cs.length > 0 ? cs.reduce((a, s) => a + s.carry, 0) / cs.length : null;
  };

  const getParMargin = (clubName) => {
    const carry = getCarry(clubName);
    return carry ? carry * 0.10 : null;
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const allClubs = getAllClubs();
  const pm       = activeClub ? getParMargin(activeClub) : null;
  const carry    = activeClub ? getCarry(activeClub)     : null;

  const latestSession = activeClub
    ? [...sessions].filter(s => s.club === activeClub).sort((a, b) => new Date(b.date) - new Date(a.date))[0] ?? null
    : null;
  const latestShots = latestSession?.shots ?? [];

  const inCount   = pm ? latestShots.filter(s => Math.abs(s.lateral) <= pm).length : 0;
  const inPct     = pm && latestShots.length > 0 ? Math.round(inCount / latestShots.length * 100) : null;
  const lefts     = latestShots.filter(s => s.dir === 'L');
  const rights    = latestShots.filter(s => s.dir === 'R');
  const avgLeft   = lefts.length  > 0 ? lefts.reduce((a, s) => a + s.lateral, 0) / lefts.length   : null;
  const avgRight  = rights.length > 0 ? rights.reduce((a, s) => a + s.lateral, 0) / rights.length : null;
  const allLat    = latestShots.map(s => s.lateral);
  const avgSpread = allLat.length > 0 ? allLat.reduce((a, b) => a + b, 0) / allLat.length : null;

  const trendSessions = sessions
    .filter(s => s.club === activeClub && s.shots && s.shots.length > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-10);

  const histFiltered = (activeClub ? sessions.filter(s => s.club === activeClub) : sessions)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Trend note
  let trendNote = activeClub
    ? (trendSessions.length < 2 ? 'Log 2+ sessions to see trend.' : null)
    : 'Select a club and log sessions to see trend.';
  if (!trendNote && trendSessions.length >= 2 && pm) {
    const last  = trendSessions[trendSessions.length - 1];
    const first = trendSessions[0];
    const pL = Math.round(last.shots.filter(x => Math.abs(x.lateral) <= pm).length / last.shots.length * 100);
    const pF = Math.round(first.shots.filter(x => Math.abs(x.lateral) <= pm).length / first.shots.length * 100);
    const d  = pL - pF;
    trendNote = d > 0
      ? `↑ Improving — up ${d}% over last ${trendSessions.length} sessions`
      : d < 0
      ? `↓ Declining — down ${Math.abs(d)}% over last ${trendSessions.length} sessions`
      : `Consistent over last ${trendSessions.length} sessions`;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  // ── CSV Import ────────────────────────────────────────────────────────────

  const handleCSVImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;

      const text    = await (await fetch(result.assets[0].uri)).text();
      const lines   = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return Alert.alert('Import Error', 'CSV appears to be empty.');

      const headers    = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const lateralIdx = headers.findIndex(h => h.includes('lateral'));
      const carryIdx   = headers.findIndex(h => h.includes('carry'));

      if (lateralIdx === -1) {
        return Alert.alert('Import Error', 'Could not find a "Lateral" column. Please check the file format.');
      }

      const parsed = [];
      let totalCarry = 0, carryCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(col => col.trim().replace(/"/g, ''));
        const raw  = cols[lateralIdx];
        if (!raw) continue;
        const numStr = raw.replace(/[LRlr]/g, '').trim();
        const val    = parseFloat(numStr);
        if (isNaN(val)) continue;
        const dir = raw.toUpperCase().includes('L') || val < 0 ? 'L' : 'R';
        parsed.push({ lateral: String(Math.abs(val)), dir });
        if (carryIdx > -1) {
          const cv = parseFloat(cols[carryIdx]);
          if (!isNaN(cv) && cv > 0) { totalCarry += cv; carryCount++; }
        }
      }

      if (parsed.length === 0) {
        return Alert.alert('Import Error', 'No valid shot data found in the CSV.');
      }

      setShots(parsed);
      if (carryCount > 0) setFCarry((totalCarry / carryCount).toFixed(1));
      Alert.alert('Imported', `${parsed.length} shots imported from Flightscope CSV.`);
    } catch (err) {
      Alert.alert('Import Error', err.message);
    }
  };

  const updateShot = (i, field, val) =>
    setShots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

  const addShot    = () => setShots(prev => [...prev, { lateral: '', dir: 'R' }]);
  const removeShot = () => setShots(prev => prev.length > 1 ? prev.slice(0, -1) : prev);

  const saveSession = async () => {
    triggerHaptic();
    if (!fClub) return Alert.alert('Required', 'Select a club.');
    const valid = shots
      .filter(s => parseFloat(s.lateral) > 0)
      .map(s => ({ lateral: parseFloat(s.lateral), dir: s.dir }));
    if (valid.length === 0) return Alert.alert('Required', 'Enter at least one shot.');

    const carryVal = parseFloat(fCarry) || getCarry(fClub) || null;
    const id = 's' + idCRef.current;
    const newId = idCRef.current + 1;

    const session = { id, club: fClub, date: fmtDateKey(fDate), shots: valid, carry: carryVal };
    const newSessions = [session, ...sessRef.current];

    setSessions(newSessions);
    setIdC(newId);
    if (!activeClub) setActiveClub(fClub);
    setShots(makeShots());
    setFCarry('');
    try {
      await writeAll(newSessions, newId);
      Alert.alert('Session saved!');
    } catch (err) { Alert.alert('Save error', err.message); }
  };

  const loadSessionToForm = (id) => {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    setFClub(s.club);
    if (s.date) setFDate(new Date(s.date + 'T00:00:00'));
    setFCarry(s.carry ? String(s.carry) : '');
    setShots(s.shots ? s.shots.map(x => ({ lateral: String(x.lateral), dir: x.dir })) : []);
    setLogOpen(true);
  };

  const deleteSession = (id) => {
    Alert.alert('Delete session?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const updated = sessRef.current.filter(s => s.id !== id);
        setSessions(updated);
        try { await writeAll(updated, idCRef.current); }
        catch (err) { Alert.alert('Save error', err.message); }
      }},
    ]);
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={[st.centered]}><ActivityIndicator color={c.green} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {saved && (
        <View style={[st.savedBadge, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
          <Text style={[st.savedText, { color: c.green, fontFamily: MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Club Tabs ──────────────────────────────────────────────── */}
        {allClubs.length === 0 ? (
          <Text style={[st.noClubsTxt, { color: c.textMuted, fontFamily: MONO }]}>
            No clubs found. Add clubs on the Equipment page or log Club Distances sessions.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}
            contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
            {allClubs.map(club => {
              const label  = club.name + (club.loft ? ' ' + club.loft + '°' : '');
              const active = activeClub === club.name;
              return (
                <TouchableOpacity key={club.name} onPress={() => setActiveClub(club.name)}
                  style={[st.clubTab, { borderColor: active ? c.green : c.borderSubtle, backgroundColor: active ? c.greenGlow : c.bgCard }]}>
                  <Text style={[st.clubTabTxt, { color: active ? c.green : c.textMuted, fontFamily: MONO }]}>
                    {label.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Dispersion Chart ───────────────────────────────────────── */}
        <View style={[st.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
          <View style={st.dispHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[st.dispTitle, { color: c.textPrimary, fontFamily: MONO }]}>
                {activeClub ? `${activeClub} — Latest Session` : 'Select a club to view dispersion'}
              </Text>
              <Text style={[st.dispSub, { color: c.textMuted, fontFamily: MONO }]}>Top-down view · target line vertical</Text>
            </View>
            {pm != null && (
              <View style={[st.pill, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                <Text style={[st.pillTxt, { color: c.green, fontFamily: MONO }]}>Par margin active</Text>
              </View>
            )}
          </View>

          <DispersionChart shots={latestShots} parMargin={pm} activeClub={activeClub} c={c} />

          {/* Margin info blocks */}
          {carry != null && pm != null ? (
            <View style={st.miRow}>
              {[
                { label: 'Avg Carry',      value: carry.toFixed(0) + ' yds',    color: c.blue  },
                { label: 'Par Margin (±)', value: pm.toFixed(1) + ' yds',       color: c.green },
                { label: 'Total Window',   value: (pm * 2).toFixed(1) + ' yds', color: c.green },
                { label: 'Benchmark',      value: '10% carry' },
              ].map(mi => (
                <View key={mi.label} style={[st.miBlock, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
                  <Text style={[st.miLabel, { color: c.textMuted, fontFamily: MONO }]}>{mi.label.toUpperCase()}</Text>
                  <Text style={[st.miVal, { color: mi.color || c.textPrimary, fontFamily: MONO }]}>{mi.value}</Text>
                </View>
              ))}
            </View>
          ) : activeClub ? (
            <Text style={[st.noCarryTxt, { color: c.textMuted, fontFamily: MONO }]}>
              No carry data for {activeClub}. Log sessions on Club Distances to set par margin.
            </Text>
          ) : null}
        </View>

        {/* ── Stats Metrics ──────────────────────────────────────────── */}
        <View style={st.metRow}>
          <MetCard
            label="In Margin" sub="this session"
            value={inPct != null ? inPct + '%' : '—'}
            color={inPct != null ? (inPct >= 80 ? c.green : inPct >= 60 ? c.amber : c.red) : undefined}
            c={c}
          />
          <MetCard label="Avg Miss L"  sub="yards left"      value={avgLeft   != null ? avgLeft.toFixed(1)+'y'   : '—'} color={c.blue}  c={c} />
          <MetCard label="Avg Miss R"  sub="yards right"     value={avgRight  != null ? avgRight.toFixed(1)+'y'  : '—'} color={c.amber} c={c} />
          <MetCard label="Avg Spread"  sub="avg dispersion"  value={avgSpread != null ? avgSpread.toFixed(1)+'y' : '—'} c={c} />
          <MetCard label="Par Margin"  sub="10% of carry"    value={pm        != null ? '±'+pm.toFixed(1)+'y'   : 'No carry data'} color={pm ? c.green : undefined} c={c} />
        </View>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* LOG A SESSION                                              */}
        {/* ══════════════════════════════════════════════════════════ */}
        <SecHeader title="Log a Session" open={logOpen} onToggle={() => setLogOpen(v => !v)} c={c} />
        {logOpen && (
          <View style={[st.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>

            {/* Session header with import button */}
            <View style={st.sessionHeader}>
              <Text style={[st.sessionTitle, { color: c.textPrimary, fontFamily: MONO }]}>Session Details</Text>
              <TouchableOpacity onPress={handleCSVImport}
                style={[st.importBtn, { borderColor: c.teal, backgroundColor: c.tealGlow }]}>
                <Text style={[st.importBtnTxt, { color: c.teal, fontFamily: MONO }]}>⬆ Import Flightscope CSV</Text>
              </TouchableOpacity>
            </View>

            {/* Club + Date */}
            <View style={st.formRow}>
              <View style={{ flex: 2 }}>
                <Text style={[st.fLabel, { color: c.textMuted, fontFamily: MONO }]}>CLUB</Text>
                <View style={[st.pickerBox, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}>
                  <Picker selectedValue={fClub} onValueChange={setFClub}
                    style={{ color: c.textPrimary }} dropdownIconColor={c.textMuted}
                    itemStyle={{ fontSize: 13, color: c.textPrimary, fontFamily: MONO }}>
                    <Picker.Item label="Select club..." value="" color={c.textMuted} />
                    {allClubs.map(club => (
                      <Picker.Item
                        key={club.name}
                        label={club.name + (club.loft ? ' ' + club.loft + '°' : '')}
                        value={club.name}
                        color={c.textPrimary}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.fLabel, { color: c.textMuted, fontFamily: MONO }]}>DATE</Text>
                <TouchableOpacity style={[st.dateBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                  onPress={() => setShowDatePicker(true)}>
                  <Text style={[st.dateTxt, { color: c.textPrimary, fontFamily: MONO }]}>
                    {fDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Carry override */}
            <View style={{ marginBottom: 12 }}>
              <Text style={[st.fLabel, { color: c.textMuted, fontFamily: MONO }]}>CARRY OVERRIDE (YDS, OPTIONAL)</Text>
              <TextInput
                style={[st.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO, width: 160 }]}
                value={fCarry} onChangeText={setFCarry}
                placeholder="Auto from log" placeholderTextColor={c.textMuted} keyboardType="decimal-pad"
              />
            </View>

            {/* Shot grid */}
            <Text style={[st.shotGridTitle, { color: c.textMuted, fontFamily: MONO }]}>
              SHOT LATERAL DISPERSION (YDS — L OR R)
            </Text>
            <View style={st.shotGrid}>
              {shots.map((shot, i) => (
                <View key={i} style={[st.shotEntry, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
                  <Text style={[st.shotNum, { color: c.textMuted, fontFamily: MONO }]}>SHOT {i + 1}</Text>
                  <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                    <TextInput
                      style={[st.shotInput, { borderColor: c.borderSubtle, backgroundColor: c.bgCard, color: c.textPrimary, fontFamily: MONO }]}
                      value={shot.lateral}
                      onChangeText={v => updateShot(i, 'lateral', v)}
                      keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={c.textMuted}
                    />
                    {['L', 'R'].map(dir => (
                      <TouchableOpacity key={dir} onPress={() => updateShot(i, 'dir', dir)}
                        style={[st.dirBtn, {
                          borderColor:     shot.dir === dir ? (dir === 'L' ? c.blue : c.amber) : c.borderSubtle,
                          backgroundColor: shot.dir === dir ? (dir === 'L' ? c.blueGlow : c.amberGlow) : 'transparent',
                        }]}>
                        <Text style={[st.dirBtnTxt, { color: shot.dir === dir ? (dir === 'L' ? c.blue : c.amber) : c.textMuted, fontFamily: MONO }]}>
                          {dir}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity onPress={addShot}    style={[st.smBtn, { borderColor: c.borderSubtle }]}>
                <Text style={[st.smBtnTxt, { color: c.textSecondary, fontFamily: MONO }]}>+ Shot</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={removeShot} style={[st.smBtn, { borderColor: c.borderSubtle }]}>
                <Text style={[st.smBtnTxt, { color: c.textSecondary, fontFamily: MONO }]}>− Shot</Text>
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <TouchableOpacity onPress={saveSession}
                style={[st.actionBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                <Text style={[st.actionBtnTxt, { color: c.green, fontFamily: MONO }]}>Save Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker value={fDate} mode="date" display="default"
            onChange={(e, d) => { setShowDatePicker(false); if (d) setFDate(d); }} />
        )}
        {showDatePicker && Platform.OS === 'ios' && (
          <>
            <DateTimePicker value={fDate} mode="date" display="spinner"
              onChange={(e, d) => { if (d) setFDate(d); }} />
            <TouchableOpacity onPress={() => setShowDatePicker(false)}
              style={{ alignItems: 'flex-end', paddingRight: 4, paddingBottom: 6 }}>
              <Text style={{ color: c.blue, fontWeight: '600', fontFamily: MONO }}>Done</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* DISPERSION TREND                                           */}
        {/* ══════════════════════════════════════════════════════════ */}
        <SecHeader title="Dispersion Trend" open={trendOpen} onToggle={() => setTrendOpen(v => !v)} c={c} />
        {trendOpen && (
          <View style={[st.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <Text style={[st.trendNote, { color: c.textMuted, fontFamily: MONO }]}>
              % of shots inside par margin — last 10 sessions for selected club
            </Text>
            {trendSessions.length >= 2 && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90, marginBottom: 6 }}>
                {trendSessions.map(s => {
                  const inM = pm ? s.shots.filter(x => Math.abs(x.lateral) <= pm).length : s.shots.length;
                  const pct = Math.round(inM / s.shots.length * 100);
                  const h   = Math.max(4, (pct / 100) * 72);
                  const col = pct >= 80 ? c.green : pct >= 60 ? c.amber : c.red;
                  return (
                    <View key={s.id} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2, height: 90 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: col, fontFamily: MONO }}>{pct}%</Text>
                      <View style={{ width: '100%', height: h, backgroundColor: col, borderRadius: 3 }} />
                      <Text style={{ fontSize: 8, color: c.textMuted, fontFamily: MONO }}>{fmtShortDate(s.date)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            {trendNote && (
              <Text style={[st.trendNote, { color: c.textMuted, fontFamily: MONO }]}>{trendNote}</Text>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SESSION HISTORY                                            */}
        {/* ══════════════════════════════════════════════════════════ */}
        <SecHeader title={`Session History (${histFiltered.length})`} open={historyOpen} onToggle={() => setHistoryOpen(v => !v)} c={c} />
        {historyOpen && (
          histFiltered.length === 0 ? (
            <View style={[st.emptyBox, { borderColor: c.borderSubtle }]}>
              <Text style={[st.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No sessions logged yet.</Text>
            </View>
          ) : (
            histFiltered.map(s => {
              const sPm     = getParMargin(s.club);
              const inMarg  = sPm && s.shots ? s.shots.filter(x => Math.abs(x.lateral) <= sPm).length : null;
              const sPct    = inMarg != null && s.shots.length > 0 ? Math.round(inMarg / s.shots.length * 100) : null;
              const pctCol  = sPct != null ? (sPct >= 80 ? c.green : sPct >= 60 ? c.amber : c.red) : c.textMuted;
              return (
                <TouchableOpacity key={s.id} onPress={() => loadSessionToForm(s.id)} activeOpacity={0.7}
                  style={[st.histItem, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[st.histClub, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>{s.club}</Text>
                    <Text style={[st.histMeta, { color: c.textMuted, fontFamily: MONO }]}>
                      {fmtDate(s.date)} · {s.shots ? s.shots.length : 0} shots{s.carry ? ` · ${s.carry}y carry` : ''}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {sPct != null && (
                      <Text style={[st.histPct, { color: pctCol, fontFamily: MONO }]}>{sPct}%</Text>
                    )}
                    <TouchableOpacity onPress={() => deleteSession(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { padding: 14, paddingBottom: 60 },
  savedBadge: { position: 'absolute', bottom: 16, right: 16, zIndex: 99, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  savedText:  { fontSize: 11, fontWeight: '600' },

  noClubsTxt: { fontSize: 11, fontStyle: 'italic', marginBottom: 14 },
  clubTab:    { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  clubTabTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  card:       { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10 },
  dispHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  dispTitle:  { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  dispSub:    { fontSize: 11 },
  pill:       { borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  pillTxt:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  miRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  miBlock:    { flex: 1, minWidth: '44%', borderWidth: 1, borderRadius: 8, padding: 8 },
  miLabel:    { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginBottom: 2 },
  miVal:      { fontSize: 15, fontWeight: '700' },
  noCarryTxt: { fontSize: 11, fontStyle: 'italic', marginTop: 8 },

  metRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },

  sessionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sessionTitle:  { fontSize: 13, fontWeight: '600' },
  importBtn:     { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  importBtnTxt:  { fontSize: 11, fontWeight: '600' },

  formRow:   { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  fLabel:    { fontSize: 9, fontWeight: '600', letterSpacing: 0.6, marginBottom: 4 },
  pickerBox: { borderWidth: 1, borderRadius: 6, overflow: 'hidden' },
  input:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12 },
  dateBtn:   { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  dateTxt:   { fontSize: 12 },

  shotGridTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  shotGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  shotEntry:     { width: '47%', borderWidth: 1, borderRadius: 8, padding: 8 },
  shotNum:       { fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginBottom: 5 },
  shotInput:     { flex: 1, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  dirBtn:        { width: 26, height: 26, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dirBtnTxt:     { fontSize: 10, fontWeight: '700' },

  smBtn:        { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  smBtnTxt:     { fontSize: 12, fontWeight: '600' },
  actionBtn:    { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 18 },
  actionBtnTxt: { fontSize: 12, fontWeight: '600' },

  trendNote: { fontSize: 11, marginBottom: 4 },

  histItem:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 5, gap: 10 },
  histClub:  { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  histMeta:  { fontSize: 10 },
  histPct:   { fontSize: 13, fontWeight: '700' },

  emptyBox:  { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 24, alignItems: 'center', marginBottom: 8 },
  emptyTxt:  { fontSize: 12 },
});
