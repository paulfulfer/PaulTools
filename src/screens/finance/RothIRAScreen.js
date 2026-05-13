import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, Modal, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONO  = Platform.select({ ios: 'Menlo', android: 'monospace' });
const LIMIT = 7500;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n, signed = false) {
  const abs = '$' + Math.abs(Number(n) || 0).toFixed(2);
  if (!signed) return abs;
  const num = Number(n) || 0;
  return (num < 0 ? '-' : num > 0 ? '+' : '') + abs;
}

function fmtBig(n) {
  return '$' + Math.round(Math.abs(Number(n) || 0)).toLocaleString();
}

function fmtDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fmtDisplay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function getYearPct() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end   = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  return ((now - start) / (end - start)) * 100;
}

function projFinishDate(total, deposits) {
  if (deposits.length < 2) return null;
  const sorted = [...deposits].sort((a, b) => new Date(a.date) - new Date(b.date));
  const daysSince = Math.max(1, (Date.now() - new Date(sorted[0].date + 'T00:00:00')) / 86400000);
  const pace = total / daysSince;
  if (pace <= 0) return null;
  const rem = LIMIT - total;
  if (rem <= 0) return 'Done';
  const d = new Date();
  d.setDate(d.getDate() + Math.ceil(rem / pace));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  card:  { flex: 1, minWidth: '45%', borderWidth: 1, borderRadius: 8, padding: 10, margin: 3 },
  label: { fontSize: 9, letterSpacing: 0.8, marginBottom: 3 },
  value: { fontWeight: '600', letterSpacing: -0.3 },
  sub:   { fontSize: 9, marginTop: 2 },
});

