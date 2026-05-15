import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, Modal, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const CATEGORIES = ['Equipment', 'Golf', 'Gas', 'Food', 'Social', 'Subscriptions', 'Emergency', 'Other'];

const CAT_COLOR = {
  Equipment:     '#9b87f5',
  Golf:          '#4a9eff',
  Gas:           '#e6a020',
  Food:          '#1fbd8a',
  Social:        '#f06292',
  Subscriptions: '#888888',
  Emergency:     '#555555',
  Other:         '#aaaaaa',
};

const FREQS      = ['monthly', 'annual', 'weekly'];
const FREQ_LABEL = { monthly: '/mo', annual: '/yr', weekly: '/wk' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n)  { return '$' + Math.abs(Number(n) || 0).toFixed(2); }

function fmtDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function fmtDisplay(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtRenewal(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + 'T00:00:00') - today) / 86400000);
}

function monthlyEq(sub) {
  switch (sub.freq) {
    case 'annual':  return sub.amount / 12;
    case 'weekly':  return sub.amount * (52 / 12);
    default:        return sub.amount;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetCard({ label, value, sub, color, c }) {
  return (
    <View style={[mc.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
      <Text style={[mc.label, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[mc.value, { color, fontFamily: MONO }]}>{value}</Text>
      {!!sub && <Text style={[mc.sub, { color: c.textMuted, fontFamily: MONO }]}>{sub}</Text>}
    </View>
  );
}
const mc = StyleSheet.create({
  card:  { flex: 1, minWidth: '45%', borderWidth: 1, borderRadius: 8, padding: 10, margin: 3 },
  label: { fontSize: 9, letterSpacing: 0.8, marginBottom: 3 },
  value: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  sub:   { fontSize: 9, marginTop: 2 },
});

function SecHeader({ title, open, onToggle, right, c }) {
  return (
    <TouchableOpacity style={[sh.row, { borderBottomColor: c.borderSubtle }]} onPress={onToggle} activeOpacity={0.7}>
      <Text style={[sh.label, { color: c.textMuted, fontFamily: MONO }]}>{title.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {right}
        <Text style={[sh.arrow, { color: c.textMuted }]}>{open ? '▲' : '▼'}</Text>
      </View>
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

// ─── Donut Chart (pure View — no native deps) ────────────────────────────────
//
// Each slice ≤ 180° is drawn with a rotated half-rectangle clipped inside
// a circle container. Slices > 180° are split into two halves.
// A centered hole View creates the donut effect.

function PieHalf({ startDeg, deg, color, size }) {
  const R = size / 2;
  return (
    <View style={{
      position: 'absolute',
      width: R, height: size, left: R,
      overflow: 'hidden',
      transform: [
        { translateX: -(R / 2) },
        { rotate: `${startDeg}deg` },
        { translateX: R / 2 },
      ],
    }}>
      <View style={{
        position: 'absolute',
        width: size, height: size, right: 0,
        borderRadius: R,
        backgroundColor: color,
        transform: [{ rotate: `${deg - 180}deg` }],
      }} />
    </View>
  );
}

function PieSlice({ startDeg, deg, color, size }) {
  if (deg <= 0) return null;
  if (deg > 180) {
    return (
      <>
        <PieHalf startDeg={startDeg}       deg={180}       color={color} size={size} />
        <PieHalf startDeg={startDeg + 180} deg={deg - 180} color={color} size={size} />
      </>
    );
  }
  return <PieHalf startDeg={startDeg} deg={deg} color={color} size={size} />;
}

function DonutChart({ catSorted, total, c }) {
  if (!catSorted.length || total === 0) return null;

  const SIZE = 160;
  const HOLE = 68;
  const R    = SIZE / 2;

  let cumDeg = -90; // start from top
  const slices = catSorted
    .filter(([, v]) => v > 0)
    .map(([cat, val]) => {
      const deg = (val / total) * 360;
      const s = { cat, startDeg: cumDeg, deg };
      cumDeg += deg;
      return s;
    });

  return (
    <View style={{ alignItems: 'center', marginVertical: 10 }}>
      <View style={{ width: SIZE, height: SIZE }}>
        {/* Circle container clips all slices */}
        <View style={{
          position: 'absolute', width: SIZE, height: SIZE,
          borderRadius: R, overflow: 'hidden',
          backgroundColor: c.bgBase,
        }}>
          {slices.map(({ cat, startDeg, deg }) => (
            <PieSlice key={cat} startDeg={startDeg} deg={deg} color={CAT_COLOR[cat] || '#aaa'} size={SIZE} />
          ))}
        </View>
        {/* Donut hole */}
        <View style={{
          position: 'absolute',
          width: HOLE, height: HOLE, borderRadius: HOLE / 2,
          backgroundColor: c.bgCard,
          top: R - HOLE / 2, left: R - HOLE / 2,
        }} />
      </View>
    </View>
  );
}

// ─── Add Subscription Modal ───────────────────────────────────────────────────

const AddSubModal = React.memo(function AddSubModal({ visible, onClose, onSave }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [name,    setName]    = useState('');
  const [amount,  setAmount]  = useState('');
  const [freq,    setFreq]    = useState('monthly');
  const [renewal, setRenewal] = useState(new Date());
  const [picker,  setPicker]  = useState(false);

  useEffect(() => {
    if (visible) { setName(''); setAmount(''); setFreq('monthly'); setRenewal(new Date()); setPicker(false); }
  }, [visible]);

  const handleSave = () => {
    if (!name.trim()) return Alert.alert('Required', 'Enter a subscription name.');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return Alert.alert('Required', 'Enter a valid amount.');
    onSave({ name: name.trim(), amount: amt, freq, renewalDate: fmtDateKey(renewal) });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sm.overlay}>
        <View style={[sm.sheet, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
          <View style={[sm.header, { borderBottomColor: c.borderSubtle }]}>
            <Text style={[sm.title, { color: c.textPrimary, fontFamily: MONO }]}>Add Subscription</Text>
            <TouchableOpacity onPress={onClose} style={[sm.closeBtn, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
              <Text style={{ color: c.textMuted, fontSize: 14 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={sm.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <FLabel label="Name" c={c} />
            <TextInput
              style={[sm.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              value={name} onChangeText={setName}
              placeholder="e.g. Netflix, Spotify, iCloud..." placeholderTextColor={c.textMuted} autoCorrect={false}
            />

            <FLabel label="Amount ($)" c={c} />
            <TextInput
              style={[sm.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.amber, fontFamily: MONO }]}
              value={amount} onChangeText={setAmount}
              placeholder="0.00" placeholderTextColor={c.textMuted} keyboardType="decimal-pad"
            />

            <FLabel label="Frequency" c={c} />
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
              {FREQS.map(f => (
                <TouchableOpacity key={f} onPress={() => setFreq(f)}
                  style={[sm.freqBtn, {
                    borderColor:     freq === f ? c.amber : c.borderSubtle,
                    backgroundColor: freq === f ? c.amberGlow : 'transparent',
                  }]}>
                  <Text style={[sm.freqTxt, { color: freq === f ? c.amber : c.textMuted, fontFamily: MONO }]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FLabel label="Next Renewal Date" c={c} />
            <TouchableOpacity style={[sm.dateBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]} onPress={() => setPicker(true)}>
              <Text style={[sm.dateTxt, { color: c.textPrimary, fontFamily: MONO }]}>
                {renewal.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </TouchableOpacity>

            {picker && Platform.OS === 'android' && (
              <DateTimePicker value={renewal} mode="date" display="default"
                onChange={(e, d) => { setPicker(false); if (d) setRenewal(d); }} />
            )}
            {picker && Platform.OS === 'ios' && (
              <>
                <DateTimePicker value={renewal} mode="date" display="spinner"
                  onChange={(e, d) => { if (d) setRenewal(d); }} />
                <TouchableOpacity onPress={() => setPicker(false)} style={{ alignItems: 'flex-end', paddingRight: 4, paddingTop: 4 }}>
                  <Text style={{ color: c.blue, fontWeight: '600', fontFamily: MONO }}>Done</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={[sm.actions, { borderTopColor: c.borderSubtle }]}>
              <TouchableOpacity onPress={onClose} style={[sm.btn, { borderColor: c.borderSubtle }]}>
                <Text style={[sm.btnTxt, { color: c.textMuted, fontFamily: MONO }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={[sm.btn, { borderColor: c.amber, backgroundColor: c.amberGlow }]}>
                <Text style={[sm.btnTxt, { color: c.amber, fontFamily: MONO }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});
const sm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:   { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, overflow: 'hidden' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  title:   { fontSize: 15, fontWeight: '600', flex: 1 },
  closeBtn:{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body:    { padding: 16, paddingBottom: 40 },
  input:   { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, marginBottom: 2 },
  freqBtn: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  freqTxt: { fontSize: 11, fontWeight: '600' },
  dateBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  dateTxt: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  btn:     { flex: 1, borderWidth: 1, borderRadius: 20, paddingVertical: 7, alignItems: 'center' },
  btnTxt:  { fontSize: 12, fontWeight: '600' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExpenseLogScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;

  const [entries, setEntries] = useState([]);
  const [subs,    setSubs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved,   setSaved]   = useState(false);

  const [open, setOpen] = useState({ entry: true, subs: true, breakdown: true, log: true });
  const toggle = key => setOpen(p => ({ ...p, [key]: !p[key] }));

  const [formDesc, setFormDesc] = useState('');
  const [formCat,  setFormCat]  = useState('Food');
  const [formDate, setFormDate] = useState(new Date());
  const [formAmt,  setFormAmt]  = useState('');
  const [picker,   setPicker]   = useState({ show: false });

  const [addSubModal, setAddSubModal] = useState(false);

  const subsRef = useRef(subs);
  useEffect(() => { subsRef.current = subs; }, [subs]);

  // ── Firestore ────────────────────────────────────────────

  const docRef = () =>
    firebase.firestore().collection('users').doc(user.uid).collection('localStorage').doc('data');

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await docRef().get();
      const d    = snap.exists ? snap.data() : {};
      setEntries(JSON.parse(d.explog_entries || '[]'));
      setSubs(JSON.parse(d.explog_subs || '[]'));
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const persistEntries = async (updated) => {
    try { await docRef().set({ explog_entries: JSON.stringify(updated) }, { merge: true }); flash(); }
    catch (err) { Alert.alert('Save error', err.message); }
  };

  const persistSubs = async (updated) => {
    try { await docRef().set({ explog_subs: JSON.stringify(updated) }, { merge: true }); flash(); }
    catch (err) { Alert.alert('Save error', err.message); }
  };

  // ── Metrics ──────────────────────────────────────────────

  const total       = entries.reduce((s, e) => s + (e.amt || 0), 0);
  const now         = new Date();
  const monthTotal  = entries
    .filter(e => { const d = new Date(e.date + 'T12:00:00'); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
    .reduce((s, e) => s + (e.amt || 0), 0);
  const monthName   = now.toLocaleString('en-US', { month: 'long' });
  const largest     = entries.length > 0 ? entries.reduce((a, b) => (a.amt > b.amt ? a : b)) : null;

  const catTotals   = {};
  entries.forEach(e => { catTotals[e.cat] = (catTotals[e.cat] || 0) + (e.amt || 0); });
  const catSorted   = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  const monthlyBurn = subs.reduce((acc, s) => acc + monthlyEq(s), 0);
  const annualBurn  = monthlyBurn * 12;

  // ── Handlers ─────────────────────────────────────────────

  const logExpense = async () => {
    const amt = parseFloat(formAmt);
    if (!formDesc.trim())       return Alert.alert('Missing info', 'Enter a description.');
    if (isNaN(amt) || amt <= 0) return Alert.alert('Missing info', 'Enter a valid amount.');
    const entry = { id: Date.now(), desc: formDesc.trim(), cat: formCat, date: fmtDateKey(formDate), amt };
    const updated = [entry, ...entries];
    setEntries(updated);
    setFormDesc(''); setFormAmt('');
    await persistEntries(updated);
  };

  const deleteEntry = id => {
    Alert.alert('Delete expense?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const updated = entries.filter(e => e.id !== id);
        setEntries(updated);
        await persistEntries(updated);
      }},
    ]);
  };

  const handleAddSub = useCallback(async (subData) => {
    const updated = [...subsRef.current, { ...subData, id: Date.now() }];
    setSubs(updated);
    setAddSubModal(false);
    await persistSubs(updated);
  }, []);

  const deleteSub = useCallback((id) => {
    Alert.alert('Remove subscription?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = subsRef.current.filter(s => s.id !== id);
        setSubs(updated);
        await persistSubs(updated);
      }},
    ]);
  }, []);

  const onDateChange = (event, selected) => {
    if (Platform.OS === 'android') setPicker({ show: false });
    if (!selected || event.type === 'dismissed') return;
    setFormDate(selected);
  };

  // ─────────────────────────────────────────────────────────

  if (loading) {
    return <View style={[s.centered, { backgroundColor: c.bgBase }]}><ActivityIndicator color={c.amber} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgBase }}>

      {saved && (
        <View style={[s.savedBadge, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
          <Text style={[s.savedText, { color: c.green, fontFamily: MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Metrics ─────────────────────────────────── */}
        <View style={s.metRow}>
          <MetCard label="Total Logged" value={fmt$(total)}             sub="all categories"  color={c.amber}       c={c} />
          <MetCard label="This Month"   value={fmt$(monthTotal)}         sub={monthName}       color={c.textPrimary} c={c} />
          <MetCard label="Entries"      value={String(entries.length)}   sub="transactions"    color={c.blue}        c={c} />
          <MetCard label="Largest"      value={largest ? fmt$(largest.amt) : '—'} sub={largest ? largest.desc.substring(0, 16) : ''} color={c.textPrimary} c={c} />
        </View>

        {/* ── Log an Expense ──────────────────────────── */}
        <SecHeader title="Log an Expense" open={open.entry} onToggle={() => toggle('entry')} c={c} />
        {open.entry && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <FLabel label="Description" c={c} />
            <TextInput
              style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              placeholder="e.g. Gas fillup, lunch, new grip..."
              placeholderTextColor={c.textMuted} value={formDesc} onChangeText={setFormDesc}
            />
            <FLabel label="Category" c={c} />
            <View style={[s.pickerBox, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}>
              <Picker selectedValue={formCat} onValueChange={setFormCat} style={{ color: c.textPrimary }}
                dropdownIconColor={c.textMuted} itemStyle={{ fontSize: 13, color: c.textPrimary, fontFamily: MONO }}>
                {CATEGORIES.map(cat => <Picker.Item key={cat} label={cat} value={cat} color={c.textPrimary} />)}
              </Picker>
            </View>
            <View style={s.formRow}>
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
                  style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.amber, fontFamily: MONO }]}
                  placeholder="0.00" placeholderTextColor={c.textMuted}
                  value={formAmt} onChangeText={setFormAmt} keyboardType="decimal-pad"
                />
              </View>
            </View>
            <TouchableOpacity style={[s.logBtn, { backgroundColor: c.amberGlow, borderColor: c.amber }]} onPress={logExpense}>
              <Text style={[s.logBtnTxt, { color: c.amber, fontFamily: MONO }]}>+ Log Expense</Text>
            </TouchableOpacity>
          </View>
        )}

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

        {/* ── Subscription Tracker ────────────────────── */}
        <SecHeader
          title="Subscriptions"
          open={open.subs}
          onToggle={() => toggle('subs')}
          c={c}
          right={
            <TouchableOpacity onPress={() => setAddSubModal(true)}
              style={[s.addSubBtn, { borderColor: c.amber, backgroundColor: c.amberGlow }]}>
              <Text style={[s.addSubTxt, { color: c.amber, fontFamily: MONO }]}>+ Add</Text>
            </TouchableOpacity>
          }
        />
        {open.subs && (
          <>
            {/* Burn rate row */}
            <View style={s.burnRow}>
              <View style={[s.burnCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                <Text style={[s.burnLabel, { color: c.textMuted, fontFamily: MONO }]}>MONTHLY BURN</Text>
                <Text style={[s.burnVal,   { color: c.amber,     fontFamily: MONO }]}>{fmt$(monthlyBurn)}</Text>
                <Text style={[s.burnSub,   { color: c.textMuted, fontFamily: MONO }]}>per month</Text>
              </View>
              <View style={[s.burnCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                <Text style={[s.burnLabel, { color: c.textMuted, fontFamily: MONO }]}>ANNUAL BURN</Text>
                <Text style={[s.burnVal,   { color: c.red,       fontFamily: MONO }]}>{fmt$(annualBurn)}</Text>
                <Text style={[s.burnSub,   { color: c.textMuted, fontFamily: MONO }]}>per year</Text>
              </View>
              <View style={[s.burnCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                <Text style={[s.burnLabel, { color: c.textMuted, fontFamily: MONO }]}>ACTIVE</Text>
                <Text style={[s.burnVal,   { color: c.blue,      fontFamily: MONO }]}>{subs.length}</Text>
                <Text style={[s.burnSub,   { color: c.textMuted, fontFamily: MONO }]}>subscriptions</Text>
              </View>
            </View>

            {subs.length === 0 ? (
              <View style={[s.empty, { borderColor: c.borderSubtle }]}>
                <Text style={[s.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No subscriptions yet. Tap + Add to start tracking.</Text>
              </View>
            ) : (
              subs.map(sub => {
                const days   = daysUntil(sub.renewalDate);
                const soon   = days >= 0 && days <= 7;
                const overdue = days < 0;
                const warn   = soon || overdue;
                return (
                  <View key={sub.id} style={[s.subItem, { backgroundColor: c.bgCard, borderColor: warn ? c.amber : c.borderSubtle }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={s.subTopRow}>
                        <Text style={[s.subName, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>{sub.name}</Text>
                        {warn && (
                          <View style={[s.warnPill, { backgroundColor: c.amberGlow, borderColor: c.amber }]}>
                            <Text style={{ color: c.amber, fontSize: 9, fontWeight: '700', fontFamily: MONO }}>
                              {overdue ? 'OVERDUE' : days === 0 ? 'TODAY' : `${days}D`}
                            </Text>
                          </View>
                        )}
                        <Text style={[s.subAmt, { color: c.amber, fontFamily: MONO }]}>
                          {fmt$(sub.amount)}{FREQ_LABEL[sub.freq] || '/mo'}
                        </Text>
                      </View>
                      <View style={s.subBottomRow}>
                        <Text style={[s.subMeta, { color: c.textMuted, fontFamily: MONO }]}>
                          Renews {fmtRenewal(sub.renewalDate)}
                        </Text>
                        <Text style={[s.subMonthly, { color: c.textMuted, fontFamily: MONO }]}>
                          {fmt$(monthlyEq(sub))}/mo
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => deleteSub(sub.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ── Category Breakdown ──────────────────────── */}
        <SecHeader title="Category Breakdown" open={open.breakdown} onToggle={() => toggle('breakdown')} c={c} />
        {open.breakdown && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            {catSorted.length === 0 ? (
              <Text style={[s.emptyTxt, { color: c.textMuted, fontFamily: MONO, textAlign: 'center', paddingVertical: 8 }]}>
                No entries yet.
              </Text>
            ) : (
              <>
                {/* Donut chart */}
                <DonutChart catSorted={catSorted} total={total} c={c} />

                {/* Legend */}
                <View style={s.legendRow}>
                  {catSorted.map(([cat, val]) => (
                    <View key={cat} style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: CAT_COLOR[cat] || '#aaa' }]} />
                      <Text style={[s.legendCat, { color: c.textSecondary, fontFamily: MONO }]}>{cat}</Text>
                      <Text style={[s.legendPct, { color: c.textMuted, fontFamily: MONO }]}>
                        {total > 0 ? Math.round((val / total) * 100) : 0}%
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Bar rows */}
                <View style={{ marginTop: 10 }}>
                  {catSorted.map(([cat, val]) => {
                    const pct   = total > 0 ? Math.min(100, (val / total) * 100) : 0;
                    const color = CAT_COLOR[cat] || '#aaa';
                    return (
                      <View key={cat} style={s.barRow}>
                        <Text style={[s.barLabel, { color: c.textMuted, fontFamily: MONO }]}>{cat}</Text>
                        <View style={[s.barTrack, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
                          <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                        </View>
                        <Text style={[s.barAmt, { color: c.textPrimary, fontFamily: MONO }]}>{fmt$(val)}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Transaction History ─────────────────────── */}
        <SecHeader title={`Transaction History (${entries.length})`} open={open.log} onToggle={() => toggle('log')} c={c} />
        {open.log && (
          entries.length === 0 ? (
            <View style={[s.empty, { borderColor: c.borderSubtle }]}>
              <Text style={[s.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No expenses logged yet.</Text>
            </View>
          ) : (
            entries.map(entry => (
              <View key={entry.id} style={[s.expItem, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                <View style={{ flex: 1 }}>
                  <View style={[s.expTop, { gap: 6 }]}>
                    <Text style={[s.expDesc, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>{entry.desc}</Text>
                    <View style={[s.catPill, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
                      <View style={[s.catDot, { backgroundColor: CAT_COLOR[entry.cat] || '#aaa' }]} />
                      <Text style={[s.catPillTxt, { color: c.textMuted, fontFamily: MONO }]}>{entry.cat}</Text>
                    </View>
                  </View>
                  <Text style={[s.expDate, { color: c.textMuted, fontFamily: MONO }]}>{fmtDisplay(entry.date)}</Text>
                </View>
                <View style={s.expRight}>
                  <Text style={[s.expAmt, { color: c.amber, fontFamily: MONO }]}>{fmt$(entry.amt)}</Text>
                  <TouchableOpacity onPress={() => deleteEntry(entry.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        )}

      </ScrollView>

      <AddSubModal visible={addSubModal} onClose={() => setAddSubModal(false)} onSave={handleAddSub} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: 14, paddingBottom: 60 },
  metRow:    { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },

  card:      { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 6 },
  formRow:   { flexDirection: 'row', marginTop: 0 },
  input:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, marginBottom: 2 },
  pickerBox: { borderWidth: 1, borderRadius: 6, marginBottom: 2, overflow: 'hidden' },
  dtBtn:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  dtText:    { fontSize: 12 },
  logBtn:    { borderWidth: 1, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 20, alignSelf: 'flex-end', marginTop: 12 },
  logBtnTxt: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  // Subscription tracker
  addSubBtn:    { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  addSubTxt:    { fontSize: 10, fontWeight: '700' },
  burnRow:      { flexDirection: 'row', gap: 6, marginBottom: 8 },
  burnCard:     { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'center' },
  burnLabel:    { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginBottom: 3 },
  burnVal:      { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  burnSub:      { fontSize: 9, marginTop: 2 },
  subItem:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 5, gap: 8 },
  subTopRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' },
  subName:      { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  subAmt:       { fontSize: 12, fontWeight: '700', marginLeft: 'auto' },
  warnPill:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  subBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  subMeta:      { fontSize: 10 },
  subMonthly:   { fontSize: 10 },

  // Donut chart legend
  legendRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendCat:  { fontSize: 11 },
  legendPct:  { fontSize: 10 },

  barRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 },
  barLabel:  { width: 100, fontSize: 11 },
  barTrack:  { flex: 1, height: 7, borderRadius: 4, borderWidth: 1, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 4 },
  barAmt:    { width: 58, textAlign: 'right', fontSize: 12, fontWeight: '600' },

  expItem:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 5, gap: 10 },
  expTop:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 },
  expDesc:    { fontSize: 12, fontWeight: '500', flexShrink: 1 },
  expDate:    { fontSize: 11 },
  expRight:   { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  expAmt:     { fontSize: 13, fontWeight: '600' },

  catPill:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  catDot:     { width: 6, height: 6, borderRadius: 3 },
  catPillTxt: { fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },

  empty:     { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 28, alignItems: 'center', marginBottom: 6 },
  emptyTxt:  { fontSize: 12 },

  savedBadge: { position: 'absolute', bottom: 16, right: 16, zIndex: 99, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  savedText:  { fontSize: 11, fontWeight: '600' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:   { borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 },
  doneBtn:      { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  doneTxt:      { fontSize: 15, fontWeight: '600' },
});
