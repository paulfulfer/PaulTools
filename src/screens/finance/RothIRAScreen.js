import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, Modal, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../hooks/useHaptics';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONO = 'Inter_500Medium';

const YEAR_LIMITS = {
  2019: 6000, 2020: 6000, 2021: 6000, 2022: 6000,
  2023: 6500, 2024: 7500, 2025: 7500, 2026: 7500,
  2027: 7500, 2028: 7500, 2029: 7500, 2030: 7500,
};
const getLimit = (year) => YEAR_LIMITS[year] || 7500;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n, signed = false) {
  const abs = '$' + Math.abs(Number(n) || 0).toFixed(2);
  if (!signed) return abs;
  const num = Number(n) || 0;
  return (num < 0 ? '-' : num > 0 ? '+' : '') + abs;
}
function fmtBig(n) { return '$' + Math.round(Math.abs(Number(n) || 0)).toLocaleString(); }
function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDisplay(dateStr) {
  return new Date(dateStr+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
function getDepYear(dep) { return new Date(dep.date+'T00:00:00').getFullYear(); }
function getYearPct() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end   = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  return Math.min(100, ((now - start) / (end - start)) * 100);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SecHeader({ title, open, onToggle, c }) {
  return (
    <TouchableOpacity style={[sh.row, { borderBottomColor: c.borderSubtle }]} onPress={onToggle} activeOpacity={0.7}>
      <Text style={[sh.label, { color: c.textMuted, fontFamily: MONO }]}>{title.toUpperCase()}</Text>
      <Text style={[sh.arrow, { color: c.textMuted }]}>{open ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 10, marginTop: 18, marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  arrow: { fontSize: 10 },
});

function FLabel({ label, c }) {
  return <Text style={[fl.t, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>;
}
const fl = StyleSheet.create({ t: { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, marginBottom: 3, marginTop: 10 } });

function MetCard({ label, value, sub, color, fontSize, c }) {
  return (
    <View style={[mc.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
      <Text style={[mc.label, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[mc.value, { color: color || c.textPrimary, fontSize: fontSize || 18, fontFamily: MONO }]}>{value}</Text>
      {!!sub && <Text style={[mc.sub, { color: c.textMuted, fontFamily: MONO }]}>{sub}</Text>}
    </View>
  );
}
const mc = StyleSheet.create({
  card:  { flex: 1, minWidth: '30%', borderWidth: 1, borderRadius: 8, padding: 10, margin: 3 },
  label: { fontSize: 9, letterSpacing: 0.8, marginBottom: 3 },
  value: { fontWeight: '700', letterSpacing: -0.3 },
  sub:   { fontSize: 9, marginTop: 2 },
});

function PaceBar({ label, pct, color, c }) {
  return (
    <View style={pb.row}>
      <Text style={[pb.label, { color: c.textSecondary, fontFamily: MONO }]}>{label}</Text>
      <View style={[pb.track, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
        <View style={[pb.fill, { width: `${Math.min(100, pct).toFixed(1)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[pb.pct, { color: c.textPrimary, fontFamily: MONO }]}>{Math.round(pct)}%</Text>
    </View>
  );
}
const pb = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  label: { width: 110, fontSize: 11 },
  track: { flex: 1, height: 6, borderRadius: 3, borderWidth: 1, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 3 },
  pct:   { width: 36, textAlign: 'right', fontSize: 11, fontWeight: '600' },
});

function RsBlock({ label, value, sub, color, c }) {
  return (
    <View style={[rs.block, { backgroundColor: c.bgBase }]}>
      <Text style={[rs.label, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[rs.value, { color: color || c.textPrimary, fontFamily: MONO }]}>{value}</Text>
      {!!sub && <Text style={[rs.sub, { color: c.textMuted, fontFamily: MONO }]}>{sub}</Text>}
    </View>
  );
}
const rs = StyleSheet.create({
  block: { flex: 1, minWidth: '45%', borderRadius: 8, padding: 12, margin: 3 },
  label: { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, marginBottom: 4 },
  value: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  sub:   { fontSize: 10, marginTop: 3 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RothIRAScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const { triggerHaptic } = useHaptics();
  const c = theme.colors;

  const [deposits,       setDeposits]       = useState([]);
  const [currentBalance, setCurrentBalance] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved,   setSaved]   = useState(false);

  const [open, setOpen] = useState({
    balance: true, years: true, maxout: false,
    log: true, pace: true, deposits: true, projection: false,
  });
  const toggle = key => setOpen(p => ({ ...p, [key]: !p[key] }));

  const [formLabel, setFormLabel] = useState('');
  const [formDate,  setFormDate]  = useState(new Date());
  const [formAmt,   setFormAmt]   = useState('');
  const [picker,    setPicker]    = useState({ show: false });

  const [projRate,      setProjRate]      = useState('7');
  const [projAge,       setProjAge]       = useState('20');
  const [projTargetAge, setProjTargetAge] = useState('65');

  // ── Firestore ──────────────────────────────────────────────────────────────

  const docRef = () =>
    firebase.firestore().collection('users').doc(user.uid).collection('localStorage').doc('data');

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await docRef().get();
      const data = snap.exists ? snap.data() : {};
      setDeposits(JSON.parse(data.ira_deposits || '[]'));
      setCurrentBalance(data.ira_current_balance || '');
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const persist = async (deps, cb) => {
    try {
      await docRef().set({ ira_deposits: JSON.stringify(deps), ira_current_balance: cb }, { merge: true });
      flash();
    } catch (err) { Alert.alert('Save error', err.message); }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const currentYear = new Date().getFullYear();
  const cb          = parseFloat(currentBalance) || 0;

  // Year grouping
  const depositsByYear = {};
  deposits.forEach(d => {
    const yr = getDepYear(d);
    if (!depositsByYear[yr]) depositsByYear[yr] = [];
    depositsByYear[yr].push(d);
  });
  const depositYears = Object.keys(depositsByYear).map(Number).sort();
  const allYears     = [...new Set([...depositYears, currentYear])].sort().reverse();

  const getTotalForYear = (year) =>
    (depositsByYear[year] || []).reduce((s, d) => s + (d.amount || 0), 0);

  const maxedYears = depositYears.filter(y => getTotalForYear(y) >= getLimit(y));

  // Lifetime
  const lifetimeTotal = deposits.reduce((s, d) => s + (d.amount || 0), 0);
  const returns       = cb > 0 ? cb - lifetimeTotal : null;

  // This year
  const thisYearTotal  = getTotalForYear(currentYear);
  const thisYearLimit  = getLimit(currentYear);
  const contribPct     = Math.min(100, (thisYearTotal / thisYearLimit) * 100);
  const yearPct        = getYearPct();
  const ahead          = contribPct >= yearPct;

  // Projection
  const projYears   = Math.max(0, (parseInt(projTargetAge) || 65) - (parseInt(projAge) || 20));
  const projBal     = cb > 0 ? cb : lifetimeTotal;
  const projRate_n  = (parseFloat(projRate) || 7) / 100;
  const projected   = projBal > 0 ? projBal * Math.pow(1 + projRate_n, projYears) : 0;
  const projGains   = projected - projBal;

  // Live form preview
  const yearPreview = (() => {
    const amt = parseFloat(formAmt) || 0;
    if (amt <= 0) return null;
    const year     = formDate.getFullYear();
    const yearTotal = getTotalForYear(year);
    const limit    = getLimit(year);
    const newTotal = yearTotal + amt;
    return { year, yearTotal, newTotal, limit, over: newTotal > limit };
  })();

  // ── Handlers ───────────────────────────────────────────────────────────────

  const logDeposit = () => {
    triggerHaptic();
    const amt = parseFloat(formAmt);
    if (isNaN(amt) || amt <= 0) return Alert.alert('Invalid amount', 'Enter a positive amount.');

    const year      = formDate.getFullYear();
    const yearTotal = getTotalForYear(year);
    const limit     = getLimit(year);

    const doAdd = async () => {
      const entry   = { id: Date.now(), label: formLabel.trim() || 'Contribution', date: fmtDateKey(formDate), amount: amt };
      const updated = [...deposits, entry];
      setDeposits(updated);
      setFormLabel('');
      setFormAmt('');
      await persist(updated, currentBalance);
    };

    if (yearTotal + amt > limit) {
      Alert.alert(
        'Over limit',
        `This would bring ${year} to ${fmt$(yearTotal + amt)}, over the ${fmt$(limit)} limit. Add anyway?`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Add anyway', onPress: doAdd }],
      );
    } else {
      doAdd();
    }
  };

  const deleteDeposit = id => {
    Alert.alert('Remove contribution?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = deposits.filter(d => d.id !== id);
        setDeposits(updated);
        await persist(updated, currentBalance);
      }},
    ]);
  };

  const onDateChange = (event, selected) => {
    if (Platform.OS === 'android') setPicker({ show: false });
    if (!selected || event.type === 'dismissed') return;
    setFormDate(selected);
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={[s.centered]}><ActivityIndicator color={c.green} size="large" /></View>;
  }

  const sortedDeposits = [...deposits].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <View style={{ flex: 1 }}>
      {saved && (
        <View style={[s.savedBadge, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
          <Text style={[s.savedText, { color: c.green, fontFamily: MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Lifetime Dashboard ─────────────────────────────────── */}
        <View style={s.metRow}>
          <MetCard label="Lifetime Contributed" value={fmtBig(lifetimeTotal)} sub="all years"      color={c.green}  c={c} />
          <MetCard label="Current Balance"      value={cb > 0 ? fmtBig(cb) : '—'}  sub="account value" color={c.blue}   c={c} />
          <MetCard
            label="Total Returns"
            value={returns != null ? fmt$(returns, true) : '—'}
            sub={returns != null ? (returns >= 0 ? 'investment gains' : 'loss vs deposits') : 'gains vs deposits'}
            color={returns != null ? (returns >= 0 ? c.green : c.red) : undefined}
            c={c}
          />
          <MetCard
            label="Years Maxed"
            value={String(maxedYears.length)}
            sub={`of ${depositYears.length} year${depositYears.length !== 1 ? 's' : ''}`}
            color={c.green}
            c={c}
          />
          <MetCard label="Deposits"       value={String(deposits.length)} sub="all time"   c={c} />
          <MetCard label="Projected at 65" value={projected > 0 ? fmtBig(projected) : '—'} sub="@ 7% avg return" color={c.purple} fontSize={16} c={c} />
        </View>

        {/* ── Current Balance ────────────────────────────────────── */}
        <SecHeader title="Current Balance" open={open.balance} onToggle={() => toggle('balance')} c={c} />
        {open.balance && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <FLabel label="Current Account Balance ($)" c={c} />
            <TextInput
              style={[s.balanceInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.blue, fontFamily: MONO }]}
              value={currentBalance}
              onChangeText={setCurrentBalance}
              onBlur={() => persist(deposits, currentBalance)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={c.textMuted}
            />
            {cb > 0 && lifetimeTotal > 0 ? (
              <View style={s.returnsSplit}>
                <RsBlock label="Total Deposited" value={fmt$(lifetimeTotal)} color={c.blue} c={c} />
                <RsBlock
                  label="Returns"
                  value={fmt$(cb - lifetimeTotal, true)}
                  sub={cb - lifetimeTotal >= 0 ? 'gains so far' : 'loss so far'}
                  color={cb - lifetimeTotal >= 0 ? c.green : c.red}
                  c={c}
                />
              </View>
            ) : (
              <View style={s.returnsSplit}>
                <RsBlock label="Total Deposited" value={fmt$(lifetimeTotal)} color={c.blue} c={c} />
              </View>
            )}
            <Text style={[s.note, { color: c.textMuted, fontFamily: MONO, marginTop: 8 }]}>
              Update after checking your brokerage account. Returns are calculated automatically.
            </Text>
          </View>
        )}

        {/* ── Year-by-Year Progress ──────────────────────────────── */}
        <SecHeader title="Year-by-Year Progress" open={open.years} onToggle={() => toggle('years')} c={c} />
        {open.years && (
          allYears.length === 0 ? (
            <View style={[s.empty, { borderColor: c.borderSubtle }]}>
              <Text style={[s.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No contributions yet. Log your first contribution below.</Text>
            </View>
          ) : (
            allYears.map(year => {
              const yearTotal    = getTotalForYear(year);
              const limit        = getLimit(year);
              const pct          = Math.min(100, (yearTotal / limit) * 100);
              const maxed        = yearTotal >= limit;
              const isCurrent    = year === currentYear;
              const yearDeps     = depositsByYear[year] || [];
              const behind       = isCurrent && !maxed && pct < yearPct;
              const barColor     = maxed ? c.green : behind ? c.amber : c.green;

              return (
                <View key={year} style={[s.yearCard, { backgroundColor: c.bgCard, borderColor: maxed ? c.green : c.borderSubtle }]}>
                  {maxed && (
                    <View style={[s.maxedBadge, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                      <Text style={[s.maxedBadgeTxt, { color: c.green, fontFamily: MONO }]}>MAXED</Text>
                    </View>
                  )}
                  <View style={s.ycTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                      <Text style={[s.ycYear, { color: c.textPrimary, fontFamily: MONO }]}>{year}</Text>
                      {isCurrent && <Text style={[s.ycCurrent, { color: c.textMuted, fontFamily: MONO }]}>(current)</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                      <Text style={[s.ycContrib, { color: c.green, fontFamily: MONO }]}>{fmt$(yearTotal)}</Text>
                      <Text style={[s.ycLimit, { color: c.textMuted, fontFamily: MONO }]}>/ {fmt$(limit)}</Text>
                    </View>
                  </View>
                  <View style={[s.ycTrack, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
                    <View style={[s.ycFill, { width: `${pct.toFixed(2)}%`, backgroundColor: barColor }]} />
                  </View>
                  <View style={s.ycBottom}>
                    <Text style={[s.ycPct, { color: c.textMuted, fontFamily: MONO }]}>{pct.toFixed(1)}% of limit</Text>
                    <Text style={[s.ycCount, { color: c.textMuted, fontFamily: MONO }]}>
                      {yearDeps.length} contribution{yearDeps.length !== 1 ? 's' : ''}
                    </Text>
                    {isCurrent && !maxed && (
                      <Text style={[s.ycPace, { color: ahead ? c.green : c.amber, fontFamily: MONO }]}>
                        {ahead ? 'Ahead of pace' : 'Behind pace'}
                      </Text>
                    )}
                    {maxed && (
                      <View style={[s.pill, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                        <Text style={[s.pillTxt, { color: c.green, fontFamily: MONO }]}>Maxed Out</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )
        )}

        {/* ── Maxout History ─────────────────────────────────────── */}
        <SecHeader title="Maxout History" open={open.maxout} onToggle={() => toggle('maxout')} c={c} />
        {open.maxout && (
          maxedYears.length === 0 ? (
            <View style={[s.empty, { borderColor: c.borderSubtle }]}>
              <Text style={[s.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No years maxed out yet.</Text>
            </View>
          ) : (
            <View style={s.maxoutRow}>
              {[...maxedYears].sort().reverse().map(year => (
                <View key={year} style={[s.maxoutBadge, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                  <Text style={[s.moBadgeYear, { color: c.green,       fontFamily: MONO }]}>{year}</Text>
                  <Text style={[s.moBadgeAmt,  { color: c.textPrimary, fontFamily: MONO }]}>{fmt$(getLimit(year))}</Text>
                  <Text style={[s.moBadgeCheck,{ color: c.green }]}>✓</Text>
                </View>
              ))}
            </View>
          )
        )}

        {/* ── Log a Contribution ─────────────────────────────────── */}
        <SecHeader title="Log a Contribution" open={open.log} onToggle={() => toggle('log')} c={c} />
        {open.log && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <FLabel label="Label (optional)" c={c} />
            <TextInput
              style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              placeholder="e.g. Summer contribution"
              placeholderTextColor={c.textMuted}
              value={formLabel}
              onChangeText={setFormLabel}
            />

            <View style={s.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <FLabel label="Date" c={c} />
                <TouchableOpacity style={[s.dtBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]} onPress={() => setPicker({ show: true })}>
                  <Text style={[s.dtText, { color: c.textPrimary, fontFamily: MONO }]}>
                    {formDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <FLabel label="Amount ($)" c={c} />
                <TextInput
                  style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.green, fontFamily: MONO }]}
                  placeholder="0.00"
                  placeholderTextColor={c.textMuted}
                  value={formAmt}
                  onChangeText={setFormAmt}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Live year preview */}
            {yearPreview && (
              <Text style={[s.yearPreview, { color: yearPreview.over ? c.red : c.textMuted, fontFamily: MONO }]}>
                {yearPreview.year} contribution: {fmt$(yearPreview.yearTotal)} → {fmt$(yearPreview.newTotal)} / {fmt$(yearPreview.limit)} limit
              </Text>
            )}

            <TouchableOpacity style={[s.addBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]} onPress={logDeposit}>
              <Text style={[s.addBtnTxt, { color: c.green, fontFamily: MONO }]}>+ Log Contribution</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Date picker */}
        {picker.show && Platform.OS === 'android' && (
          <DateTimePicker value={formDate} mode="date" display="default" onChange={onDateChange} />
        )}
        {picker.show && Platform.OS === 'ios' && (
          <Modal transparent animationType="slide">
            <View style={s.modalOverlay}>
              <View style={[s.modalSheet, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                <TouchableOpacity onPress={() => setPicker({ show: false })} style={s.doneBtn}>
                  <Text style={[s.doneTxt, { color: c.blue, fontFamily: MONO }]}>Done</Text>
                </TouchableOpacity>
                <DateTimePicker value={formDate} mode="date" display="spinner" onChange={onDateChange} textColor={c.textPrimary} />
              </View>
            </View>
          </Modal>
        )}

        {/* ── This Year's Pace ───────────────────────────────────── */}
        <SecHeader title="This Year's Pace" open={open.pace} onToggle={() => toggle('pace')} c={c} />
        {open.pace && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <PaceBar label="Contributed"  pct={contribPct} color={c.green} c={c} />
            <PaceBar label="Year elapsed" pct={yearPct}    color={c.blue}  c={c} />
            <Text style={[s.note, { color: c.textMuted, fontFamily: MONO }]}>
              {thisYearTotal >= thisYearLimit
                ? `${currentYear} is maxed out at ${fmt$(thisYearLimit)}.`
                : ahead
                ? `You are ahead of pace to max ${currentYear} by Dec 31. ${fmt$(thisYearLimit - thisYearTotal)} remaining.`
                : `You are behind pace to max ${currentYear} by Dec 31. ${fmt$(thisYearLimit - thisYearTotal)} remaining.`}
            </Text>
          </View>
        )}

        {/* ── All Contributions ──────────────────────────────────── */}
        <SecHeader title={`All Contributions (${deposits.length})`} open={open.deposits} onToggle={() => toggle('deposits')} c={c} />
        {open.deposits && (
          sortedDeposits.length === 0 ? (
            <View style={[s.empty, { borderColor: c.borderSubtle }]}>
              <Text style={[s.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No contributions logged yet.</Text>
            </View>
          ) : (
            sortedDeposits.map(dep => {
              const yr = getDepYear(dep);
              return (
                <View key={dep.id} style={[s.depItem, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.depLabel, { color: c.textPrimary, fontFamily: MONO }]}>{dep.label || 'Contribution'}</Text>
                    <Text style={[s.depDate,  { color: c.textMuted,    fontFamily: MONO }]}>{fmtDisplay(dep.date)}</Text>
                  </View>
                  <View style={s.depRight}>
                    <View style={[s.yearPill, { backgroundColor: c.blueGlow, borderColor: c.blue }]}>
                      <Text style={[s.yearPillTxt, { color: c.blue, fontFamily: MONO }]}>{yr}</Text>
                    </View>
                    <Text style={[s.depAmt, { color: c.green, fontFamily: MONO }]}>{fmt$(dep.amount)}</Text>
                    <TouchableOpacity onPress={() => deleteDeposit(dep.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )
        )}

        {/* ── Growth Projection ──────────────────────────────────── */}
        <SecHeader title="Growth Projection" open={open.projection} onToggle={() => toggle('projection')} c={c} />
        {open.projection && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <View style={s.projInputsRow}>
              {[
                { label: 'Annual Return %', value: projRate,      setter: setProjRate,      kbType: 'decimal-pad' },
                { label: 'Your Age',        value: projAge,       setter: setProjAge,       kbType: 'number-pad'  },
                { label: 'Target Age',      value: projTargetAge, setter: setProjTargetAge, kbType: 'number-pad'  },
              ].map(({ label, value, setter, kbType }) => (
                <View key={label} style={{ flex: 1 }}>
                  <FLabel label={label} c={c} />
                  <TextInput
                    style={[s.projInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                    value={value} onChangeText={setter}
                    keyboardType={kbType} placeholder="—" placeholderTextColor={c.textMuted}
                  />
                </View>
              ))}
            </View>

            {projected > 0 ? (
              <>
                <Text style={[s.projNumber, { color: c.green, fontFamily: MONO }]}>{fmtBig(projected)}</Text>
                <Text style={[s.note, { color: c.textMuted, fontFamily: MONO }]}>projected balance</Text>
                <View style={s.returnsSplit}>
                  <RsBlock label="Starting Balance"   value={fmtBig(projBal)}   color={c.blue}  c={c} />
                  <RsBlock label="Projected Returns"  value={fmtBig(projGains)} sub={`over ${projYears} years`} color={c.green} c={c} />
                </View>
                <Text style={[s.note, { color: c.textMuted, fontFamily: MONO, marginTop: 8 }]}>
                  Starting from {fmtBig(projBal)} at {projRate || 7}% annual return over {projYears} years. Simplified estimate — actual returns will vary.
                </Text>
              </>
            ) : (
              <Text style={[s.note, { color: c.textMuted, fontFamily: MONO, marginTop: 8 }]}>
                Log contributions or set a current balance to see your projection.
              </Text>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: 14, paddingBottom: 60 },
  metRow:    { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  formRow:   { flexDirection: 'row', alignItems: 'flex-start' },
  note:      { fontSize: 10, lineHeight: 16 },

  card:      { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 6 },

  balanceInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, fontWeight: '600', marginBottom: 10 },
  returnsSplit: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },

  // Year cards
  yearCard:    { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 10, position: 'relative' },
  maxedBadge:  { position: 'absolute', top: 10, right: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  maxedBadgeTxt:{ fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  ycTop:       { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  ycYear:      { fontSize: 18, fontWeight: '700' },
  ycCurrent:   { fontSize: 11 },
  ycContrib:   { fontSize: 15, fontWeight: '700' },
  ycLimit:     { fontSize: 13 },
  ycTrack:     { height: 8, borderRadius: 4, borderWidth: 1, overflow: 'hidden', marginBottom: 6 },
  ycFill:      { height: '100%', borderRadius: 4 },
  ycBottom:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  ycPct:       { fontSize: 11, fontWeight: '600' },
  ycCount:     { fontSize: 10 },
  ycPace:      { fontSize: 10, fontWeight: '600' },
  pill:        { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  pillTxt:     { fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  // Maxout history
  maxoutRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  maxoutBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', minWidth: 70 },
  moBadgeYear: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  moBadgeAmt:  { fontSize: 12, fontWeight: '600', marginTop: 2 },
  moBadgeCheck:{ fontSize: 16, marginTop: 2 },

  // Log form
  input:      { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, marginBottom: 2 },
  dtBtn:      { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  dtText:     { fontSize: 12 },
  yearPreview:{ fontSize: 11, marginBottom: 8, marginTop: 4 },
  addBtn:     { borderWidth: 1, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 20, alignSelf: 'flex-end', marginTop: 12 },
  addBtnTxt:  { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  // Deposit list
  depItem:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 5, gap: 10 },
  depLabel:   { fontSize: 12, fontWeight: '500' },
  depDate:    { fontSize: 11, marginTop: 1 },
  depRight:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  depAmt:     { fontSize: 13, fontWeight: '600' },
  yearPill:   { borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  yearPillTxt:{ fontSize: 10, fontWeight: '600' },

  // Projection
  projInputsRow:{ flexDirection: 'row', gap: 8 },
  projInput:    { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 7, fontSize: 13, fontWeight: '600' },
  projNumber:   { fontSize: 32, fontWeight: '700', letterSpacing: -0.5, marginTop: 12, marginBottom: 2 },

  empty:     { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 28, alignItems: 'center', marginBottom: 6 },
  emptyTxt:  { fontSize: 12 },

  savedBadge: { position: 'absolute', bottom: 16, right: 16, zIndex: 99, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  savedText:  { fontSize: 11, fontWeight: '600' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:   { borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 },
  doneBtn:      { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  doneTxt:      { fontSize: 15, fontWeight: '600' },
});