function PaceBar({ label, pct, color, c }) {
  return (
    <View style={pb.row}>
      <Text style={[pb.label, { color: c.textMuted, fontFamily: MONO }]}>{label}</Text>
      <View style={[pb.track, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
        <View style={[pb.fill, { width: `${Math.min(100, pct).toFixed(1)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[pb.pct, { color: c.textPrimary, fontFamily: MONO }]}>{Math.round(pct)}%</Text>
    </View>
  );
}
const pb = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  label: { width: 100, fontSize: 11 },
  track: { flex: 1, height: 7, borderRadius: 4, borderWidth: 1, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 4 },
  pct:   { width: 36, textAlign: 'right', fontSize: 11, fontWeight: '600' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RothIRAScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;

  // ── Data ────────────────────────────────────────────────
  const [deposits,         setDeposits]         = useState([]);
  const [currentBalance,   setCurrentBalance]   = useState('');
  const [beginningBalance, setBeginningBalance] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved,   setSaved]   = useState(false);

  // ── Sections ────────────────────────────────────────────
  const [open, setOpen] = useState({ balance: true, returns: true, pace: true, projection: true, entry: true, history: true });
  const toggle = key => setOpen(p => ({ ...p, [key]: !p[key] }));

  // ── Deposit form ────────────────────────────────────────
  const [formLabel, setFormLabel] = useState('');
  const [formDate,  setFormDate]  = useState(new Date());
  const [formAmt,   setFormAmt]   = useState('');
  const [picker,    setPicker]    = useState({ show: false });

  // ── Projection inputs ───────────────────────────────────
  const [projRate,      setProjRate]      = useState('7');
  const [projAge,       setProjAge]       = useState('20');
  const [projTargetAge, setProjTargetAge] = useState('65');

  // ── Firestore ───────────────────────────────────────────
  // Shares the same doc as ExpenseLog and other shim pages
  const docRef = () =>
    firebase.firestore()
      .collection('users').doc(user.uid)
      .collection('localStorage').doc('data');

  // ── Load ────────────────────────────────────────────────
  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await docRef().get();
      const data = snap.exists ? snap.data() : {};
      setDeposits(JSON.parse(data.ira_deposits || '[]'));
      setCurrentBalance(data.ira_current_balance   || '');
      setBeginningBalance(data.ira_beginning_balance || '');
    } catch (err) {
      Alert.alert('Load error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const persist = async (deps, cb, bb) => {
    try {
      await docRef().set(
        {
          ira_deposits:          JSON.stringify(deps),
          ira_current_balance:   cb,
          ira_beginning_balance: bb,
        },
        { merge: true },
      );
      flash();
    } catch (err) {
      Alert.alert('Save error', err.message);
    }
  };

  const onBalanceBlur = () => persist(deposits, currentBalance, beginningBalance);

  // ── Computed ────────────────────────────────────────────
  const total     = deposits.reduce((s, d) => s + (d.amount || 0), 0);
  const remaining = Math.max(0, LIMIT - total);
  const contribPct = Math.min(100, (total / LIMIT) * 100);
  const yearPct   = getYearPct();
  const ahead     = contribPct >= yearPct;
  const cb        = parseFloat(currentBalance)   || 0;
  const bb        = parseFloat(beginningBalance) || 0;
  const returns       = cb - total;
  const sinceStart    = cb - bb;
  const projFinish    = projFinishDate(total, deposits);

  const projYears  = Math.max(0, (parseInt(projTargetAge) || 65) - (parseInt(projAge) || 20));
  const projBal    = cb > 0 ? cb : total;
  const projRate_n = (parseFloat(projRate) || 7) / 100;
  const projected  = projBal * Math.pow(1 + projRate_n, projYears);
  const projGains  = projected - projBal;

  // ── Log deposit ─────────────────────────────────────────
  const logDeposit = () => {
    const amt = parseFloat(formAmt);
    if (isNaN(amt) || amt <= 0) return Alert.alert('Invalid amount', 'Enter a positive amount.');

    const doAdd = async () => {
      const entry = { id: Date.now(), label: formLabel.trim() || 'Deposit', date: fmtDateKey(formDate), amount: amt };
      const updated = [...deposits, entry];
      setDeposits(updated);
      setFormLabel('');
      setFormAmt('');
      await persist(updated, currentBalance, beginningBalance);
    };

    if (total + amt > LIMIT) {
      Alert.alert(
        'Over limit',
        `This deposit would bring your total to ${fmt$(total + amt)}, over the $${LIMIT.toLocaleString()} limit. Add anyway?`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Add anyway', onPress: doAdd }],
      );
    } else {
      doAdd();
    }
  };

  // ── Delete deposit ──────────────────────────────────────
  const deleteDeposit = id => {
    Alert.alert('Remove deposit?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const updated = deposits.filter(d => d.id !== id);
          setDeposits(updated);
          await persist(updated, currentBalance, beginningBalance);
        },
      },
    ]);
  };

  // ── Date picker ─────────────────────────────────────────
  const onDateChange = (event, selected) => {
    if (Platform.OS === 'android') setPicker({ show: false });
    if (!selected || event.type === 'dismissed') return;
    setFormDate(selected);
  };

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: c.bgBase }]}>
        <ActivityIndicator color={c.green} size="large" />
      </View>
    );
  }

  const sortedDeposits = [...deposits].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <View style={{ flex: 1, backgroundColor: c.bgBase }}>

      {saved && (
        <View style={[s.savedBadge, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
          <Text style={[s.savedText, { color: c.green, fontFamily: MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Account Balance ──────────────────────────── */}
        <SecHeader title="Account Balance" open={open.balance} onToggle={() => toggle('balance')} c={c} />
        {open.balance && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <View style={s.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <FLabel label="Current Balance ($)" c={c} />
                <TextInput
                  style={[s.balanceInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.blue, fontFamily: MONO }]}
                  value={currentBalance}
                  onChangeText={setCurrentBalance}
                  onBlur={onBalanceBlur}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={c.textMuted}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <FLabel label="Beginning Balance ($)" c={c} />
                <TextInput
                  style={[s.balanceInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={beginningBalance}
                  onChangeText={setBeginningBalance}
                  onBlur={onBalanceBlur}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={c.textMuted}
                />
              </View>
            </View>
            <Text style={[s.note, { color: c.textMuted, fontFamily: MONO }]}>
              Update current balance after checking your account. Beginning balance tracks growth since Jan 1.
            </Text>
          </View>
        )}

        {/* ── Progress Hero ────────────────────────────── */}
        <View style={[s.hero, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
          <View style={s.heroTop}>
            <Text style={[s.heroAmt, { color: c.green, fontFamily: MONO }]}>{fmt$(total)}</Text>
            <Text style={[s.heroLimit, { color: c.textMuted, fontFamily: MONO }]}>deposited toward ${LIMIT.toLocaleString()} limit</Text>
          </View>
          <View style={[s.heroTrack, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
            <View style={[s.heroFill, { width: `${contribPct.toFixed(2)}%`, backgroundColor: c.green }]} />
          </View>
          <View style={s.heroBottom}>
            <Text style={[s.heroPct,       { color: c.green,    fontFamily: MONO }]}>{contribPct.toFixed(1)}% complete</Text>
            <Text style={[s.heroRemaining, { color: c.textMuted, fontFamily: MONO }]}>{fmt$(remaining)} remaining</Text>
          </View>
        </View>

        {/* ── Metrics ─────────────────────────────────── */}
        <View style={s.metRow}>
          <MetCard label="Deposited (2026)" value={fmt$(total)}      sub="year to date"  color={c.green}       c={c} />
          <MetCard label="Limit Remaining"  value={fmt$(remaining)}  sub="to hit limit"  color={c.blue}        c={c} />
          <MetCard
            label="On Track"
            value={total >= LIMIT ? 'Maxed' : ahead ? 'Ahead' : 'Behind'}
            sub={total >= LIMIT ? 'limit reached' : ahead ? `${(contribPct - yearPct).toFixed(1)}% ahead` : `${(yearPct - contribPct).toFixed(1)}% behind`}
            color={total >= LIMIT ? c.green : ahead ? c.green : c.amber}
            c={c}
          />
          <MetCard
            label="Proj. Finish"
            value={projFinish || '—'}
            sub={projFinish === 'Done' ? 'limit reached' : projFinish ? 'at current pace' : 'log more deposits'}
            color={c.textPrimary}
            fontSize={projFinish ? 13 : 18}
            c={c}
          />
        </View>

        {/* ── Balance & Returns ────────────────────────── */}
        <SecHeader title="Balance & Returns" open={open.returns} onToggle={() => toggle('returns')} c={c} />
        {open.returns && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <View style={s.returnsSplit}>
              <RetBlock label="Deposited Total"    value={fmt$(total)}                   sub="sum of all deposits"              color={c.green}                                 c={c} />
              <RetBlock label="Current Balance"    value={fmt$(cb)}                      sub="as entered above"                 color={c.blue}                                  c={c} />
              <RetBlock label="Est. Returns"       value={fmt$(returns, true)}           sub={returns >= 0 ? 'investment gains' : 'loss vs deposits'} color={returns >= 0 ? c.green : c.red} c={c} />
              <RetBlock label="Return Since Jan 1" value={fmt$(sinceStart, true)}        sub={sinceStart >= 0 ? 'growth since Jan 1' : 'decline since Jan 1'} color={sinceStart >= 0 ? c.green : c.red} c={c} />
            </View>
            <Text style={[s.note, { color: c.textMuted, fontFamily: MONO, marginTop: 12 }]}>
              Returns = current balance − deposits. Set beginning balance to track growth since Jan 1.
            </Text>
          </View>
        )}

        {/* ── Year Pace ────────────────────────────────── */}
        <SecHeader title="Year Pace" open={open.pace} onToggle={() => toggle('pace')} c={c} />
        {open.pace && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <PaceBar label="Contributed"  pct={contribPct} color={c.green} c={c} />
            <PaceBar label="Year elapsed" pct={yearPct}    color={c.blue}  c={c} />
            <Text style={[s.note, { color: c.textMuted, fontFamily: MONO }]}>
              {ahead ? 'You are ahead of a straight-line pace to max by Dec 31.' : 'You are behind a straight-line pace to max by Dec 31.'}
            </Text>
          </View>
        )}

        {/* ── Long-Term Projection ─────────────────────── */}
        <SecHeader title="Long-Term Projection" open={open.projection} onToggle={() => toggle('projection')} c={c} />
        {open.projection && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <View style={s.row}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <FLabel label="Return Rate (%)" c={c} />
                <TextInput style={[s.projInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={projRate} onChangeText={setProjRate} keyboardType="decimal-pad" placeholder="7" placeholderTextColor={c.textMuted} />
              </View>
              <View style={{ flex: 1, marginHorizontal: 6 }}>
                <FLabel label="Current Age" c={c} />
                <TextInput style={[s.projInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={projAge} onChangeText={setProjAge} keyboardType="number-pad" placeholder="20" placeholderTextColor={c.textMuted} />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <FLabel label="Target Age" c={c} />
                <TextInput style={[s.projInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={projTargetAge} onChangeText={setProjTargetAge} keyboardType="number-pad" placeholder="65" placeholderTextColor={c.textMuted} />
              </View>
            </View>

            <View style={s.metRow}>
              <MetCard label="Years to Grow"     value={String(projYears)}    color={c.blue}        c={c} />
              <MetCard label="Projected Balance" value={fmtBig(projected)}    sub="at target age"   color={c.green}       c={c} />
              <MetCard label="Starting Balance"  value={fmtBig(projBal)}      color={c.textPrimary} c={c} />
              <MetCard label="Est. Returns"      value={fmtBig(projGains)}    sub="investment gains" color={c.purple}     c={c} />
            </View>

            <Text style={[s.note, { color: c.textMuted, fontFamily: MONO }]}>
              Starting from {cb > 0 ? 'current balance' : 'deposited total'} of {fmtBig(projBal)}, at {projRate || 7}% annual return over {projYears} years → {fmtBig(projected)} at age {projTargetAge}. Simplified estimate — actual returns will vary.
            </Text>
          </View>
        )}

        {/* ── Log a Deposit ────────────────────────────── */}
        <SecHeader title="Log a Deposit" open={open.entry} onToggle={() => toggle('entry')} c={c} />
        {open.entry && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <FLabel label="Label" c={c} />
            <TextInput
              style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              placeholder="e.g. May contribution"
              placeholderTextColor={c.textMuted}
              value={formLabel}
              onChangeText={setFormLabel}
            />

            <View style={s.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <FLabel label="Date" c={c} />
                <TouchableOpacity style={[s.dtBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]} onPress={() => setPicker({ show: true })}>
                  <Text style={[s.dtText, { color: c.textPrimary, fontFamily: MONO }]}>
                    {formDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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

            <TouchableOpacity style={[s.addBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]} onPress={logDeposit}>
              <Text style={[s.addBtnTxt, { color: c.green, fontFamily: MONO }]}>+ Add Deposit</Text>
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

        {/* ── Deposit History ──────────────────────────── */}
        <SecHeader title={`Deposit History (${deposits.length})`} open={open.history} onToggle={() => toggle('history')} c={c} />
        {open.history && (
          sortedDeposits.length === 0 ? (
            <View style={[s.empty, { borderColor: c.borderSubtle }]}>
              <Text style={[s.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No deposits logged yet.</Text>
            </View>
          ) : (
            sortedDeposits.map(dep => (
              <View key={dep.id} style={[s.depItem, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.depLabel, { color: c.textPrimary, fontFamily: MONO }]}>{dep.label || 'Deposit'}</Text>
                  <Text style={[s.depDate,  { color: c.textMuted,    fontFamily: MONO }]}>{fmtDisplay(dep.date)}</Text>
                </View>
                <View style={s.depRight}>
                  <Text style={[s.depAmt, { color: c.green, fontFamily: MONO }]}>{fmt$(dep.amount)}</Text>
                  <TouchableOpacity onPress={() => deleteDeposit(dep.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        )}

      </ScrollView>
    </View>
  );
}

// ─── RetBlock (used only in returns section) ──────────────────────────────────

function RetBlock({ label, value, sub, color, c }) {
  return (
    <View style={[rb.block, { backgroundColor: c.bgBase }]}>
      <Text style={[rb.label, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[rb.value, { color, fontFamily: MONO }]}>{value}</Text>
      {!!sub && <Text style={[rb.sub, { color: c.textMuted, fontFamily: MONO }]}>{sub}</Text>}
    </View>
  );
}
const rb = StyleSheet.create({
  block: { flex: 1, minWidth: '45%', borderRadius: 8, padding: 12, margin: 3 },
  label: { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, marginBottom: 4 },
  value: { fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
  sub:   { fontSize: 10, marginTop: 3 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: 14, paddingBottom: 60 },
  metRow:    { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 4 },
  row:       { flexDirection: 'row', alignItems: 'flex-start' },

  card:      { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 6 },
  note:      { fontSize: 10, lineHeight: 16 },

  balanceInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, fontWeight: '600' },

  hero:         { borderWidth: 1, borderRadius: 12, padding: 18, marginBottom: 10, marginTop: 6 },
  heroTop:      { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  heroAmt:      { fontSize: 28, fontWeight: '600', letterSpacing: -0.5 },
  heroLimit:    { fontSize: 12 },
  heroTrack:    { height: 10, borderRadius: 5, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  heroFill:     { height: '100%', borderRadius: 5 },
  heroBottom:   { flexDirection: 'row', justifyContent: 'space-between' },
  heroPct:      { fontSize: 12, fontWeight: '600' },
  heroRemaining:{ fontSize: 12 },

  returnsSplit: { flexDirection: 'row', flexWrap: 'wrap' },

  projInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 7, fontSize: 13, fontWeight: '600' },

  input:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12 },
  dtBtn:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  dtText:    { fontSize: 12 },
  addBtn:    { borderWidth: 1, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 20, alignSelf: 'flex-end', marginTop: 12 },
  addBtnTxt: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  depItem:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 5, gap: 10 },
  depLabel:  { fontSize: 12, fontWeight: '500' },
  depDate:   { fontSize: 11, marginTop: 1 },
  depRight:  { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 },
  depAmt:    { fontSize: 13, fontWeight: '600' },

  empty:     { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 28, alignItems: 'center', marginBottom: 6 },
  emptyTxt:  { fontSize: 12 },

  savedBadge: { position: 'absolute', bottom: 16, right: 16, zIndex: 99, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  savedText:  { fontSize: 11, fontWeight: '600' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:   { borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 },
  doneBtn:      { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  doneTxt:      { fontSize: 15, fontWeight: '600' },
});
