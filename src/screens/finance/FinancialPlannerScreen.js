import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, ActivityIndicator, Platform,
} from 'react-native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../hooks/useHaptics';

const MONO = 'Inter_500Medium';
const PA_RATE  = 0.0307;
const VA_RATE  = 0.0575;

// ─── Tax / format helpers ─────────────────────────────────────────────────────

function calcFedTax(gross) {
  const taxable  = Math.max(0, gross - 15000);
  const brackets = [[11925, 0.10], [48475, 0.12], [103350, 0.22], [197300, 0.24]];
  let tax = 0, prev = 0;
  for (const [limit, rate] of brackets) {
    if (taxable <= prev) break;
    tax += (Math.min(taxable, limit) - prev) * rate;
    prev = limit;
  }
  return tax;
}

function fmtAmt(n) { return '$' + Math.round(Math.abs(n)).toLocaleString(); }
function fmtDec(n) { return '$' + Math.abs(n).toFixed(2); }

// ─── Pure-View donut chart ────────────────────────────────────────────────────

function PieHalf({ startDeg, deg, color, size }) {
  const R = size / 2;
  return (
    <View style={{ position: 'absolute', width: R, height: size, left: R, overflow: 'hidden',
      transform: [{ translateX: -(R / 2) }, { rotate: `${startDeg}deg` }, { translateX: R / 2 }] }}>
      <View style={{ position: 'absolute', width: size, height: size, right: 0,
        borderRadius: R, backgroundColor: color,
        transform: [{ rotate: `${deg - 180}deg` }] }} />
    </View>
  );
}

function PieSlice({ startDeg, deg, color, size }) {
  if (deg <= 0) return null;
  if (deg > 180) return (
    <>
      <PieHalf startDeg={startDeg}       deg={180}       color={color} size={size} />
      <PieHalf startDeg={startDeg + 180} deg={deg - 180} color={color} size={size} />
    </>
  );
  return <PieHalf startDeg={startDeg} deg={deg} color={color} size={size} />;
}

function GoalDonut({ slices, totalSaved, c }) {
  const SIZE = 92, HOLE = 62, R = SIZE / 2;
  const valid = slices.filter(s => s.val > 0);

  if (!valid.length || totalSaved <= 0) {
    return (
      <View style={{ width: SIZE, height: SIZE, borderRadius: R, backgroundColor: c.bgBase,
        alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.textMuted, fontFamily: MONO, fontSize: 11 }}>—</Text>
      </View>
    );
  }

  let cumDeg = -90;
  const angled = valid.map(s => {
    const deg = (s.val / totalSaved) * 360;
    const r = { ...s, startDeg: cumDeg, deg };
    cumDeg += deg;
    return r;
  });

  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <View style={{ position: 'absolute', width: SIZE, height: SIZE, borderRadius: R,
        overflow: 'hidden', backgroundColor: c.bgBase2 }}>
        {angled.map(s => <PieSlice key={s.name} startDeg={s.startDeg} deg={s.deg} color={s.color} size={SIZE} />)}
      </View>
      <View style={{ position: 'absolute', width: HOLE, height: HOLE, borderRadius: HOLE / 2,
        backgroundColor: c.bgCard, top: R - HOLE / 2, left: R - HOLE / 2 }} />
      <View style={{ position: 'absolute', width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.textPrimary, fontFamily: MONO }}>{fmtAmt(totalSaved)}</Text>
        <Text style={{ fontSize: 7, color: c.textMuted, fontFamily: MONO, letterSpacing: 0.6, marginTop: 1 }}>SAVED</Text>
      </View>
    </View>
  );
}

// ─── Default data ─────────────────────────────────────────────────────────────

