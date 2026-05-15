import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, Modal, KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// ─── Constants & helpers ──────────────────────────────────────────────────────

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

function scoreCol(score, par, c) {
  if (!score || !par) return c.amber;
  const d = score - par;
  if (d <= 2)  return c.green;
  if (d <= 8)  return c.blue;
  if (d <= 15) return c.amber;
  return c.red;
}
function scoreColBg(score, par, c) {
  if (!score || !par) return c.amberGlow;
  const d = score - par;
  if (d <= 2)  return c.greenGlow;
  if (d <= 8)  return c.blueGlow;
  if (d <= 15) return c.amberGlow;
  return c.redGlow;
}
function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(dateStr, long = false) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return long
    ? d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })
    : d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SecHeader({ title, open, onToggle, c }) {
  return (
    <TouchableOpacity style={[sh.row, { borderBottomColor:c.borderSubtle }]} onPress={onToggle} activeOpacity={0.7}>
      <Text style={[sh.label, { color:c.textMuted, fontFamily:MONO }]}>{title.toUpperCase()}</Text>
      <Text style={{ color:c.textMuted, fontSize:10 }}>{open ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth:1, paddingVertical:10, marginTop:18, marginBottom:8 },
  label: { fontSize:10, fontWeight:'600', letterSpacing:1 },
});

