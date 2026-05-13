import React, { useState, useEffect } from 'react';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n)  { return '$' + Math.abs(Number(n) || 0).toFixed(2); }
function fmtDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function fmtDisplay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

function SecHeader({ title, open, onToggle, c }) {
  return (
    <TouchableOpacity
      style={[sh.row, { borderBottomColor: c.borderSubtle }]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExpenseLogScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;

  // ── Data ────────────────────────────────────────────────
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved,   setSaved]   = useState(false);

  // ── Sections ────────────────────────────────────────────
  const [open, setOpen] = useState({ entry: true, breakdown: true, log: true });
  const toggle = key => setOpen(p => ({ ...p, [key]: !p[key] }));

  // ── Form ────────────────────────────────────────────────
  const [formDesc, setFormDesc] = useState('');
  const [formCat,  setFormCat]  = useState('Food');
  const [formDate, setFormDate] = useState(new Date());
  const [formAmt,  setFormAmt]  = useState('');
  const [picker,   setPicker]   = useState({ show: false });

  // ── Firestore path ──────────────────────────────────────
  // Matches the shim: users/{uid}/localStorage/data  →  field: explog_entries (JSON string)
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
      const raw  = snap.exists ? (snap.data().explog_entries || '[]') : '[]';
      setEntries(JSON.parse(raw));
    } catch (err) {
      Alert.alert('Load error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const persist = async (updated) => {
    try {
      await docRef().set(
        { explog_entries: JSON.stringify(updated) },
        { merge: true },   // preserve other pages' keys in the same doc
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      Alert.alert('Save error', err.message);
    }
  };

  // ── Metrics ─────────────────────────────────────────────
  const total = entries.reduce((s, e) => s + (e.amt || 0), 0);

  const now = new Date();
  const monthEntries = entries.filter(e => {
    const d = new Date(e.date + 'T12:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthTotal = monthEntries.reduce((s, e) => s + (e.amt || 0), 0);
  const monthName  = now.toLocaleString('en-US', { month: 'long' });

  const largest = entries.length > 0 ? entries.reduce((a, b) => (a.amt > b.amt ? a : b)) : null;

  // Per-category totals for breakdown
  const catTotals = {};
  entries.forEach(e => { catTotals[e.cat] = (catTotals[e.cat] || 0) + (e.amt || 0); });
  const catSorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  // ── Log expense ─────────────────────────────────────────
  const logExpense = async () => {
    const amt = parseFloat(formAmt);
    if (!formDesc.trim())      return Alert.alert('Missing info', 'Enter a description.');
    if (isNaN(amt) || amt <= 0) return Alert.alert('Missing info', 'Enter a valid amount.');
    const entry = {
      id:   Date.now(),
      desc: formDesc.trim(),
      cat:  formCat,
      date: fmtDateKey(formDate),
      amt,
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    setFormDesc('');
    setFormAmt('');
    await persist(updated);
  };

  // ── Delete ──────────────────────────────────────────────
  const deleteEntry = id => {
    Alert.alert('Delete expense?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const updated = entries.filter(e => e.id !== id);
          setEntries(updated);
          await persist(updated);
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
        <ActivityIndicator color={c.amber} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgBase }}>

      {/* Saved flash */}
      {saved && (
        <View style={[s.savedBadge, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
          <Text style={[s.savedText, { color: c.green, fontFamily: MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Metrics ─────────────────────────────────── */}
        <View style={s.metRow}>
          <MetCard label="Total Logged" value={fmt$(total)}             sub="all categories"  color={c.amber}       c={c} />
          <MetCard label="This Month"   value={fmt$(monthTotal)}         sub={monthName}       color={c.textPrimary} c={c} />
          <MetCard label="Entries"      value={String(entries.length)}   sub="transactions"    color={c.blue}        c={c} />
          <MetCard
            label="Largest"
            value={largest ? fmt$(largest.amt) : '—'}
            sub={largest ? largest.desc.substring(0, 16) : ''}
            color={c.textPrimary}
            c={c}
          />
        </View>

        {/* ── Log an Expense ──────────────────────────── */}
        <SecHeader title="Log an Expense" open={open.entry} onToggle={() => toggle('entry')} c={c} />
        {open.entry && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>

            <FLabel label="Description" c={c} />
            <TextInput
              style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              placeholder="e.g. Gas fillup, lunch, new grip..."
              placeholderTextColor={c.textMuted}
              value={formDesc}
              onChangeText={setFormDesc}
            />

            <FLabel label="Category" c={c} />
            <View style={[s.pickerBox, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}>
              <Picker
                selectedValue={formCat}
                onValueChange={setFormCat}
                style={{ color: c.textPrimary }}
                dropdownIconColor={c.textMuted}
                itemStyle={{ fontSize: 13, color: c.textPrimary, fontFamily: MONO }}
              >
                {CATEGORIES.map(cat => (
                  <Picker.Item key={cat} label={cat} value={cat} color={c.textPrimary} />
                ))}
              </Picker>
            </View>

            <View style={s.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <FLabel label="Date" c={c} />
                <TouchableOpacity
                  style={[s.dtBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                  onPress={() => setPicker({ show: true })}
                >
                  <Text style={[s.dtText, { color: c.textPrimary, fontFamily: MONO }]}>
                    {formDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <FLabel label="Amount ($)" c={c} />
                <TextInput
                  style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.amber, fontFamily: MONO }]}
                  placeholder="0.00"
                  placeholderTextColor={c.textMuted}
                  value={formAmt}
                  onChangeText={setFormAmt}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <TouchableOpacity style={[s.logBtn, { backgroundColor: c.amberGlow, borderColor: c.amber }]} onPress={logExpense}>
              <Text style={[s.logBtnTxt, { color: c.amber, fontFamily: MONO }]}>+ Log Expense</Text>
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
                <DateTimePicker
                  value={formDate}
                  mode="date"
                  display="spinner"
                  onChange={onDateChange}
                  textColor={c.textPrimary}
                />
              </View>
            </View>
          </Modal>
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
                {catSorted.map(([cat, val]) => {
                  const pct = total > 0 ? Math.min(100, (val / total) * 100) : 0;
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
                {/* Category badges */}
                <View style={s.badgeRow}>
                  {catSorted.map(([cat, val]) => (
                    <View key={cat} style={[s.badge, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
                      <View style={[s.badgeDot, { backgroundColor: CAT_COLOR[cat] || '#aaa' }]} />
                      <Text style={[s.badgeTxt, { color: c.textSecondary, fontFamily: MONO }]}>
                        {cat}: {fmt$(val)}
                      </Text>
                    </View>
                  ))}
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
                    <Text style={[s.expDesc, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>
                      {entry.desc}
                    </Text>
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

  barRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 },
  barLabel:  { width: 100, fontSize: 11 },
  barTrack:  { flex: 1, height: 7, borderRadius: 4, borderWidth: 1, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 4 },
  barAmt:    { width: 58, textAlign: 'right', fontSize: 12, fontWeight: '600' },

  badgeRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  badgeDot:  { width: 7, height: 7, borderRadius: 4 },
  badgeTxt:  { fontSize: 11 },

  expItem:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 5, gap: 10 },
  expTop:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 },
  expDesc:   { fontSize: 12, fontWeight: '500', flexShrink: 1 },
  expDate:   { fontSize: 11 },
  expRight:  { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  expAmt:    { fontSize: 13, fontWeight: '600' },

  catPill:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  catDot:    { width: 6, height: 6, borderRadius: 3 },
  catPillTxt:{ fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },

  empty:     { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 28, alignItems: 'center', marginBottom: 6 },
  emptyTxt:  { fontSize: 12 },

  savedBadge: { position: 'absolute', bottom: 16, right: 16, zIndex: 99, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  savedText:  { fontSize: 11, fontWeight: '600' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:   { borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 },
  doneBtn:      { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  doneTxt:      { fontSize: 15, fontWeight: '600' },
});