const DEF_JOBS = [
  { id: 1, name: 'Hershey Internship', rate: '18', hours: '40', weeks: '12' },
  { id: 2, name: 'RA Position',        rate: '12', hours: '20', weeks: '12' },
  { id: 3, name: 'Part-Time Job',      rate: '15', hours: '15', weeks: '20' },
];
const DEF_GOALS = [
  { id: 1, name: 'Roth IRA',      amount: '7500', saved: '0', deferred: false },
  { id: 2, name: 'Launch Monitor',amount: '4500', saved: '0', deferred: false },
  { id: 3, name: 'Truck Fund',    amount: '2000', saved: '0', deferred: false },
];
const DEF_REPAYMENTS = [
  { id: 1, name: 'Launch Monitor', total: '4500', paid: '0' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FinancialPlannerScreen() {
  const { theme, isDark } = useTheme();
  const { user }  = useAuth();
  const { triggerHaptic } = useHaptics();
  const c = theme.colors;

  // Goal color palette from theme tokens
  const GOAL_PALETTE = [c.green, c.teal, c.blue, c.purple, c.amber, c.red];

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading,    setLoading]    = useState(true);
  const [saved,      setSaved]      = useState(false);
  const [periodName, setPeriodName] = useState('Summer 2026');
  const [vaMode,     setVaMode]     = useState(false);
  const [totalSaved, setTotalSaved] = useState('0');
  const [jobs,       setJobs]       = useState(DEF_JOBS);
  const [goals,      setGoals]      = useState(DEF_GOALS);
  const [repayments, setRepayments] = useState(DEF_REPAYMENTS);
  const [archGoals,  setArchGoals]  = useState([]);
  const [archRep,    setArchRep]    = useState([]);
  const [idC,        setIdC]        = useState(20);

  const [goalsArchOpen, setGoalsArchOpen] = useState(false);
  const [repArchOpen,   setRepArchOpen]   = useState(false);

  const [modalVis,  setModalVis]  = useState(false);
  const [modalType, setModalType] = useState('goal');
  const [mName,     setMName]     = useState('');
  const [mAmount,   setMAmount]   = useState('');
  const [mSaved,    setMSaved]    = useState('0');

  // ── Refs ───────────────────────────────────────────────────────────────────
  const jobsRef      = useRef(jobs);
  const goalsRef     = useRef(goals);
  const repRef       = useRef(repayments);
  const archGoalsRef = useRef(archGoals);
  const archRepRef   = useRef(archRep);
  const periodRef    = useRef(periodName);
  const vaModeRef    = useRef(vaMode);
  const savedRef     = useRef(totalSaved);
  const idCRef       = useRef(idC);
  const userRef      = useRef(user);
  const timerRef     = useRef(null);

  useEffect(() => { jobsRef.current      = jobs;       }, [jobs]);
  useEffect(() => { goalsRef.current     = goals;      }, [goals]);
  useEffect(() => { repRef.current       = repayments; }, [repayments]);
  useEffect(() => { archGoalsRef.current = archGoals;  }, [archGoals]);
  useEffect(() => { archRepRef.current   = archRep;    }, [archRep]);
  useEffect(() => { periodRef.current    = periodName; }, [periodName]);
  useEffect(() => { vaModeRef.current    = vaMode;     }, [vaMode]);
  useEffect(() => { savedRef.current     = totalSaved; }, [totalSaved]);
  useEffect(() => { idCRef.current       = idC;        }, [idC]);
  useEffect(() => { userRef.current      = user;       }, [user]);

  // ── Firestore ──────────────────────────────────────────────────────────────

  const docRef = () => {
    const uid = userRef.current?.uid;
    if (!uid) return null;
    return firebase.firestore().collection('users').doc(uid).collection('localStorage').doc('data');
  };

  const writeAll = async () => {
    const ref = docRef();
    if (!ref) return;
    try {
      await ref.set({
        fp2_period:     periodRef.current,
        fp2_va_mode:    String(vaModeRef.current),
        fp2_saved:      savedRef.current,
        fp2_jobs:       JSON.stringify(jobsRef.current),
        fp2_goals:      JSON.stringify(goalsRef.current),
        fp2_rep:        JSON.stringify(repRef.current),
        fp2_arch_goals: JSON.stringify(archGoalsRef.current),
        fp2_arch_rep:   JSON.stringify(archRepRef.current),
        fp2_id:         String(idCRef.current),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
    } catch (err) { Alert.alert('Save error', err.message); }
  };

  const scheduleSave = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(writeAll, 900);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const ref  = docRef();
      if (!ref) return;
      const snap = await ref.get();
      if (!snap.exists) return;
      const d = snap.data();
      if (d.fp2_period)     setPeriodName(d.fp2_period);
      if (d.fp2_va_mode)    setVaMode(d.fp2_va_mode === 'true');
      if (d.fp2_saved)      setTotalSaved(d.fp2_saved);
      if (d.fp2_jobs)       setJobs(JSON.parse(d.fp2_jobs));
      if (d.fp2_goals)      setGoals(JSON.parse(d.fp2_goals));
      if (d.fp2_rep)        setRepayments(JSON.parse(d.fp2_rep));
      if (d.fp2_arch_goals) setArchGoals(JSON.parse(d.fp2_arch_goals));
      if (d.fp2_arch_rep)   setArchRep(JSON.parse(d.fp2_arch_rep));
      if (d.fp2_id)         setIdC(parseInt(d.fp2_id, 10));
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  // ── Computed ───────────────────────────────────────────────────────────────

  const gross      = jobs.reduce((s, j) => s + (parseFloat(j.rate)||0) * (parseFloat(j.hours)||0) * (parseFloat(j.weeks)||0), 0);
  const fedTax     = calcFedTax(gross);
  const ficaTax    = gross * 0.0765;
  const stateTax   = gross * (vaMode ? VA_RATE : PA_RATE);
  const net        = gross - fedTax - ficaTax - stateTax;
  const totalRepBal = repayments.reduce((s, r) => s + Math.max(0, (parseFloat(r.total)||0) - (parseFloat(r.paid)||0)), 0);
  const available  = net - totalRepBal;

  const totalSavedNum = parseFloat(totalSaved) || 0;
  const goalAllocMap  = {};
  let rem = totalSavedNum;
  goals.filter(g => !g.deferred).forEach(g => {
    const alloc = Math.min(parseFloat(g.saved) || 0, rem);
    rem = Math.max(0, rem - alloc);
    goalAllocMap[g.id] = alloc;
  });
  const totalAllocated = Object.values(goalAllocMap).reduce((s, v) => s + v, 0);
  const unallocated    = Math.max(0, totalSavedNum - totalAllocated);

  const donutSlices = [
    ...goals
      .filter(g => !g.deferred)
      .map((g, i) => ({ name: g.name, val: goalAllocMap[g.id] || 0, color: GOAL_PALETTE[i % GOAL_PALETTE.length] }))
      .filter(s => s.val > 0),
    ...(unallocated > 0 ? [{ name: 'Unallocated', val: unallocated, color: c.borderSubtle }] : []),
  ];

  // ── Job handlers ───────────────────────────────────────────────────────────

  const addJob = () => {
    triggerHaptic();
    const id = idCRef.current, newId = id + 1;
    const newJobs = [...jobsRef.current, { id, name: 'New Job', rate: '15', hours: '20', weeks: '10' }];
    setJobs(newJobs);  jobsRef.current = newJobs;
    setIdC(newId);     idCRef.current  = newId;
    writeAll();
  };

  const updateJob = (id, field, val) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, [field]: val } : j));
    scheduleSave();
  };

  const deleteJob = (id) => {
    const newJobs = jobsRef.current.filter(j => j.id !== id);
    setJobs(newJobs); jobsRef.current = newJobs;
    writeAll();
  };

  // ── Goal handlers ──────────────────────────────────────────────────────────

  const updateGoalSaved = (id, val) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, saved: val } : g));
    scheduleSave();
  };

  const deferGoal = (id) => {
    const newGoals = goalsRef.current.map(g => g.id === id ? { ...g, deferred: !g.deferred } : g);
    setGoals(newGoals); goalsRef.current = newGoals;
    writeAll();
  };

  const archiveGoal = (id, action) => {
    const g = goalsRef.current.find(x => x.id === id);
    if (!g) return;
    const newArch  = action === 'complete' ? [...archGoalsRef.current, { ...g, status: 'Completed' }] : archGoalsRef.current;
    const newGoals = goalsRef.current.filter(x => x.id !== id);
    setGoals(newGoals);        goalsRef.current    = newGoals;
    setArchGoals(newArch);     archGoalsRef.current = newArch;
    writeAll();
  };

  // ── Repayment handlers ─────────────────────────────────────────────────────

  const updateRepayment = (id, field, val) => {
    setRepayments(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
    scheduleSave();
  };

  const archiveRepayment = (id, action) => {
    const r = repRef.current.find(x => x.id === id);
    if (!r) return;
    const newArch = action === 'complete' ? [...archRepRef.current, { ...r, status: 'Paid Off' }] : archRepRef.current;
    const newRep  = repRef.current.filter(x => x.id !== id);
    setRepayments(newRep);  repRef.current    = newRep;
    setArchRep(newArch);    archRepRef.current = newArch;
    writeAll();
  };

  // ── Modal ──────────────────────────────────────────────────────────────────

  const openModal = (type) => {
    setModalType(type);
    setMName(''); setMAmount(''); setMSaved('0');
    setModalVis(true);
  };

  const saveModal = () => {
    triggerHaptic();
    const name   = mName.trim();
    const amount = parseFloat(mAmount) || 0;
    if (!name) return Alert.alert('Required', 'Enter a name.');
    const id = idCRef.current, newId = id + 1;
    if (modalType === 'goal') {
      const newGoals = [...goalsRef.current, { id, name, amount: String(amount), saved: mSaved || '0', deferred: false }];
      setGoals(newGoals); goalsRef.current = newGoals;
    } else {
      const newRep = [...repRef.current, { id, name, total: String(amount), paid: '0' }];
      setRepayments(newRep); repRef.current = newRep;
    }
    setIdC(newId); idCRef.current = newId;
    setModalVis(false);
    writeAll();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={[s.centered]}><ActivityIndicator color={c.green} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {saved && (
        <View style={[s.savedBadge, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
          <Text style={[s.savedText, { color: c.green, fontFamily: MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Header ────────────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={[s.pageTitle, { color: c.textPrimary }]}>Financial Planner</Text>
          <Text style={[s.pageSub,   { color: c.textSecondary }]}>Track income, goals, and expenses</Text>
          <TextInput
            style={[s.periodInput, { backgroundColor: c.bgCard, borderColor: c.borderSubtle, color: c.textPrimary, fontFamily: MONO }]}
            value={periodName}
            onChangeText={v => { setPeriodName(v); scheduleSave(); }}
            placeholder="Planning period name" placeholderTextColor={c.textMuted}
          />
        </View>

        {/* ── Summary Metrics ────────────────────────────────────────── */}
        <View style={s.metricsGrid}>
          <View style={[s.metCard, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
            <Text style={[s.metLabel, { color: c.green, fontFamily: MONO }]}>GROSS INCOME</Text>
            <Text style={[s.metValue, { color: c.textPrimary, fontFamily: MONO }]}>{fmtAmt(gross)}</Text>
            <Text style={[s.metSub, { color: c.textMuted, fontFamily: MONO }]}>all jobs combined</Text>
          </View>
          <View style={[s.metCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <Text style={[s.metLabel, { color: c.textMuted, fontFamily: MONO }]}>NET TAKE-HOME</Text>
            <Text style={[s.metValue, { color: c.textPrimary, fontFamily: MONO }]}>{fmtAmt(net)}</Text>
            <Text style={[s.metSub, { color: c.textMuted, fontFamily: MONO }]}>after taxes</Text>
          </View>
          <View style={[s.metCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <Text style={[s.metLabel, { color: c.textMuted, fontFamily: MONO }]}>REPAYMENTS</Text>
            <Text style={[s.metValue, { color: c.textPrimary, fontFamily: MONO }]}>{fmtAmt(totalRepBal)}</Text>
            <Text style={[s.metSub, { color: c.textMuted, fontFamily: MONO }]}>remaining balances</Text>
          </View>
          <View style={[s.metCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <Text style={[s.metLabel, { color: c.textMuted, fontFamily: MONO }]}>AVAILABLE</Text>
            <Text style={[s.metValue, { color: available >= 0 ? c.green : c.red, fontFamily: MONO }]}>{fmtAmt(available)}</Text>
            <Text style={[s.metSub, { color: c.textMuted, fontFamily: MONO }]}>net minus repayments</Text>
          </View>
        </View>

        {/* ── Tax Breakdown ─────────────────────────────────────────── */}
        <View style={[s.taxCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
          <View style={s.taxHeader}>
            <Text style={[s.sectionLabel, { color: c.textMuted, fontFamily: MONO }]}>TAX BREAKDOWN</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[s.toggleLbl, { color: vaMode ? c.textMuted : c.textSecondary, fontFamily: MONO }]}>PA</Text>
              <TouchableOpacity
                onPress={() => {
                  const next = !vaModeRef.current;
                  setVaMode(next); vaModeRef.current = next;
                  writeAll();
                }}
                style={[s.toggleTrack, { backgroundColor: vaMode ? c.greenGlow : c.bgBase, borderColor: vaMode ? c.green : c.borderSubtle }]}
              >
                <View style={[s.toggleThumb, { backgroundColor: vaMode ? c.green : c.textMuted, transform: [{ translateX: vaMode ? 19 : 2 }] }]} />
              </TouchableOpacity>
              <Text style={[s.toggleLbl, { color: vaMode ? c.textSecondary : c.textMuted, fontFamily: MONO }]}>VA</Text>
            </View>
          </View>

          {[
            { label: 'Gross Income',                      value: fmtAmt(gross),    color: c.green },
            { label: 'Federal Income Tax (est.)',         value: '-'+fmtAmt(fedTax),   color: c.red },
            { label: 'FICA (Social Security + Medicare)', value: '-'+fmtAmt(ficaTax),  color: c.red },
            { label: vaMode ? 'VA State Tax (5.75%)' : 'PA State Tax (3.07%)', value: '-'+fmtAmt(stateTax), color: c.red },
          ].map((row, i, arr) => (
            <View key={i} style={[s.taxRow, { borderBottomColor: c.borderSubtle, borderBottomWidth: i < arr.length - 1 ? 0.5 : 0 }]}>
              <Text style={[s.taxRowLabel, { color: c.textSecondary, fontFamily: MONO }]}>{row.label}</Text>
              <Text style={[s.taxRowValue, { color: row.color, fontFamily: MONO }]}>{row.value}</Text>
            </View>
          ))}

          <View style={[s.taxDivider, { backgroundColor: c.borderSubtle }]} />

          <View style={s.taxRow}>
            <Text style={[s.taxRowLabel, { color: c.textPrimary, fontWeight: '600', fontFamily: MONO }]}>Net Take-Home</Text>
            <Text style={[s.taxRowValue, { color: c.green, fontSize: 16, fontFamily: MONO }]}>{fmtAmt(net)}</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* JOBS                                                       */}
        {/* ══════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <View style={s.secRow}>
            <Text style={[s.sectionLabel, { color: c.textMuted, fontFamily: MONO }]}>INCOME / JOBS</Text>
            <TouchableOpacity onPress={addJob} style={[s.addBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
              <Text style={[s.addBtnTxt, { color: c.green, fontFamily: MONO }]}>+ Add Job</Text>
            </TouchableOpacity>
          </View>

          {jobs.map(j => {
            const jobGross = (parseFloat(j.rate)||0) * (parseFloat(j.hours)||0) * (parseFloat(j.weeks)||0);
            return (
              <View key={j.id} style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                <View style={s.cardHeader}>
                  <TextInput
                    style={[s.cardTitleInput, { color: c.textPrimary, borderBottomColor: c.borderSubtle, fontFamily: MONO }]}
                    value={j.name} onChangeText={v => updateJob(j.id, 'name', v)}
                    placeholder="Job name" placeholderTextColor={c.textMuted}
                  />
                  <TouchableOpacity onPress={() => deleteJob(j.id)}>
                    <Text style={{ color: c.red, fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.formRow3}>
                  {[
                    { label: '$/HR', field: 'rate', val: j.rate },
                    { label: 'HRS/WK', field: 'hours', val: j.hours },
                    { label: 'WEEKS', field: 'weeks', val: j.weeks },
                  ].map(({ label, field, val }) => (
                    <View key={field} style={{ flex: 1 }}>
                      <Text style={[s.formLabel, { color: c.textMuted, fontFamily: MONO }]}>{label}</Text>
                      <TextInput
                        style={[s.formInput, { backgroundColor: c.bgBase, borderColor: c.borderSubtle, color: c.textPrimary, fontFamily: MONO }]}
                        value={val} onChangeText={v => updateJob(j.id, field, v)}
                        keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.textMuted}
                      />
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <Text style={[s.metaLabel, { color: c.textMuted, fontFamily: MONO }]}>Projected gross</Text>
                  <Text style={[s.metaValue, { color: c.green, fontFamily: MONO }]}>{fmtAmt(jobGross)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* GOALS                                                      */}
        {/* ══════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <View style={s.secRow}>
            <Text style={[s.sectionLabel, { color: c.textMuted, fontFamily: MONO }]}>GOALS</Text>
            <TouchableOpacity onPress={() => openModal('goal')} style={[s.addBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
              <Text style={[s.addBtnTxt, { color: c.green, fontFamily: MONO }]}>+ Add Goal</Text>
            </TouchableOpacity>
          </View>

          {/* Total saved input */}
          <View style={[s.savedWrap, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <Text style={[s.savedWrapLabel, { color: c.textSecondary, fontFamily: MONO }]}>Total saved / allocated</Text>
            <TextInput
              style={[s.savedInput, { backgroundColor: c.bgBase, borderColor: c.borderSubtle, color: c.green, fontFamily: MONO }]}
              value={totalSaved} onChangeText={v => { setTotalSaved(v); scheduleSave(); }}
              keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.textMuted}
            />
          </View>

          {/* Donut + legend */}
          {totalSavedNum > 0 && (
            <View style={[s.donutWrap, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
              <GoalDonut slices={donutSlices} totalSaved={totalSavedNum} c={c} />
              <View style={{ flex: 1 }}>
                {donutSlices.map(sl => (
                  <View key={sl.name} style={s.legendRow}>
                    <View style={[s.legendDot, { backgroundColor: sl.color }]} />
                    <Text style={[s.legendName, { color: c.textSecondary, fontFamily: MONO }]} numberOfLines={1}>{sl.name}</Text>
                    <Text style={[s.legendVal,  { color: c.textPrimary,   fontFamily: MONO }]}>{fmtAmt(sl.val)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Goal cards */}
          {goals.map((g, gi) => {
            const color  = GOAL_PALETTE[gi % GOAL_PALETTE.length];
            const target = parseFloat(g.amount) || 0;
            const alloc  = goalAllocMap[g.id] || 0;
            const pct    = target > 0 ? Math.min(100, Math.round((alloc / target) * 100)) : 0;
            return (
              <View key={g.id} style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle, opacity: g.deferred ? 0.5 : 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: g.deferred ? 0 : 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    {!g.deferred && <View style={[s.goalDot, { backgroundColor: color }]} />}
                    <Text style={[s.goalName, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>{g.name}</Text>
                    {g.deferred && (
                      <View style={[s.pill, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
                        <Text style={[s.pillTxt, { color: c.textMuted, fontFamily: MONO }]}>DEFERRED</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <Text style={[s.goalAmt, { color: c.textPrimary, fontFamily: MONO }]}>{fmtAmt(target)}</Text>
                    <TouchableOpacity onPress={() => deferGoal(g.id)}>
                      <Text style={{ color: c.textMuted, fontSize: 13 }}>{g.deferred ? '▶' : '⏸'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => archiveGoal(g.id, 'complete')}>
                      <Text style={{ color: c.green, fontSize: 13 }}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => archiveGoal(g.id, 'delete')}>
                      <Text style={{ color: c.red, fontSize: 13 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {!g.deferred && (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Text style={[s.metaLabel, { color: c.textMuted, fontFamily: MONO }]}>Allocated:</Text>
                      <TextInput
                        style={[s.goalSavedInput, { backgroundColor: c.bgBase, borderColor: c.borderSubtle, color: c.green, fontFamily: MONO }]}
                        value={g.saved} onChangeText={v => updateGoalSaved(g.id, v)}
                        keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.textMuted}
                      />
                      <Text style={[s.metaLabel, { color: c.textMuted, fontFamily: MONO }]}>{pct}% of goal</Text>
                    </View>
                    <View style={[s.progressTrack, { backgroundColor: c.bgBase }]}>
                      <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
                    </View>
                  </>
                )}
              </View>
            );
          })}

          {/* Goals archive */}
          <TouchableOpacity onPress={() => setGoalsArchOpen(v => !v)}
            style={[s.archiveBtn, { borderColor: c.borderSubtle }]}>
            <Text style={[s.archiveBtnTxt, { color: c.textMuted, fontFamily: MONO }]}>Completed / Archived</Text>
            <Text style={{ color: c.textMuted, fontSize: 10 }}>{goalsArchOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {goalsArchOpen && archGoals.map(g => (
            <View key={g.id} style={[s.archiveItem, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
              <Text style={[s.archiveName, { color: c.textSecondary, fontFamily: MONO }]}>{g.name} · {g.status}</Text>
              <Text style={[s.archiveAmt,  { color: c.textSecondary, fontFamily: MONO }]}>{fmtAmt(parseFloat(g.amount)||0)}</Text>
            </View>
          ))}
        </View>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* REPAYMENT SCHEDULES                                        */}
        {/* ══════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <View style={s.secRow}>
            <Text style={[s.sectionLabel, { color: c.textMuted, fontFamily: MONO }]}>REPAYMENT SCHEDULES</Text>
            <TouchableOpacity onPress={() => openModal('repayment')} style={[s.addBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
              <Text style={[s.addBtnTxt, { color: c.green, fontFamily: MONO }]}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {repayments.map(r => {
            const total     = parseFloat(r.total) || 0;
            const paid      = parseFloat(r.paid)  || 0;
            const remaining = Math.max(0, total - paid);
            const pct       = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
            const mo3       = remaining / 3;
            const mo6       = remaining / 6;
            const mo12      = remaining / 12;
            return (
              <View key={r.id} style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                <View style={s.cardHeader}>
                  <TextInput
                    style={[s.cardTitleInput, { color: c.textPrimary, borderBottomColor: c.borderSubtle, fontFamily: MONO }]}
                    value={r.name} onChangeText={v => updateRepayment(r.id, 'name', v)}
                    placeholder="Loan name" placeholderTextColor={c.textMuted}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => archiveRepayment(r.id, 'complete')}>
                      <Text style={{ color: c.green, fontSize: 13 }}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => archiveRepayment(r.id, 'delete')}>
                      <Text style={{ color: c.red, fontSize: 13 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={s.formRow2}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.formLabel, { color: c.textMuted, fontFamily: MONO }]}>TOTAL ($)</Text>
                    <TextInput
                      style={[s.formInput, { backgroundColor: c.bgBase, borderColor: c.borderSubtle, color: c.textPrimary, fontFamily: MONO }]}
                      value={r.total} onChangeText={v => updateRepayment(r.id, 'total', v)}
                      keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.formLabel, { color: c.textMuted, fontFamily: MONO }]}>PAID ($)</Text>
                    <TextInput
                      style={[s.formInput, { backgroundColor: c.bgBase, borderColor: c.borderSubtle, color: c.textPrimary, fontFamily: MONO }]}
                      value={r.paid} onChangeText={v => updateRepayment(r.id, 'paid', v)}
                      keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.textMuted}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={[s.metaLabel, { color: c.textMuted, fontFamily: MONO }]}>Remaining: {fmtAmt(remaining)}</Text>
                  <Text style={[s.metaLabel, { color: c.textMuted, fontFamily: MONO }]}>{pct}% paid</Text>
                </View>
                <View style={[s.progressTrack, { backgroundColor: c.bgBase, marginBottom: 10 }]}>
                  <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: c.green }]} />
                </View>
                <View style={s.monthlyGrid}>
                  {[['3 MO', mo3], ['6 MO', mo6], ['12 MO', mo12]].map(([label, val]) => (
                    <View key={label} style={[s.monthlyPill, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
                      <Text style={[s.monthlyLabel, { color: c.textMuted, fontFamily: MONO }]}>{label}</Text>
                      <Text style={[s.monthlyValue, { color: c.green,     fontFamily: MONO }]}>{fmtDec(val)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}

          {/* Repayments archive */}
          <TouchableOpacity onPress={() => setRepArchOpen(v => !v)}
            style={[s.archiveBtn, { borderColor: c.borderSubtle }]}>
            <Text style={[s.archiveBtnTxt, { color: c.textMuted, fontFamily: MONO }]}>Paid Off / Archived</Text>
            <Text style={{ color: c.textMuted, fontSize: 10 }}>{repArchOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {repArchOpen && archRep.map(r => (
            <View key={r.id} style={[s.archiveItem, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
              <Text style={[s.archiveName, { color: c.textSecondary, fontFamily: MONO }]}>{r.name} · {r.status}</Text>
              <Text style={[s.archiveAmt,  { color: c.textSecondary, fontFamily: MONO }]}>{fmtAmt(parseFloat(r.total)||0)}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* ── Add Modal ──────────────────────────────────────────────── */}
      <Modal visible={modalVis} transparent animationType="fade" onRequestClose={() => setModalVis(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setModalVis(false)}>
          <TouchableOpacity activeOpacity={1}>
            <BlurView intensity={60} tint={isDark?'dark':'light'} style={[s.modalBox, { borderColor: c.borderSubtle }]}>
              <Text style={[s.modalTitle, { color: c.textPrimary, fontFamily: MONO }]}>
                {modalType === 'goal' ? 'Add Goal' : 'Add Repayment'}
              </Text>

              <Text style={[s.formLabel, { color: c.textMuted, fontFamily: MONO }]}>
                {modalType === 'goal' ? 'GOAL NAME' : 'LOAN / ITEM NAME'}
              </Text>
              <TextInput
                style={[s.formInput, { backgroundColor: c.bgBase, borderColor: c.borderSubtle, color: c.textPrimary, fontFamily: MONO, marginBottom: 10 }]}
                value={mName} onChangeText={setMName}
                placeholder={modalType === 'goal' ? 'e.g. Roth IRA' : 'e.g. Laptop'}
                placeholderTextColor={c.textMuted} autoFocus
              />

              <Text style={[s.formLabel, { color: c.textMuted, fontFamily: MONO }]}>TARGET AMOUNT ($)</Text>
              <TextInput
                style={[s.formInput, { backgroundColor: c.bgBase, borderColor: c.borderSubtle, color: c.textPrimary, fontFamily: MONO, marginBottom: 10 }]}
                value={mAmount} onChangeText={setMAmount}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.textMuted}
              />

              {modalType === 'goal' && (
                <>
                  <Text style={[s.formLabel, { color: c.textMuted, fontFamily: MONO }]}>ALREADY ALLOCATED ($)</Text>
                  <TextInput
                    style={[s.formInput, { backgroundColor: c.bgBase, borderColor: c.borderSubtle, color: c.textPrimary, fontFamily: MONO, marginBottom: 10 }]}
                    value={mSaved} onChangeText={setMSaved}
                    keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.textMuted}
                  />
                </>
              )}

              <View style={s.modalActions}>
                <TouchableOpacity onPress={() => setModalVis(false)}
                  style={[s.modalBtn, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
                  <Text style={[s.modalBtnTxt, { color: c.textSecondary, fontFamily: MONO }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveModal}
                  style={[s.modalBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                  <Text style={[s.modalBtnTxt, { color: c.green, fontFamily: MONO }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { padding: 16, paddingBottom: 60 },
  savedBadge: { position: 'absolute', bottom: 16, right: 16, zIndex: 99, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  savedText:  { fontSize: 11, fontWeight: '600' },

  header:      { marginBottom: 20 },
  pageTitle:   { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  pageSub:     { fontSize: 13, marginTop: 4, marginBottom: 10 },
  periodInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, marginTop: 4 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  metCard:     { width: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 14 },
  metLabel:    { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 },
  metValue:    { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  metSub:      { fontSize: 10, marginTop: 3 },

  taxCard:    { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 20 },
  taxHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  toggleLbl:  { fontSize: 12, fontWeight: '500' },
  toggleTrack:{ width: 40, height: 22, borderWidth: 1, borderRadius: 11, justifyContent: 'center' },
  toggleThumb:{ width: 16, height: 16, borderRadius: 8, position: 'absolute', top: 3 },
  taxRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  taxRowLabel:{ fontSize: 13 },
  taxRowValue:{ fontSize: 13, fontWeight: '500' },
  taxDivider: { height: 0.5, marginVertical: 6 },

  section:      { marginBottom: 24 },
  secRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  addBtn:       { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  addBtnTxt:    { fontSize: 12, fontWeight: '600' },

  card:          { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitleInput:{ fontSize: 14, fontWeight: '600', flex: 1, marginRight: 10, borderBottomWidth: 0.5, paddingBottom: 2 },

  formRow3: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  formRow2: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  formLabel:{ fontSize: 10, fontWeight: '500', letterSpacing: 0.5, marginBottom: 4 },
  formInput:{ borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 },

  metaLabel: { fontSize: 11 },
  metaValue: { fontSize: 14, fontWeight: '600' },

  savedWrap:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  savedWrapLabel: { fontSize: 12 },
  savedInput:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, textAlign: 'right', width: 110 },

  donutWrap: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  legendName:{ flex: 1, fontSize: 11 },
  legendVal: { fontSize: 11, fontWeight: '600' },

  goalDot:        { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  goalName:       { fontSize: 14, fontWeight: '600', flex: 1 },
  goalAmt:        { fontSize: 13, fontWeight: '600' },
  goalSavedInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, textAlign: 'right', width: 90 },
  pill:           { borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  pillTxt:        { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3 },

  monthlyGrid:  { flexDirection: 'row', gap: 6 },
  monthlyPill:  { flex: 1, borderWidth: 1, borderRadius: 6, padding: 7, alignItems: 'center' },
  monthlyLabel: { fontSize: 10, letterSpacing: 0.4, marginBottom: 3 },
  monthlyValue: { fontSize: 13, fontWeight: '600' },

  archiveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 6 },
  archiveBtnTxt: { fontSize: 12 },
  archiveItem:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 6, opacity: 0.5 },
  archiveName:   { fontSize: 12 },
  archiveAmt:    { fontSize: 12, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox:     { width: 340, borderWidth: 1, borderRadius: 16, padding: 20 },
  modalTitle:   { fontSize: 16, fontWeight: '600', marginBottom: 14 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn:     { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'center' },
  modalBtnTxt:  { fontSize: 13, fontWeight: '500' },
});
