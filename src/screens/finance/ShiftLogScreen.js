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

const DEFAULT_JOBS = [
  { id: 'j1', title: 'SESP',          wage: 10.25, unit: 'hrs' },
  { id: 'j2', title: 'Honors Center', wage: 10.25, unit: 'hrs' },
  { id: 'j3', title: 'Internship',    wage: 15.00, unit: 'hrs' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseHours(inDate, outDate) {
  if (!inDate || !outDate) return 0;
  let mins = (outDate.getHours() * 60 + outDate.getMinutes())
           - (inDate.getHours()  * 60 + inDate.getMinutes());
  if (mins < 0) mins += 24 * 60;
  return Math.round(mins / 60 * 100) / 100;
}

function fmtTime(date) {
  if (!date) return '--:--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function fmtDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fmtDisplay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmt$(n) { return '$' + Number(n || 0).toFixed(2); }

function getWage(jobs, jobId) { return jobs.find(j => j.id === jobId)?.wage || 0; }

function weekGross(shifts, jobs) {
  const now = new Date(), dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  mon.setHours(0, 0, 0, 0);
  return shifts
    .filter(s => new Date(s.date + 'T00:00:00') >= mon)
    .reduce((sum, s) => sum + (s.hours || 0) * getWage(jobs, s.jobId), 0);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetCard({ label, value, sub, color, c }) {
  return (
    <View style={[mc.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
      <Text style={[mc.label, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[mc.value, { color, fontFamily: MONO }]}>{value}</Text>
      <Text style={[mc.sub, { color: c.textMuted, fontFamily: MONO }]}>{sub}</Text>
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
  return <Text style={[fl.text, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>;
}
const fl = StyleSheet.create({
  text: { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, marginBottom: 3, marginTop: 10 },
});

// Job row with local state so blur-saves don't re-render the whole list
function JobRow({ job, c, onSave, onRemove }) {
  const [title, setTitle] = useState(job.title);
  const [wage,  setWage]  = useState(String(job.wage));
  const [unit,  setUnit]  = useState(job.unit);

  const save = (overrides = {}) => {
    onSave(job.id, {
      title: overrides.title ?? title,
      wage:  parseFloat(overrides.wage  ?? wage) || 0,
      unit:  overrides.unit  ?? unit,
    });
  };

  return (
    <View style={[jr.row, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
      <TextInput
        style={[jr.titleInput, { color: c.textPrimary, borderColor: c.borderSubtle, backgroundColor: c.bgBase, fontFamily: MONO }]}
        value={title}
        onChangeText={setTitle}
        onBlur={() => save()}
        placeholder="Job title"
        placeholderTextColor={c.textMuted}
      />
      <Text style={[jr.lbl, { color: c.textMuted, fontFamily: MONO }]}>$</Text>
      <TextInput
        style={[jr.wageInput, { color: c.green, borderColor: c.borderSubtle, backgroundColor: c.bgBase, fontFamily: MONO }]}
        value={wage}
        onChangeText={setWage}
        onBlur={() => save()}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={c.textMuted}
      />
      <View style={[jr.pickerWrap, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}>
        <Picker
          selectedValue={unit}
          onValueChange={val => { setUnit(val); save({ unit: val }); }}
          mode="dropdown"
          style={{ color: c.textPrimary, height: 36 }}
          dropdownIconColor={c.textMuted}
          itemStyle={{ fontSize: 11, color: c.textPrimary }}
        >
          <Picker.Item label="hrs"    value="hrs"    color={c.textPrimary} />
          <Picker.Item label="nights" value="nights" color={c.textPrimary} />
        </Picker>
      </View>
      <TouchableOpacity onPress={onRemove} style={jr.del}>
        <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}
const jr = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 6, flexWrap: 'wrap', gap: 6 },
  titleInput: { flex: 2, minWidth: 100, borderWidth: 1, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12 },
  lbl:        { fontSize: 11, fontWeight: '600' },
  wageInput:  { width: 72, borderWidth: 1, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, textAlign: 'right' },
  pickerWrap: { flex: 1, minWidth: 80, borderWidth: 1, borderRadius: 5, height: 36, justifyContent: 'center', overflow: 'hidden' },
  del:        { padding: 4 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ShiftLogScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;

  // ── Data state ──────────────────────────────────────────
  const [shifts,  setShifts]  = useState([]);
  const [jobs,    setJobs]    = useState(DEFAULT_JOBS);
  const [loading, setLoading] = useState(true);
  const [saved,   setSaved]   = useState(false);

  // ── Section collapse ────────────────────────────────────
  const [open, setOpen] = useState({ breakdown: true, entry: true, history: true, jobs: false });
  const toggle = key => setOpen(p => ({ ...p, [key]: !p[key] }));

  // ── Form state ──────────────────────────────────────────
  const [formJobId, setFormJobId] = useState(null);
  const [formDate,  setFormDate]  = useState(new Date());
  const [formIn,    setFormIn]    = useState(null);
  const [formOut,   setFormOut]   = useState(null);
  const [formNote,  setFormNote]  = useState('');

  // picker: { show, mode:'date'|'time', target:'date'|'in'|'out' }
  const [picker, setPicker] = useState({ show: false, mode: 'date', target: 'date' });

  // ── Load data ───────────────────────────────────────────
  useEffect(() => { if (user) loadAll(); }, [user]);

  const loadAll = async () => {
    setLoading(true);
    const uid = user.uid;
    try {
      const base = firebase.firestore().collection('users').doc(uid);
      const [sSnap, jSnap] = await Promise.all([
        base.collection('shifts').get(),
        base.collection('shift_jobs').doc('data').get(),
      ]);
      const loaded = sSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = new Date((a.date || '') + 'T' + (a.inT || '00:00'));
          const tb = new Date((b.date || '') + 'T' + (b.inT || '00:00'));
          return tb - ta;
        });
      const loadedJobs = jSnap.exists ? (jSnap.data().jobs || DEFAULT_JOBS) : DEFAULT_JOBS;
      setShifts(loaded);
      setJobs(loadedJobs);
      setFormJobId(loadedJobs[0]?.id ?? null);
    } catch (err) {
      Alert.alert('Load error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const persistJobs = async (updated) => {
    try {
      await firebase.firestore()
        .collection('users').doc(user.uid)
        .collection('shift_jobs').doc('data')
        .set({ jobs: updated });
      flash();
    } catch (err) {
      Alert.alert('Save error', err.message);
    }
  };

  // ── Metrics ─────────────────────────────────────────────
  const totalHours = shifts.reduce((s, x) => s + (x.hours || 0), 0);
  const totalGross = shifts.reduce((s, x) => s + (x.hours || 0) * getWage(jobs, x.jobId), 0);

  // ── Date/time picker ────────────────────────────────────
  const openPicker = (target, mode) => setPicker({ show: true, mode, target });

  const onPickerChange = (event, selected) => {
    if (Platform.OS === 'android') setPicker(p => ({ ...p, show: false }));
    if (!selected || event.type === 'dismissed') return;
    if (picker.target === 'date') setFormDate(selected);
    else if (picker.target === 'in')  setFormIn(selected);
    else if (picker.target === 'out') setFormOut(selected);
  };

  const pickerValue = () => {
    if (picker.target === 'in')  return formIn  || new Date();
    if (picker.target === 'out') return formOut || new Date();
    return formDate;
  };

  // ── Log shift ───────────────────────────────────────────
  const logShift = async () => {
    const job = jobs.find(j => j.id === formJobId);
    if (!job) return Alert.alert('Error', 'Select a job.');
    const isStipend = job.unit === 'nights';
    const date = fmtDateKey(formDate);
    let hours = 0, inT = '', outT = '';
    if (isStipend) {
      hours = 1;
    } else {
      if (!formIn || !formOut) return Alert.alert('Missing times', 'Set clock-in and clock-out.');
      inT   = fmtTime(formIn);
      outT  = fmtTime(formOut);
      hours = parseHours(formIn, formOut);
      if (hours <= 0) return Alert.alert('Invalid times', 'Clock-out must be after clock-in.');
    }
    const data = {
      jobId: job.id, jobTitle: job.title,
      date, inT, outT, hours,
      note: formNote.trim(),
      isStipend: isStipend || false,
      createdAt: new Date().toISOString(),
    };
    try {
      const ref = await firebase.firestore()
        .collection('users').doc(user.uid)
        .collection('shifts').add(data);
      setShifts(prev => [{ ...data, id: ref.id }, ...prev]);
      setFormNote('');
      setFormIn(null);
      setFormOut(null);
      flash();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // ── Delete shift ────────────────────────────────────────
  const deleteShift = id => {
    Alert.alert('Delete shift?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await firebase.firestore()
              .collection('users').doc(user.uid)
              .collection('shifts').doc(id).delete();
            setShifts(prev => prev.filter(s => s.id !== id));
            flash();
          } catch (err) { Alert.alert('Error', err.message); }
        },
      },
    ]);
  };

  // ── Job management ──────────────────────────────────────
  const addJob = () => {
    const updated = [...jobs, { id: 'j' + Date.now(), title: 'New Job', wage: 0, unit: 'hrs' }];
    setJobs(updated);
    persistJobs(updated);
  };

  const saveJobField = (id, fields) => {
    const updated = jobs.map(j => j.id === id ? { ...j, ...fields } : j);
    setJobs(updated);
    persistJobs(updated);
  };

  const removeJob = id => {
    if (jobs.length <= 1) return Alert.alert('At least one job is required.');
    Alert.alert('Remove job?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => {
          const updated = jobs.filter(j => j.id !== id);
          setJobs(updated);
          persistJobs(updated);
        },
      },
    ]);
  };

  const selectedJob  = jobs.find(j => j.id === formJobId);
  const isStipendJob = selectedJob?.unit === 'nights';

  // ── Loading ─────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: c.bgBase }]}>
        <ActivityIndicator color={c.blue} size="large" />
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────
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
          <MetCard label="Total Hours"  value={totalHours.toFixed(1)}   sub="all jobs"   color={c.blue}        c={c} />
          <MetCard label="Total Gross"  value={fmt$(totalGross)}         sub="before tax" color={c.green}       c={c} />
          <MetCard label="Shifts"       value={String(shifts.length)}    sub="all time"   color={c.textPrimary}  c={c} />
          <MetCard label="This Week"    value={fmt$(weekGross(shifts, jobs))} sub="gross"  color={c.amber}       c={c} />
        </View>

        {/* ── Per-Job Breakdown ───────────────────────── */}
        <SecHeader title="Per-Job Breakdown" open={open.breakdown} onToggle={() => toggle('breakdown')} c={c} />
        {open.breakdown && (
          <View style={s.metRow}>
            {jobs.map(j => {
              const jH = shifts.filter(x => x.jobId === j.id).reduce((sum, x) => sum + (x.hours || 0), 0);
              return (
                <MetCard key={j.id} label={j.title} value={jH.toFixed(1) + 'h'} sub={fmt$(jH * (j.wage || 0)) + ' gross'} color={c.blue} c={c} />
              );
            })}
          </View>
        )}

        {/* ── Log a Shift ─────────────────────────────── */}
        <SecHeader title="Log a Shift" open={open.entry} onToggle={() => toggle('entry')} c={c} />
        {open.entry && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>

            <FLabel label="Job" c={c} />
            <View style={[s.pickerBox, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}>
              <Picker
                selectedValue={formJobId}
                onValueChange={setFormJobId}
                mode="dropdown"
                style={{ color: c.textPrimary }}
                dropdownIconColor={c.textMuted}
                itemStyle={{ fontSize: 13, color: c.textPrimary, fontFamily: MONO }}
              >
                {jobs.map(j => <Picker.Item key={j.id} label={j.title} value={j.id} color={c.textPrimary} />)}
              </Picker>
            </View>

            <FLabel label="Date" c={c} />
            <TouchableOpacity
              style={[s.dtBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
              onPress={() => openPicker('date', 'date')}
            >
              <Text style={[s.dtText, { color: c.textPrimary, fontFamily: MONO }]}>
                {formDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </TouchableOpacity>

            {!isStipendJob && (
              <View style={s.row}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <FLabel label="Clock In" c={c} />
                  <TouchableOpacity
                    style={[s.dtBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                    onPress={() => openPicker('in', 'time')}
                  >
                    <Text style={[s.dtText, { color: formIn ? c.textPrimary : c.textMuted, fontFamily: MONO }]}>
                      {formIn ? fmtTime(formIn) : 'HH:MM'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <FLabel label="Clock Out" c={c} />
                  <TouchableOpacity
                    style={[s.dtBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                    onPress={() => openPicker('out', 'time')}
                  >
                    <Text style={[s.dtText, { color: formOut ? c.textPrimary : c.textMuted, fontFamily: MONO }]}>
                      {formOut ? fmtTime(formOut) : 'HH:MM'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isStipendJob && (
              <View style={[s.stipendBox, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                <Text style={[s.stipendTxt, { color: c.green, fontFamily: MONO }]}>
                  Stipend shift — 1 night @ {fmt$(selectedJob?.wage || 0)} = {fmt$(selectedJob?.wage || 0)}
                </Text>
              </View>
            )}

            <FLabel label="Note (optional)" c={c} />
            <TextInput
              style={[s.noteInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              placeholder="e.g. desk coverage, event setup..."
              placeholderTextColor={c.textMuted}
              value={formNote}
              onChangeText={setFormNote}
              multiline
            />

            <TouchableOpacity style={[s.logBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]} onPress={logShift}>
              <Text style={[s.logBtnTxt, { color: c.green, fontFamily: MONO }]}>+ Log Shift</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Date/time picker — Android renders as dialog, iOS as modal spinner */}
        {picker.show && Platform.OS === 'android' && (
          <DateTimePicker
            value={pickerValue()}
            mode={picker.mode}
            is24Hour
            display="default"
            onChange={onPickerChange}
          />
        )}
        {picker.show && Platform.OS === 'ios' && (
          <Modal transparent animationType="slide">
            <View style={s.pickerModal}>
              <View style={[s.pickerSheet, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                <TouchableOpacity onPress={() => setPicker(p => ({ ...p, show: false }))} style={s.pickerDoneBtn}>
                  <Text style={[s.pickerDoneTxt, { color: c.blue, fontFamily: MONO }]}>Done</Text>
                </TouchableOpacity>
                <DateTimePicker
                  value={pickerValue()}
                  mode={picker.mode}
                  is24Hour
                  display="spinner"
                  onChange={onPickerChange}
                  textColor={c.textPrimary}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* ── Shift History ───────────────────────────── */}
        <SecHeader title={`Shift History (${shifts.length})`} open={open.history} onToggle={() => toggle('history')} c={c} />
        {open.history && (
          shifts.length === 0 ? (
            <View style={[s.empty, { borderColor: c.borderSubtle }]}>
              <Text style={[s.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No shifts logged yet. Clock in above.</Text>
            </View>
          ) : (
            shifts.map(shift => {
              const gross = (shift.hours || 0) * getWage(jobs, shift.jobId);
              return (
                <View key={shift.id} style={[s.shiftItem, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                  <View style={{ flex: 1 }}>
                    <View style={[s.row, { marginBottom: 3, flexWrap: 'wrap', gap: 6 }]}>
                      <Text style={[s.shiftJob,  { color: c.blue,    fontFamily: MONO }]}>{shift.jobTitle || shift.jobId}</Text>
                      <Text style={[s.shiftDate, { color: c.textMuted, fontFamily: MONO }]}>{fmtDisplay(shift.date)}</Text>
                      {shift.isStipend && (
                        <View style={[s.pill, { backgroundColor: c.amberGlow, borderColor: c.amber }]}>
                          <Text style={[s.pillTxt, { color: c.amber, fontFamily: MONO }]}>STIPEND</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.shiftTimes, { color: c.textSecondary, fontFamily: MONO }]}>
                      {shift.isStipend ? '1 night shift' : `${shift.inT} → ${shift.outT}`}
                    </Text>
                    {!!shift.note && (
                      <Text style={[s.shiftNote, { color: c.textMuted, fontFamily: MONO }]}>{shift.note}</Text>
                    )}
                  </View>
                  <View style={s.shiftRight}>
                    <Text style={[s.shiftHrs,   { color: c.textPrimary, fontFamily: MONO }]}>
                      {shift.isStipend ? '1 night' : (shift.hours || 0).toFixed(1) + 'h'}
                    </Text>
                    <Text style={[s.shiftGross, { color: c.green, fontFamily: MONO }]}>{fmt$(gross)}</Text>
                    <TouchableOpacity onPress={() => deleteShift(shift.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )
        )}

        {/* ── Job Details ─────────────────────────────── */}
        <SecHeader title="Job Details" open={open.jobs} onToggle={() => toggle('jobs')} c={c} />
        {open.jobs && (
          <View style={{ marginBottom: 8 }}>
            {jobs.map(j => (
              <JobRow
                key={j.id}
                job={j}
                c={c}
                onSave={(id, fields) => saveJobField(id, fields)}
                onRemove={() => removeJob(j.id)}
              />
            ))}
            <TouchableOpacity style={[s.addJobBtn, { borderColor: c.borderSubtle }]} onPress={addJob}>
              <Text style={[s.addJobTxt, { color: c.textMuted, fontFamily: MONO }]}>+ Add Job</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:      { padding: 14, paddingBottom: 60 },
  metRow:      { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  card:        { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 6 },
  row:         { flexDirection: 'row', alignItems: 'center' },

  pickerBox:   { borderWidth: 1, borderRadius: 6, marginBottom: 2, overflow: 'hidden' },
  dtBtn:       { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 2 },
  dtText:      { fontSize: 13 },

  stipendBox:  { borderWidth: 1, borderRadius: 6, padding: 10, marginTop: 8 },
  stipendTxt:  { fontSize: 12 },

  noteInput:   { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, minHeight: 52, textAlignVertical: 'top', marginBottom: 4 },
  logBtn:      { borderWidth: 1, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 20, alignSelf: 'flex-end', marginTop: 8 },
  logBtnTxt:   { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  shiftItem:   { flexDirection: 'row', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 6, gap: 10 },
  shiftJob:    { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  shiftDate:   { fontSize: 11 },
  shiftTimes:  { fontSize: 12, marginTop: 1 },
  shiftNote:   { fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  shiftRight:  { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  shiftHrs:    { fontSize: 13, fontWeight: '600' },
  shiftGross:  { fontSize: 12, fontWeight: '600' },

  pill:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  pillTxt:     { fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },

  empty:       { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 28, alignItems: 'center', marginBottom: 6 },
  emptyTxt:    { fontSize: 12 },

  addJobBtn:   { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  addJobTxt:   { fontSize: 12 },

  savedBadge:  { position: 'absolute', bottom: 16, right: 16, zIndex: 99, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  savedText:   { fontSize: 11, fontWeight: '600' },

  pickerModal:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet:    { borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 },
  pickerDoneBtn:  { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  pickerDoneTxt:  { fontSize: 15, fontWeight: '600' },
});