function MetCard({ label, value, sub, color, fontSize, c }) {
  return (
    <View style={[mc.card, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
      <Text style={[mc.label, { color:c.textMuted, fontFamily:MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[mc.value, { color:color||c.textPrimary, fontFamily:MONO, fontSize:fontSize||18 }]}>{value}</Text>
      {!!sub && <Text style={[mc.sub, { color:c.textMuted, fontFamily:MONO }]}>{sub}</Text>}
    </View>
  );
}
const mc = StyleSheet.create({
  card:  { flex:1, minWidth:'45%', borderWidth:1, borderRadius:8, padding:10, margin:3 },
  label: { fontSize:9, letterSpacing:0.8, marginBottom:3 },
  value: { fontWeight:'600', letterSpacing:-0.3 },
  sub:   { fontSize:9, marginTop:2 },
});

function FLabel({ label, c }) {
  return <Text style={{ fontSize:9, fontWeight:'600', letterSpacing:0.8, marginBottom:3, marginTop:10, color:c.textMuted, fontFamily:MONO }}>{label.toUpperCase()}</Text>;
}

// ─── GIR toggle (cycles null → true → false → null) ──────────────────────────

function GirToggle({ value, onChange, c }) {
  const next = value === null ? true : value === true ? false : null;
  return (
    <TouchableOpacity onPress={() => onChange(next)}
      style={[gt.btn, {
        borderColor:      value === true ? c.green : value === false ? c.red : c.borderSubtle,
        backgroundColor:  value === true ? c.greenGlow : value === false ? c.redGlow : c.bgBase,
      }]}>
      <Text style={{ color: value === true ? c.green : value === false ? c.red : c.textMuted, fontFamily:MONO, fontSize:10, fontWeight:'600' }}>
        {value === true ? 'GIR ✓' : value === false ? 'GIR ✗' : 'GIR?'}
      </Text>
    </TouchableOpacity>
  );
}
const gt = StyleSheet.create({
  btn: { borderWidth:1, borderRadius:6, paddingHorizontal:6, paddingVertical:5, alignItems:'center', justifyContent:'center' },
});

// ─── Round bubble (list item) ─────────────────────────────────────────────────

function RoundBubble({ round, onPress, c }) {
  const col   = scoreCol(round.score, round.par, c);
  const colBg = scoreColBg(round.score, round.par, c);
  const firStr   = round.firHit != null && round.firTotal > 0 ? `${round.firHit}/${round.firTotal} FIR` : null;
  const girStr   = round.gir   != null ? `${round.gir}/18 GIR` : null;
  const puttStr  = round.putts  > 0    ? `${round.putts} putts` : null;
  const stats = [firStr, girStr, puttStr].filter(Boolean);

  return (
    <TouchableOpacity style={[rb.bubble, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]} onPress={onPress} activeOpacity={0.75}>
      <View style={[rb.badge, { backgroundColor:colBg, borderColor:col }]}>
        <Text style={[rb.badgeTxt, { color:col, fontFamily:MONO }]}>{round.score || '—'}</Text>
      </View>
      <View style={{ flex:1 }}>
        <Text style={[rb.course, { color:c.textPrimary, fontFamily:MONO }]} numberOfLines={1}>{round.course || 'Unknown Course'}</Text>
        <Text style={[rb.date, { color:c.textMuted, fontFamily:MONO }]}>
          {fmtDate(round.date)}{round.par ? ` · Par ${round.par}` : ''}
        </Text>
        {stats.length > 0 && (
          <View style={rb.statsRow}>
            {stats.map(s => (
              <Text key={s} style={[rb.stat, { color:c.textMuted, fontFamily:MONO }]}>{s}</Text>
            ))}
          </View>
        )}
      </View>
      <Text style={{ color:c.textMuted, fontSize:14 }}>›</Text>
    </TouchableOpacity>
  );
}
const rb = StyleSheet.create({
  bubble:   { flexDirection:'row', alignItems:'center', gap:12, borderWidth:1, borderRadius:50, paddingHorizontal:14, paddingVertical:10, marginBottom:6 },
  badge:    { width:46, height:46, borderRadius:23, borderWidth:2, alignItems:'center', justifyContent:'center', flexShrink:0 },
  badgeTxt: { fontSize:15, fontWeight:'700' },
  course:   { fontSize:12, fontWeight:'600', marginBottom:1 },
  date:     { fontSize:10, marginBottom:2 },
  statsRow: { flexDirection:'row', gap:8, flexWrap:'wrap' },
  stat:     { fontSize:10 },
});

// ─── Par3 form row ────────────────────────────────────────────────────────────

function Par3FormRow({ par3, index, onChange, onRemove, c }) {
  return (
    <View style={[p3.row, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]}>
      <Text style={[p3.num, { color:c.textMuted, fontFamily:MONO }]}>H{index+1}</Text>
      <TextInput style={[p3.club, { borderColor:c.borderSubtle, backgroundColor:c.bgCard, color:c.textPrimary, fontFamily:MONO }]}
        value={par3.club} onChangeText={v => onChange(index, 'club', v)} placeholder="Club" placeholderTextColor={c.textMuted} />
      <TextInput style={[p3.num2, { borderColor:c.borderSubtle, backgroundColor:c.bgCard, color:c.textPrimary, fontFamily:MONO }]}
        value={par3.dist ? String(par3.dist) : ''} onChangeText={v => onChange(index, 'dist', parseInt(v)||0)}
        placeholder="Yds" placeholderTextColor={c.textMuted} keyboardType="number-pad" />
      <TextInput style={[p3.num2, { borderColor:c.borderSubtle, backgroundColor:c.bgCard, color:c.textPrimary, fontFamily:MONO }]}
        value={par3.score ? String(par3.score) : ''} onChangeText={v => onChange(index, 'score', parseInt(v)||0)}
        placeholder="Scr" placeholderTextColor={c.textMuted} keyboardType="number-pad" />
      <GirToggle value={par3.gir} onChange={v => onChange(index, 'gir', v)} c={c} />
      <TouchableOpacity onPress={() => onRemove(index)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
        <Text style={{ color:c.textMuted, fontSize:14 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}
const p3 = StyleSheet.create({
  row:  { flexDirection:'row', alignItems:'center', gap:5, borderWidth:1, borderRadius:8, padding:8, marginBottom:5 },
  num:  { fontSize:11, fontWeight:'600', width:24 },
  club: { flex:1, fontSize:11, borderWidth:1, borderRadius:5, paddingHorizontal:6, paddingVertical:4 },
  num2: { width:40, fontSize:11, borderWidth:1, borderRadius:5, paddingHorizontal:5, paddingVertical:4, textAlign:'center' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  course:'', par:'72', score:'', firHit:'', firTotal:'', gir:'',
  putts:'', threePutts:'', notes:'', par3s:[]
};

export default function RoundTrackerScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;

  // ── Data ────────────────────────────────────────────────
  const [rounds,    setRounds]    = useState([]);
  const [idCounter, setIdCounter] = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [saved,     setSaved]     = useState(false);

  // ── UI ──────────────────────────────────────────────────
  const [open, setOpen] = useState({ stats:true, rounds:true });
  const toggle = key => setOpen(p => ({ ...p, [key]:!p[key] }));

  // ── Modal ───────────────────────────────────────────────
  // mode: null | 'add' | 'edit' | 'detail'
  const [modalMode,    setModalMode]    = useState(null);
  const [editingRound, setEditingRound] = useState(null);
  const [detailRound,  setDetailRound]  = useState(null);

  // ── Form state ──────────────────────────────────────────
  const [form, setForm] = useState(EMPTY_FORM);
  const setF = (key, val) => setForm(p => ({ ...p, [key]:val }));

  // Par3 list helpers
  const addPar3    = () => setF('par3s', [...form.par3s, { club:'', dist:0, score:0, gir:null }]);
  const removePar3 = i  => setF('par3s', form.par3s.filter((_,j)=>j!==i));
  const updatePar3 = (i, key, val) => {
    const updated = form.par3s.map((p,j) => j===i ? {...p,[key]:val} : p);
    setF('par3s', updated);
  };

  // ── Date picker ─────────────────────────────────────────
  const [formDate,      setFormDate]      = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const onDateChange = (event, selected) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (!selected || event.type === 'dismissed') return;
    setFormDate(selected);
  };

  // ── Firestore ────────────────────────────────────────────
  const docRef = () =>
    firebase.firestore().collection('users').doc(user.uid).collection('localStorage').doc('data');

  const flash = () => { setSaved(true); setTimeout(()=>setSaved(false), 1500); };

  const persist = async (updRounds, updCounter) => {
    try {
      await docRef().set({
        golf_rounds: JSON.stringify(updRounds),
        golf_rounds_id: String(updCounter),
      }, { merge:true });
      flash();
    } catch (err) { Alert.alert('Save error', err.message); }
  };

  // ── Load ────────────────────────────────────────────────
  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await docRef().get();
      const d = snap.exists ? snap.data() : {};
      setRounds(JSON.parse(d.golf_rounds || '[]'));
      setIdCounter(parseInt(d.golf_rounds_id || '1'));
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  // ── Computed stats ───────────────────────────────────────
  const sorted = useMemo(() => [...rounds].sort((a,b) => new Date(b.date)-new Date(a.date)), [rounds]);

  const stats = useMemo(() => {
    if (!rounds.length) return null;
    const scores = rounds.map(r=>r.score).filter(s=>s>0);
    const avg = scores.reduce((a,b)=>a+b,0) / scores.length;
    const best = Math.min(...scores);
    const worst = Math.max(...scores);

    const firRnds = rounds.filter(r=>r.firHit!=null&&r.firTotal>0);
    const firAvg  = firRnds.length ? firRnds.reduce((s,r)=>s+(r.firHit/r.firTotal),0)/firRnds.length*100 : null;
    const girRnds = rounds.filter(r=>r.gir!=null);
    const girAvg  = girRnds.length ? girRnds.reduce((s,r)=>s+(r.gir/18),0)/girRnds.length*100 : null;
    const pRnds   = rounds.filter(r=>r.putts>0);
    const pAvg    = pRnds.length ? pRnds.reduce((s,r)=>s+r.putts,0)/pRnds.length : null;
    const tpRnds  = rounds.filter(r=>r.threePutts!=null);
    const tpAvg   = tpRnds.length ? tpRnds.reduce((s,r)=>s+r.threePutts,0)/tpRnds.length : null;

    const allP3s = rounds.flatMap(r=>r.par3s||[]);
    const p3Scores = allP3s.filter(p=>p.score>0);
    const p3ScoreAvg = p3Scores.length ? p3Scores.reduce((s,p)=>s+p.score,0)/p3Scores.length : null;
    const p3GirN = allP3s.filter(p=>p.gir!=null);
    const p3GirPct = p3GirN.length ? allP3s.filter(p=>p.gir===true).length/p3GirN.length*100 : null;
    const clubs = {}; allP3s.filter(p=>p.club).forEach(p=>{ clubs[p.club]=(clubs[p.club]||0)+1; });
    const topClub = Object.entries(clubs).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
    const p3Great = allP3s.filter(p=>p.score>0&&p.score<=2).length;

    const samplePar = rounds.find(r=>r.par)?.par || 72;
    const last10 = sorted.slice(0,10).reverse();

    // Course breakdown
    const courseMap = {};
    rounds.forEach(r => {
      if (!r.course) return;
      if (!courseMap[r.course]) courseMap[r.course] = { scores:[], count:0 };
      courseMap[r.course].scores.push(r.score);
      courseMap[r.course].count++;
    });

    return { n:rounds.length, avg, best, worst, samplePar, firAvg, girAvg, pAvg, tpAvg,
             p3ScoreAvg, p3GirPct, topClub, p3Great, last10, courseMap,
             bestCourse: rounds.find(r=>r.score===best)?.course,
             worstCourse: rounds.find(r=>r.score===worst)?.course };
  }, [rounds, sorted]);

  // ── Modal open helpers ───────────────────────────────────
  const openAdd = () => {
    setEditingRound(null);
    setForm(EMPTY_FORM);
    setFormDate(new Date());
    setModalMode('add');
  };

  const openDetail = (round) => {
    setDetailRound(round);
    setModalMode('detail');
  };

  const openEdit = (round) => {
    setEditingRound(round);
    setForm({
      course: round.course || '',
      par:    String(round.par || 72),
      score:  String(round.score || ''),
      firHit: round.firHit != null ? String(round.firHit) : '',
      firTotal: round.firTotal != null ? String(round.firTotal) : '',
      gir:    round.gir != null ? String(round.gir) : '',
      putts:  round.putts != null ? String(round.putts) : '',
      threePutts: round.threePutts != null ? String(round.threePutts) : '',
      notes:  round.notes || '',
      par3s:  round.par3s ? round.par3s.map(p=>({...p})) : [],
    });
    setFormDate(round.date ? new Date(round.date + 'T12:00:00') : new Date());
    setModalMode('edit');
  };

  // ── Save form ────────────────────────────────────────────
  const saveForm = async () => {
    const score = parseInt(form.score);
    if (isNaN(score)) return Alert.alert('Missing score', 'Enter a gross score.');
    const round = {
      course:     form.course.trim(),
      date:       fmtDateKey(formDate),
      par:        parseInt(form.par) || 72,
      score,
      firHit:     form.firHit    !== '' ? parseInt(form.firHit)    : null,
      firTotal:   form.firTotal  !== '' ? parseInt(form.firTotal)  : null,
      gir:        form.gir       !== '' ? parseInt(form.gir)       : null,
      putts:      form.putts     !== '' ? parseInt(form.putts)     : null,
      threePutts: form.threePutts !== '' ? parseInt(form.threePutts): null,
      notes:      form.notes.trim(),
      par3s:      form.par3s.filter(p=>p.club||p.score),
    };
    let updRounds, newCounter;
    if (editingRound) {
      updRounds  = rounds.map(r => r.id === editingRound.id ? { ...round, id:editingRound.id } : r);
      newCounter = idCounter;
    } else {
      round.id  = idCounter;
      updRounds = [...rounds, round];
      newCounter = idCounter + 1;
    }
    setRounds(updRounds);
    setIdCounter(newCounter);
    setModalMode(null);
    await persist(updRounds, newCounter);
  };

  // ── Delete round ─────────────────────────────────────────
  const deleteRound = (id) => {
    Alert.alert('Delete round?', 'This cannot be undone.', [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        const updated = rounds.filter(r=>r.id!==id);
        setRounds(updated);
        setModalMode(null);
        await persist(updated, idCounter);
      }},
    ]);
  };

  // ── Trend bars ───────────────────────────────────────────
  const TrendBars = () => {
    if (!stats || !stats.last10.length) return (
      <Text style={[s.trendNote, { color:c.textMuted, fontFamily:MONO }]}>Log rounds to see trend.</Text>
    );
    const scrs = stats.last10.map(r=>r.score);
    const tMin = Math.min(...scrs) - 2;
    const tMax = Math.max(...scrs) + 2;
    const trend = scrs.length > 1 ? scrs[scrs.length-1] - scrs[0] : 0;
    const note = scrs.length < 2 ? 'Log more rounds to see trend.'
      : trend < 0 ? `↓ ${Math.abs(trend)} strokes better over last ${scrs.length} rounds`
      : trend > 0 ? `↑ ${trend} strokes higher over last ${scrs.length} rounds`
      : `Consistent over last ${scrs.length} rounds`;
    return (
      <>
        <View style={s.trendWrap}>
          {stats.last10.map((r, i) => {
            const h = Math.max(6, Math.round(((r.score - tMin) / (tMax - tMin || 1)) * 28) + 4);
            const col = scoreCol(r.score, r.par || 72, c);
            return (
              <View key={i} style={[s.trendBar, { height:h, backgroundColor:col }]} />
            );
          })}
        </View>
        <Text style={[s.trendNote, { color:c.textMuted, fontFamily:MONO }]}>{note}</Text>
      </>
    );
  };

  if (loading) {
    return <View style={[s.centered, { backgroundColor:c.bgBase }]}><ActivityIndicator color={c.teal} size="large" /></View>;
  }

  // ── Modal content ────────────────────────────────────────
  const isFormMode = modalMode === 'add' || modalMode === 'edit';
  const modalTitle = modalMode === 'add' ? 'Log a Round'
    : modalMode === 'edit' ? 'Edit Round'
    : detailRound ? `${detailRound.course || 'Round'} — ${detailRound.score}` : '';

  return (
    <View style={{ flex:1, backgroundColor:c.bgBase }}>
      {saved && (
        <View style={[s.savedBadge, { backgroundColor:c.greenGlow, borderColor:c.green }]}>
          <Text style={[s.savedText, { color:c.green, fontFamily:MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── All-time stats ───────────────────────── */}
        <SecHeader title="All-Time Statistics" open={open.stats} onToggle={()=>toggle('stats')} c={c} />
        {open.stats && stats && (
          <>
            <View style={s.metRow}>
              <MetCard label="Rounds"      value={String(stats.n)}           sub="logged"        color={c.blue}  c={c} />
              <MetCard label="Scoring Avg" value={stats.avg.toFixed(1)}      sub="all rounds"    color={stats.avg - stats.samplePar <= 5 ? c.green : stats.avg - stats.samplePar <= 12 ? c.blue : c.amber} c={c} />
              <MetCard label="Best Round"  value={String(stats.best)}        sub={stats.bestCourse?.substring(0,14)} color={c.green} c={c} />
              <MetCard label="Worst Round" value={String(stats.worst)}       sub={stats.worstCourse?.substring(0,14)} color={c.red}   c={c} />
            </View>
            <View style={s.metRow}>
              <MetCard label="FIR Avg"    value={stats.firAvg != null ? stats.firAvg.toFixed(0)+'%' : '—'} sub="fairways in reg" color={c.teal}        c={c} />
              <MetCard label="GIR Avg"    value={stats.girAvg != null ? stats.girAvg.toFixed(0)+'%' : '—'} sub="greens in reg"   color={c.teal}        c={c} />
              <MetCard label="Putts Avg"  value={stats.pAvg  != null ? stats.pAvg.toFixed(1) : '—'}        sub="per round"      color={c.textPrimary} c={c} />
              <MetCard label="3-Putt Avg" value={stats.tpAvg != null ? stats.tpAvg.toFixed(1) : '—'}       sub="per round"      color={stats.tpAvg != null ? (stats.tpAvg < 1 ? c.green : stats.tpAvg < 2 ? c.amber : c.red) : c.amber} c={c} />
            </View>

            <Text style={[s.subTitle, { color:c.textMuted, fontFamily:MONO }]}>PAR 3 STATISTICS</Text>
            <View style={s.metRow}>
              <MetCard label="Avg P3 Score" value={stats.p3ScoreAvg != null ? stats.p3ScoreAvg.toFixed(2) : '—'} sub="strokes per hole" color={stats.p3ScoreAvg <= 3 ? c.green : c.amber} c={c} />
              <MetCard label="Par 3 GIR %"  value={stats.p3GirPct != null ? stats.p3GirPct.toFixed(0)+'%' : '—'} sub="greens hit"       color={c.green} c={c} />
              <MetCard label="Top P3 Club"  value={stats.topClub || '—'}           sub="most used"    color={c.teal}   fontSize={14} c={c} />
              <MetCard label="Aces/Birdies" value={String(stats.p3Great)}           sub="par 3 highlights" color={c.purple} c={c} />
            </View>

            <Text style={[s.subTitle, { color:c.textMuted, fontFamily:MONO }]}>LAST 10 ROUNDS — SCORING TREND</Text>
            <View style={[s.trendCard, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
              <TrendBars />
            </View>

            <Text style={[s.subTitle, { color:c.textMuted, fontFamily:MONO }]}>COURSE BREAKDOWN</Text>
            <View style={s.metRow}>
              {Object.entries(stats.courseMap)
                .sort((a,b) => b[1].count - a[1].count)
                .map(([course, data]) => {
                  const avg = data.scores.reduce((a,b)=>a+b,0) / data.scores.length;
                  const best = Math.min(...data.scores);
                  return (
                    <MetCard key={course} label={course} value={avg.toFixed(1)} sub={`${data.count} round${data.count!==1?'s':''} · best ${best}`} c={c} />
                  );
                })}
            </View>
          </>
        )}
        {open.stats && !stats && (
          <Text style={[s.empty, { color:c.textMuted, fontFamily:MONO }]}>No rounds logged yet.</Text>
        )}

        {/* ── Log round button ─────────────────────── */}
        <View style={s.logBtnRow}>
          <TouchableOpacity style={[s.logBtn, { backgroundColor:c.greenGlow, borderColor:c.green }]} onPress={openAdd}>
            <Text style={[s.logBtnTxt, { color:c.green, fontFamily:MONO }]}>+ Log Round</Text>
          </TouchableOpacity>
        </View>

        {/* ── Round history ────────────────────────── */}
        <SecHeader title={`Round History (${rounds.length})`} open={open.rounds} onToggle={()=>toggle('rounds')} c={c} />
        {open.rounds && (
          sorted.length === 0 ? (
            <View style={[s.emptyBox, { borderColor:c.borderSubtle }]}>
              <Text style={[s.empty, { color:c.textMuted, fontFamily:MONO }]}>No rounds logged yet. Hit "+ Log Round" to get started.</Text>
            </View>
          ) : (
            sorted.map(r => (
              <RoundBubble key={r.id} round={r} c={c} onPress={()=>openDetail(r)} />
            ))
          )
        )}

      </ScrollView>

      {/* ── Modal (add / edit / detail) ────────────── */}
      <Modal visible={modalMode !== null} animationType="slide" transparent onRequestClose={()=>setModalMode(null)}>
          <View style={s.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={[s.modalSheet, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
              {/* Header */}
              <View style={[s.modalHeader, { borderBottomColor:c.borderSubtle, backgroundColor:c.bgCard }]}>
                <Text style={[s.modalTitle, { color:c.textPrimary, fontFamily:MONO }]} numberOfLines={1}>{modalTitle}</Text>
                <TouchableOpacity style={[s.closeBtn, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]} onPress={()=>setModalMode(null)}>
                  <Text style={{ color:c.textMuted, fontSize:14 }}>×</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex:1 }} contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                {/* ── FORM MODE ── */}
                {isFormMode && (
                  <>
                    <Text style={[s.formSec, { color:c.textMuted, borderBottomColor:c.borderSubtle, fontFamily:MONO }]}>ROUND INFO</Text>
                    <FLabel label="Course Name" c={c} />
                    <TextInput style={[s.textInput, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                      value={form.course} onChangeText={v=>setF('course',v)} placeholder="e.g. Hershey Country Club" placeholderTextColor={c.textMuted} />

                    <FLabel label="Date" c={c} />
                    <TouchableOpacity style={[s.dtBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]} onPress={()=>setShowDatePicker(true)}>
                      <Text style={[s.dtTxt, { color:c.textPrimary, fontFamily:MONO }]}>
                        {formDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                      </Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker value={formDate} mode="date"
                        display={Platform.OS==='ios'?'spinner':'default'}
                        onChange={onDateChange} textColor={c.textPrimary} />
                    )}

                    <View style={s.formRow}>
                      <View style={{ flex:1, marginRight:8 }}>
                        <FLabel label="Par" c={c} />
                        <TextInput style={[s.numInput, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                          value={form.par} onChangeText={v=>setF('par',v)} keyboardType="number-pad" placeholder="72" placeholderTextColor={c.textMuted} />
                      </View>
                      <View style={{ flex:1, marginLeft:8 }}>
                        <FLabel label="Gross Score" c={c} />
                        <TextInput style={[s.numInput, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                          value={form.score} onChangeText={v=>setF('score',v)} keyboardType="number-pad" placeholder="85" placeholderTextColor={c.textMuted} />
                      </View>
                    </View>

                    <Text style={[s.formSec, { color:c.textMuted, borderBottomColor:c.borderSubtle, fontFamily:MONO }]}>FAIRWAYS & GREENS</Text>
                    <View style={s.formRow}>
                      <View style={{ flex:1, marginRight:6 }}>
                        <FLabel label="FIR Hit" c={c} />
                        <TextInput style={[s.numInput, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                          value={form.firHit} onChangeText={v=>setF('firHit',v)} keyboardType="number-pad" placeholder="8" placeholderTextColor={c.textMuted} />
                      </View>
                      <View style={{ flex:1, marginHorizontal:6 }}>
                        <FLabel label="FIR Total" c={c} />
                        <TextInput style={[s.numInput, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                          value={form.firTotal} onChangeText={v=>setF('firTotal',v)} keyboardType="number-pad" placeholder="14" placeholderTextColor={c.textMuted} />
                      </View>
                      <View style={{ flex:1, marginLeft:6 }}>
                        <FLabel label="GIR (of 18)" c={c} />
                        <TextInput style={[s.numInput, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                          value={form.gir} onChangeText={v=>setF('gir',v)} keyboardType="number-pad" placeholder="6" placeholderTextColor={c.textMuted} />
                      </View>
                    </View>

                    <Text style={[s.formSec, { color:c.textMuted, borderBottomColor:c.borderSubtle, fontFamily:MONO }]}>PUTTING</Text>
                    <View style={s.formRow}>
                      <View style={{ flex:1, marginRight:8 }}>
                        <FLabel label="Total Putts" c={c} />
                        <TextInput style={[s.numInput, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                          value={form.putts} onChangeText={v=>setF('putts',v)} keyboardType="number-pad" placeholder="33" placeholderTextColor={c.textMuted} />
                      </View>
                      <View style={{ flex:1, marginLeft:8 }}>
                        <FLabel label="3-Putts" c={c} />
                        <TextInput style={[s.numInput, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                          value={form.threePutts} onChangeText={v=>setF('threePutts',v)} keyboardType="number-pad" placeholder="2" placeholderTextColor={c.textMuted} />
                      </View>
                    </View>

                    <Text style={[s.formSec, { color:c.textMuted, borderBottomColor:c.borderSubtle, fontFamily:MONO }]}>PAR 3 HOLES</Text>
                    {form.par3s.length > 0 && (
                      <View style={[s.p3Header, { borderBottomColor:c.borderSubtle }]}>
                        {['H#','Club','Yds','Scr','GIR',''].map(h => (
                          <Text key={h} style={[s.p3Hdr, { color:c.textMuted, fontFamily:MONO, flex:h==='Club'?1:undefined }]}>{h}</Text>
                        ))}
                      </View>
                    )}
                    {form.par3s.map((p, i) => (
                      <Par3FormRow key={i} par3={p} index={i} onChange={updatePar3} onRemove={removePar3} c={c} />
                    ))}
                    <TouchableOpacity style={[s.addP3Btn, { borderColor:c.borderSubtle }]} onPress={addPar3}>
                      <Text style={[s.addP3Txt, { color:c.textMuted, fontFamily:MONO }]}>+ Add Par 3 Hole</Text>
                    </TouchableOpacity>

                    <Text style={[s.formSec, { color:c.textMuted, borderBottomColor:c.borderSubtle, fontFamily:MONO }]}>NOTES</Text>
                    <TextInput style={[s.textInput, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                      value={form.notes} onChangeText={v=>setF('notes',v)} placeholder="Conditions, highlights..." placeholderTextColor={c.textMuted} />

                    <View style={s.modalActions}>
                      <TouchableOpacity onPress={()=>setModalMode(null)} style={[s.cancelBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]}>
                        <Text style={[s.cancelTxt, { color:c.textMuted, fontFamily:MONO }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={saveForm} style={[s.saveBtn, { backgroundColor:c.greenGlow, borderColor:c.green }]}>
                        <Text style={[s.saveTxt, { color:c.green, fontFamily:MONO }]}>Save Round</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* ── DETAIL MODE ── */}
                {modalMode === 'detail' && detailRound && (
                  <>
                    {/* Score hero */}
                    <View style={s.detailHero}>
                      <View style={[rb.badge, { width:56, height:56, backgroundColor:scoreColorBg(detailRound.score,detailRound.par,c), borderColor:scoreCol(detailRound.score,detailRound.par,c) }]}>
                        <Text style={[rb.badgeTxt, { color:scoreCol(detailRound.score,detailRound.par,c), fontFamily:MONO, fontSize:20 }]}>{detailRound.score}</Text>
                      </View>
                      <View>
                        <Text style={[s.detailCourse, { color:c.textPrimary, fontFamily:MONO }]}>{detailRound.course || 'Unknown Course'}</Text>
                        <Text style={[s.detailDate, { color:c.textMuted, fontFamily:MONO }]}>{fmtDate(detailRound.date, true)} · Par {detailRound.par || 72}</Text>
                      </View>
                    </View>

                    <Text style={[s.formSec, { color:c.textMuted, borderBottomColor:c.borderSubtle, fontFamily:MONO }]}>ROUND STATS</Text>
                    <View style={s.detailGrid}>
                      {[
                        { label:'Fairways in Reg', value: detailRound.firHit!=null&&detailRound.firTotal ? `${detailRound.firHit}/${detailRound.firTotal} (${Math.round(detailRound.firHit/detailRound.firTotal*100)}%)` : '—' },
                        { label:'Greens in Reg',   value: detailRound.gir!=null ? `${detailRound.gir}/18 (${Math.round(detailRound.gir/18*100)}%)` : '—' },
                        { label:'Total Putts',     value: detailRound.putts || '—' },
                        { label:'3-Putts',         value: detailRound.threePutts != null ? detailRound.threePutts : '—' },
                      ].map(({ label, value }) => (
                        <View key={label} style={[s.df, { backgroundColor:c.bgBase }]}>
                          <Text style={[s.dfLabel, { color:c.textMuted, fontFamily:MONO }]}>{label.toUpperCase()}</Text>
                          <Text style={[s.dfVal, { color:c.textPrimary, fontFamily:MONO }]}>{String(value)}</Text>
                        </View>
                      ))}
                      {!!detailRound.notes && (
                        <View style={[s.df, s.dfFull, { backgroundColor:c.bgBase }]}>
                          <Text style={[s.dfLabel, { color:c.textMuted, fontFamily:MONO }]}>NOTES</Text>
                          <Text style={[s.dfVal, { color:c.textPrimary, fontFamily:MONO }]}>{detailRound.notes}</Text>
                        </View>
                      )}
                    </View>

                    {detailRound.par3s?.length > 0 && (
                      <>
                        <Text style={[s.formSec, { color:c.textMuted, borderBottomColor:c.borderSubtle, fontFamily:MONO }]}>PAR 3 BREAKDOWN</Text>
                        {detailRound.par3s.map((p, i) => {
                          const pc = p.score === 1 ? c.green : p.score === 2 ? c.blue : p.score === 3 ? c.amber : c.red;
                          return (
                            <View key={i} style={[s.p3DetailRow, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]}>
                              <Text style={[s.p3DNum, { color:c.textMuted, fontFamily:MONO }]}>H{i+1}</Text>
                              <Text style={[s.p3DVal, { color:c.textPrimary, fontFamily:MONO, flex:1 }]}>{p.club || '—'}</Text>
                              <Text style={[s.p3DVal, { color:c.textMuted, fontFamily:MONO }]}>{p.dist ? `${p.dist}yds` : '—'}</Text>
                              <View style={[s.scorePill, { backgroundColor:pc+'22', borderColor:pc }]}>
                                <Text style={[s.scorePillTxt, { color:pc, fontFamily:MONO }]}>{p.score || '—'}</Text>
                              </View>
                              <Text style={[s.p3DVal, { color:p.gir===true?c.green:p.gir===false?c.red:c.textMuted, fontFamily:MONO }]}>
                                {p.gir===true?'✓':p.gir===false?'✗':'—'}
                              </Text>
                            </View>
                          );
                        })}
                      </>
                    )}

                    <View style={s.modalActions}>
                      <TouchableOpacity onPress={()=>deleteRound(detailRound.id)} style={[s.cancelBtn, { borderColor:c.red, backgroundColor:c.redGlow }]}>
                        <Text style={[s.cancelTxt, { color:c.red, fontFamily:MONO }]}>Delete</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={()=>openEdit(detailRound)} style={[s.saveBtn, { backgroundColor:c.greenGlow, borderColor:c.green }]}>
                        <Text style={[s.saveTxt, { color:c.green, fontFamily:MONO }]}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

              </ScrollView>
            </KeyboardAvoidingView>
          </View>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:    { flex:1, alignItems:'center', justifyContent:'center' },
  scroll:      { padding:14, paddingBottom:60 },
  metRow:      { flexDirection:'row', flexWrap:'wrap', marginBottom:4 },
  subTitle:    { fontSize:9, fontWeight:'600', letterSpacing:1, marginTop:14, marginBottom:6 },

  trendCard:   { borderWidth:1, borderRadius:8, padding:12, marginBottom:6 },
  trendWrap:   { flexDirection:'row', alignItems:'flex-end', height:36, gap:3 },
  trendBar:    { flex:1, borderRadius:2, minWidth:8 },
  trendNote:   { fontSize:10, marginTop:6 },

  empty:       { fontSize:12, textAlign:'center', padding:8 },
  emptyBox:    { borderWidth:1, borderStyle:'dashed', borderRadius:8, padding:24, alignItems:'center', marginBottom:6 },

  logBtnRow:   { flexDirection:'row', justifyContent:'flex-end', marginVertical:14 },
  logBtn:      { borderWidth:1, borderRadius:20, paddingVertical:8, paddingHorizontal:18 },
  logBtnTxt:   { fontSize:12, fontWeight:'600', letterSpacing:0.5 },

  savedBadge:  { position:'absolute', bottom:16, right:16, zIndex:99, borderWidth:1, borderRadius:20, paddingHorizontal:14, paddingVertical:5 },
  savedText:   { fontSize:11, fontWeight:'600' },

  // Modal
  modalOverlay:{ flex:1, justifyContent:'center', backgroundColor:'rgba(0,0,0,0.45)', padding:20 },
  modalSheet:  { maxHeight:'90%', borderRadius:20, borderWidth:1, overflow:'hidden' },
  modalHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, borderBottomWidth:1 },
  modalTitle:  { fontSize:15, fontWeight:'600', flex:1, marginRight:10 },
  closeBtn:    { width:28, height:28, borderRadius:14, borderWidth:1, alignItems:'center', justifyContent:'center' },
  modalBody:   { padding:18, paddingBottom:36 },
  modalActions:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:20, paddingTop:14, borderTopWidth:1 },

  // Form
  formSec:     { fontSize:9, fontWeight:'600', letterSpacing:1, marginTop:16, marginBottom:8, paddingBottom:4, borderBottomWidth:1 },
  textInput:   { borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:7, fontSize:12, marginBottom:4 },
  numInput:    { borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:7, fontSize:12 },
  formRow:     { flexDirection:'row', marginTop:0 },
  dtBtn:       { borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:8, marginBottom:4 },
  dtTxt:       { fontSize:12 },
  cancelBtn:   { borderWidth:1, borderRadius:20, paddingVertical:7, paddingHorizontal:16 },
  cancelTxt:   { fontSize:12, fontWeight:'600' },
  saveBtn:     { borderWidth:1, borderRadius:20, paddingVertical:7, paddingHorizontal:16 },
  saveTxt:     { fontSize:12, fontWeight:'600' },

  // Par3 form header
  p3Header:    { flexDirection:'row', alignItems:'center', gap:5, borderBottomWidth:1, paddingBottom:4, marginBottom:6 },
  p3Hdr:       { fontSize:8, fontWeight:'600', letterSpacing:0.5, width:40 },
  addP3Btn:    { borderWidth:1, borderStyle:'dashed', borderRadius:20, paddingVertical:6, paddingHorizontal:14, alignSelf:'flex-start', marginTop:4 },
  addP3Txt:    { fontSize:11 },

  // Detail
  detailHero:  { flexDirection:'row', alignItems:'center', gap:14, marginBottom:16 },
  detailCourse:{ fontSize:15, fontWeight:'600' },
  detailDate:  { fontSize:11, marginTop:2 },
  detailGrid:  { flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:4 },
  df:          { flex:1, minWidth:'45%', borderRadius:8, padding:10 },
  dfFull:      { flex:0, width:'100%' },
  dfLabel:     { fontSize:9, fontWeight:'600', letterSpacing:0.5, marginBottom:3 },
  dfVal:       { fontSize:13, fontWeight:'500' },
  p3DetailRow: { flexDirection:'row', alignItems:'center', gap:10, borderWidth:1, borderRadius:6, padding:9, marginBottom:4 },
  p3DNum:      { fontSize:11, fontWeight:'600', width:26 },
  p3DVal:      { fontSize:12 },
  scorePill:   { borderWidth:1, borderRadius:10, paddingHorizontal:7, paddingVertical:1 },
  scorePillTxt:{ fontSize:11, fontWeight:'700' },
});
