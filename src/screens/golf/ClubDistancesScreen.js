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
import { MONO } from '../../theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_ORDER  = ['driver','wood','hybrid','iron','wedge','putter','ball','training','other'];
const TYPE_LABELS = { driver:'Driver', wood:'Wood', hybrid:'Hybrid', iron:'Iron', wedge:'Wedge', putter:'Putter', ball:'Ball', training:'Training', other:'Other' };
const EXCLUDE_SYNC = new Set(['ball','training','other']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTypeColor(type, c) {
  return { driver:c.blue, wood:c.teal, hybrid:c.green, wedge:c.amber, putter:c.purple }[type] || c.textSecondary;
}

function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDateDisp(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function arrAvg(arr) {
  const f = arr.filter(v => v > 0);
  return f.length ? Math.round(f.reduce((a, b) => a + b, 0) / f.length) : null;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SecHeader({ title, open, onToggle, c, rightEl }) {
  return (
    <TouchableOpacity style={[sh.row, { borderBottomColor:c.borderSubtle }]} onPress={onToggle} activeOpacity={0.7}>
      <Text style={[sh.label, { color:c.textMuted, fontFamily:MONO }]}>{title.toUpperCase()}</Text>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
        {rightEl}
        <Text style={{ color:c.textMuted, fontSize:10 }}>{open ? '▲' : '▼'}</Text>
      </View>
    </TouchableOpacity>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth:1, paddingVertical:10, marginTop:16, marginBottom:8 },
  label: { fontSize:10, fontWeight:'600', letterSpacing:1 },
});

function FLabel({ label, c }) {
  return <Text style={{ fontSize:9, fontWeight:'600', letterSpacing:0.7, marginBottom:3, marginTop:10, color:c.textMuted, fontFamily:MONO }}>{label.toUpperCase()}</Text>;
}

// Trend spark bars (last ≤6 sessions)
function TrendSpark({ sessions, c }) {
  const vals = sessions.slice(-6).map(s => s.carry || s.total || 0).filter(v => v > 0);
  if (vals.length < 2) return <Text style={{ color:c.textMuted, fontSize:10, fontFamily:MONO }}>—</Text>;
  const mn = Math.min(...vals) - 5;
  const mx = Math.max(...vals) + 5;
  return (
    <View style={{ flexDirection:'row', alignItems:'flex-end', gap:2, height:20 }}>
      {vals.map((v, i) => {
        const h = Math.max(3, Math.round(((v - mn) / (mx - mn || 1)) * 18) + 2);
        return <View key={i} style={{ height:h, flex:1, backgroundColor:c.teal, borderRadius:1, minWidth:5 }} />;
      })}
    </View>
  );
}

// Club average row card
function AverageRow({ name, clubInfo, clubSessions, avgCarry, avgTotal, c }) {
  const typeColor = getTypeColor(clubInfo?.type, c);
  const typeLabel = TYPE_LABELS[clubInfo?.type || 'other'] || '';
  const loft      = clubInfo?.loft ? ` · ${clubInfo.loft}°` : '';

  return (
    <View style={[ar.row, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
      <View style={ar.top}>
        <Text style={[ar.name, { color:c.textPrimary, fontFamily:MONO }]} numberOfLines={1}>{name}{loft}</Text>
        <View style={[ar.typeBadge, { borderColor:typeColor, backgroundColor:typeColor + '22' }]}>
          <Text style={[ar.typeTxt, { color:typeColor, fontFamily:MONO }]}>{typeLabel}</Text>
        </View>
      </View>
      <View style={ar.bottom}>
        {avgCarry != null ? (
          <View style={[ar.badge, { backgroundColor:c.tealGlow, borderColor:c.teal }]}>
            <Text style={[ar.badgeNum, { color:c.teal, fontFamily:MONO }]}>{avgCarry}</Text>
            <Text style={[ar.badgeLbl, { color:c.teal, fontFamily:MONO }]}>carry</Text>
          </View>
        ) : <Text style={{ color:c.textMuted, fontSize:10, fontFamily:MONO, marginRight:4 }}>—</Text>}
        {avgTotal != null ? (
          <View style={[ar.badge, { backgroundColor:c.blueGlow, borderColor:c.blue }]}>
            <Text style={[ar.badgeNum, { color:c.blue, fontFamily:MONO }]}>{avgTotal}</Text>
            <Text style={[ar.badgeLbl, { color:c.blue, fontFamily:MONO }]}>total</Text>
          </View>
        ) : <Text style={{ color:c.textMuted, fontSize:10, fontFamily:MONO, marginRight:4 }}>—</Text>}
        <Text style={[ar.sessCount, { color:c.textMuted, fontFamily:MONO }]}>{clubSessions.length} sess.</Text>
        <TrendSpark sessions={clubSessions} c={c} />
      </View>
    </View>
  );
}
const ar = StyleSheet.create({
  row:      { borderWidth:1, borderRadius:8, padding:10, marginBottom:6 },
  top:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  name:     { fontSize:13, fontWeight:'600', flex:1, marginRight:8 },
  typeBadge:{ borderWidth:1, borderRadius:10, paddingHorizontal:8, paddingVertical:2 },
  typeTxt:  { fontSize:10, fontWeight:'600', letterSpacing:0.4 },
  bottom:   { flexDirection:'row', alignItems:'center', gap:6 },
  badge:    { flexDirection:'row', alignItems:'baseline', gap:3, borderWidth:1, borderRadius:20, paddingHorizontal:10, paddingVertical:3 },
  badgeNum: { fontSize:13, fontWeight:'700' },
  badgeLbl: { fontSize:9, fontWeight:'600' },
  sessCount:{ fontSize:10, marginLeft:4 },
});

// Session history row
function SessionRow({ session, onDelete, c }) {
  return (
    <View style={[sr.row, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
      <View style={{ flex:1 }}>
        <Text style={[sr.club, { color:c.textPrimary, fontFamily:MONO }]}>{session.club}</Text>
        <View style={sr.meta}>
          <Text style={[sr.metaTxt, { color:c.textMuted, fontFamily:MONO }]}>{fmtDateDisp(session.date)}</Text>
          {!!session.condition && <Text style={[sr.metaTxt, { color:c.textMuted, fontFamily:MONO }]}>· {session.condition}</Text>}
          {!!session.ball      && <Text style={[sr.metaTxt, { color:c.textMuted, fontFamily:MONO }]}>· {session.ball}</Text>}
          {session.carry > 0   && <Text style={[sr.metaTxt, { color:c.teal,      fontFamily:MONO }]}>· {session.carry}y carry</Text>}
          {session.total > 0   && <Text style={[sr.metaTxt, { color:c.blue,      fontFamily:MONO }]}>· {session.total}y total</Text>}
        </View>
        {!!session.notes && <Text style={[sr.notes, { color:c.textMuted, fontFamily:MONO }]} numberOfLines={1}>{session.notes}</Text>}
      </View>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
        <Text style={{ color:c.textMuted, fontSize:14 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}
const sr = StyleSheet.create({
  row:     { flexDirection:'row', alignItems:'center', gap:10, borderWidth:1, borderRadius:8, padding:10, marginBottom:5 },
  club:    { fontSize:12, fontWeight:'600', marginBottom:2 },
  meta:    { flexDirection:'row', flexWrap:'wrap', gap:4 },
  metaTxt: { fontSize:10 },
  notes:   { fontSize:10, fontStyle:'italic', marginTop:3 },
});

// ─── Club Picker Modal ────────────────────────────────────────────────────────

function ClubPickerModal({ visible, clubs, sessions, onSelect, onClose, c }) {
  // All selectable names: synced clubs + any that appear only in sessions
  const sessionClubs = [...new Set(sessions.map(s => s.club).filter(Boolean))];
  const syncedNames  = new Set(clubs.map(c2 => c2.name));
  const extraNames   = sessionClubs.filter(n => !syncedNames.has(n));

  // Group synced clubs by type
  const grouped = {};
  clubs.forEach(club => {
    if (!grouped[club.type]) grouped[club.type] = [];
    grouped[club.type].push(club);
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.45)' }}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'}
          style={[cp.sheet, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
          <View style={[cp.header, { borderBottomColor:c.borderSubtle }]}>
            <Text style={[cp.title, { color:c.textPrimary, fontFamily:MONO }]}>Select Club</Text>
            <TouchableOpacity onPress={onClose} style={[cp.closeBtn, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]}>
              <Text style={{ color:c.textMuted, fontSize:14 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:14, paddingBottom:40 }}>
            {TYPE_ORDER.map(type => {
              const items = grouped[type];
              if (!items?.length) return null;
              return (
                <View key={type} style={{ marginBottom:10 }}>
                  <Text style={[cp.groupLabel, { color:getTypeColor(type, c), fontFamily:MONO }]}>{(TYPE_LABELS[type]||type).toUpperCase()}</Text>
                  {items.map(club => {
                    const label = club.name + (club.loft ? ` (${club.loft}°)` : '');
                    return (
                      <TouchableOpacity key={club.id} style={[cp.item, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]}
                        onPress={() => { onSelect(club.name); onClose(); }}>
                        <Text style={[cp.itemTxt, { color:c.textPrimary, fontFamily:MONO }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
            {extraNames.length > 0 && (
              <View style={{ marginBottom:10 }}>
                <Text style={[cp.groupLabel, { color:c.textMuted, fontFamily:MONO }]}>FROM SESSIONS</Text>
                {extraNames.map(name => (
                  <TouchableOpacity key={name} style={[cp.item, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]}
                    onPress={() => { onSelect(name); onClose(); }}>
                    <Text style={[cp.itemTxt, { color:c.textPrimary, fontFamily:MONO }]}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
const cp = StyleSheet.create({
  sheet:      { flex:1, marginTop:72, borderTopLeftRadius:20, borderTopRightRadius:20, borderTopWidth:1, borderLeftWidth:1, borderRightWidth:1, overflow:'hidden' },
  header:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, borderBottomWidth:1 },
  title:      { fontSize:15, fontWeight:'600' },
  closeBtn:   { width:28, height:28, borderRadius:14, borderWidth:1, alignItems:'center', justifyContent:'center' },
  groupLabel: { fontSize:9, fontWeight:'700', letterSpacing:1, marginBottom:6, marginLeft:2 },
  item:       { borderWidth:1, borderRadius:8, paddingHorizontal:12, paddingVertical:10, marginBottom:5 },
  itemTxt:    { fontSize:13, fontWeight:'500' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ClubDistancesScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;

  // ── Data ────────────────────────────────────────────────
  const [clubs,     setClubs]     = useState([]);
  const [sessions,  setSessions]  = useState([]);
  const [idCounter, setIdCounter] = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [saved,     setSaved]     = useState(false);
  const [syncMsg,   setSyncMsg]   = useState(null); // {text, color}

  // ── Section open ────────────────────────────────────────
  const [open, setOpen] = useState({ averages:true, entry:true, history:true });
  const toggle = key => setOpen(p => ({ ...p, [key]:!p[key] }));

  // ── Form state ──────────────────────────────────────────
  const [formClub,      setFormClub]      = useState('');
  const [formDate,      setFormDate]      = useState(new Date());
  const [formCondition, setFormCondition] = useState('');
  const [formBall,      setFormBall]      = useState('');
  const [formCarry,     setFormCarry]     = useState('');
  const [formTotal,     setFormTotal]     = useState('');
  const [formNotes,     setFormNotes]     = useState('');
  const [showDatePicker,  setShowDatePicker]  = useState(false);
  const [showClubPicker,  setShowClubPicker]  = useState(false);

  // ── Firestore ────────────────────────────────────────────
  const docRef = () =>
    firebase.firestore().collection('users').doc(user.uid).collection('localStorage').doc('data');

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const persist = async (updClubs, updSessions, updCounter) => {
    try {
      await docRef().set({
        dist_clubs:    JSON.stringify(updClubs),
        dist_sessions: JSON.stringify(updSessions),
        dist_id:       String(updCounter),
      }, { merge: true });
      flash();
    } catch (err) { Alert.alert('Save error', err.message); }
  };

  // ── Load ─────────────────────────────────────────────────
  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await docRef().get();
      const d = snap.exists ? snap.data() : {};
      const loadedClubs    = JSON.parse(d.dist_clubs    || '[]');
      const loadedSessions = JSON.parse(d.dist_sessions || '[]');
      const loadedCounter  = parseInt(d.dist_id || '1');
      setClubs(loadedClubs);
      setSessions(loadedSessions);
      setIdCounter(loadedCounter);
      // Auto-sync if no clubs but equipment data exists
      if (loadedClubs.length === 0 && d.golf_equipment) {
        doSync(d.golf_equipment, loadedSessions, loadedCounter);
      }
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  // ── Sync clubs from equipment ────────────────────────────
  const doSync = async (eqRaw, currentSessions, currentCounter) => {
    try {
      const eq = JSON.parse(eqRaw || '{}');
      const newClubs = [];
      TYPE_ORDER.filter(t => !EXCLUDE_SYNC.has(t)).forEach(type => {
        (eq[type] || []).forEach(c2 => {
          const name = [c2.make, c2.model].filter(Boolean).join(' ').trim() || 'Unnamed';
          newClubs.push({ id: c2.id, name, type, make: c2.make||'', model: c2.model||'', loft: c2.loft||'' });
        });
      });
      setClubs(newClubs);
      await docRef().set({ dist_clubs: JSON.stringify(newClubs) }, { merge: true });
      setSyncMsg({ text: `Synced ${newClubs.length} club${newClubs.length !== 1 ? 's' : ''} from Equipment page.`, color: 'green' });
      setTimeout(() => setSyncMsg(null), 3000);
    } catch (err) { Alert.alert('Sync error', err.message); }
  };

  const syncClubs = async () => {
    try {
      const snap = await docRef().get();
      const d = snap.exists ? snap.data() : {};
      if (!d.golf_equipment) {
        setSyncMsg({ text: 'No equipment data found. Add clubs on the Equipment page first.', color: 'amber' });
        setTimeout(() => setSyncMsg(null), 4000);
        return;
      }
      await doSync(d.golf_equipment, sessions, idCounter);
    } catch (err) { Alert.alert('Sync error', err.message); }
  };

  // ── Computed averages ────────────────────────────────────
  const avgData = useMemo(() => {
    const nameSet = new Set();
    clubs.forEach(c2 => nameSet.add(c2.name));
    sessions.forEach(s => { if (s.club) nameSet.add(s.club); });

    return [...nameSet].sort((a, b) => {
      const ca = clubs.find(c2 => c2.name === a);
      const cb = clubs.find(c2 => c2.name === b);
      const ta = TYPE_ORDER.indexOf(ca?.type || 'other');
      const tb = TYPE_ORDER.indexOf(cb?.type || 'other');
      return ta !== tb ? ta - tb : a.localeCompare(b);
    }).map(name => {
      const clubInfo     = clubs.find(c2 => c2.name === name) || null;
      const clubSessions = sessions.filter(s => s.club === name).sort((a, b) => new Date(a.date) - new Date(b.date));
      const avgCarry = arrAvg(clubSessions.map(s => s.carry));
      const avgTotal = arrAvg(clubSessions.map(s => s.total));
      return { name, clubInfo, clubSessions, avgCarry, avgTotal };
    });
  }, [clubs, sessions]);

  // ── Log session ──────────────────────────────────────────
  const logSession = async () => {
    if (!formClub) return Alert.alert('Missing club', 'Select a club.');
    const carry = parseFloat(formCarry) || 0;
    const total = parseFloat(formTotal) || 0;
    if (!carry && !total) return Alert.alert('Missing distance', 'Enter carry or total distance.');

    const session = {
      id: idCounter, club: formClub, date: fmtDateKey(formDate),
      condition: formCondition.trim(), ball: formBall.trim(),
      carry, total, notes: formNotes.trim(),
    };
    const updSessions = [...sessions, session];
    const newCounter  = idCounter + 1;
    setSessions(updSessions); setIdCounter(newCounter);
    setFormCarry(''); setFormTotal(''); setFormNotes('');
    setFormCondition(''); setFormBall('');
    await persist(clubs, updSessions, newCounter);
  };

  // ── Delete session ───────────────────────────────────────
  const deleteSession = (id) => {
    Alert.alert('Delete session?', '', [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        const updated = sessions.filter(s => s.id !== id);
        setSessions(updated);
        await persist(clubs, updated, idCounter);
      }},
    ]);
  };

  const sortedSessions = useMemo(() =>
    [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [sessions]
  );

  if (loading) {
    return <View style={[s.centered, { backgroundColor:c.bgBase }]}><ActivityIndicator color={c.teal} size="large" /></View>;
  }

  return (
    <View style={{ flex:1, backgroundColor:c.bgBase }}>
      {saved && (
        <View style={[s.savedBadge, { backgroundColor:c.greenGlow, borderColor:c.green }]}>
          <Text style={[s.savedText, { color:c.green, fontFamily:MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Sync / notice bar ──────────────────────── */}
        <View style={s.topActions}>
          <TouchableOpacity style={[s.syncBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgCard }]} onPress={syncClubs}>
            <Text style={[s.syncTxt, { color:c.textMuted, fontFamily:MONO }]}>⟳ Sync Clubs</Text>
          </TouchableOpacity>
        </View>

        {syncMsg && (
          <View style={[s.syncNotice, {
            backgroundColor: syncMsg.color === 'green' ? c.greenGlow : syncMsg.color === 'amber' ? c.amberGlow : c.blueGlow,
            borderColor:     syncMsg.color === 'green' ? c.green     : syncMsg.color === 'amber' ? c.amber     : c.blue,
          }]}>
            <Text style={[s.syncNoticeTxt, {
              color: syncMsg.color === 'green' ? c.green : syncMsg.color === 'amber' ? c.amber : c.blue,
              fontFamily: MONO,
            }]}>{syncMsg.text}</Text>
            <TouchableOpacity onPress={() => setSyncMsg(null)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Text style={{ color:c.textMuted, fontSize:14 }}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Club Averages ──────────────────────────── */}
        <SecHeader title="Club Averages" open={open.averages} onToggle={() => toggle('averages')} c={c} />
        {open.averages && (
          avgData.length === 0 ? (
            <View style={[s.emptyBox, { borderColor:c.borderSubtle }]}>
              <Text style={[s.emptyTxt, { color:c.textMuted, fontFamily:MONO }]}>No sessions logged yet. Sync clubs and log a session below.</Text>
            </View>
          ) : (
            avgData.map(item => (
              <AverageRow key={item.name} {...item} c={c} />
            ))
          )
        )}

        {/* ── Log Session ────────────────────────────── */}
        <SecHeader title="Log a Session" open={open.entry} onToggle={() => toggle('entry')} c={c} />
        {open.entry && (
          <View style={[s.formCard, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>

            {/* Club selector */}
            <FLabel label="Club" c={c} />
            <TouchableOpacity style={[s.pickerBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]} onPress={() => setShowClubPicker(true)}>
              <Text style={[s.pickerTxt, { color:formClub ? c.textPrimary : c.textMuted, fontFamily:MONO }]}>
                {formClub || 'Select club...'}
              </Text>
            </TouchableOpacity>

            {/* Date */}
            <FLabel label="Date" c={c} />
            <TouchableOpacity style={[s.pickerBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]} onPress={() => setShowDatePicker(true)}>
              <Text style={[s.pickerTxt, { color:c.textPrimary, fontFamily:MONO }]}>
                {formDate.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker value={formDate} mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(e, d) => { if (Platform.OS === 'android') setShowDatePicker(false); if (d) setFormDate(d); }}
                textColor={c.textPrimary}
              />
            )}

            {/* Distance row */}
            <View style={s.distRow}>
              <View style={{ flex:1, marginRight:8 }}>
                <FLabel label="Avg Carry (yds)" c={c} />
                <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.teal, fontFamily:MONO }]}
                  value={formCarry} onChangeText={setFormCarry} keyboardType="decimal-pad" placeholder="e.g. 245" placeholderTextColor={c.textMuted} />
              </View>
              <View style={{ flex:1, marginLeft:8 }}>
                <FLabel label="Avg Total (yds)" c={c} />
                <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.blue, fontFamily:MONO }]}
                  value={formTotal} onChangeText={setFormTotal} keyboardType="decimal-pad" placeholder="e.g. 265" placeholderTextColor={c.textMuted} />
              </View>
            </View>

            {/* Condition + Ball */}
            <View style={s.distRow}>
              <View style={{ flex:1, marginRight:8 }}>
                <FLabel label="Condition / Tag" c={c} />
                <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                  value={formCondition} onChangeText={setFormCondition} placeholder="Summer, Indoor…" placeholderTextColor={c.textMuted} />
              </View>
              <View style={{ flex:1, marginLeft:8 }}>
                <FLabel label="Ball Used" c={c} />
                <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                  value={formBall} onChangeText={setFormBall} placeholder="e.g. Pro V1" placeholderTextColor={c.textMuted} />
              </View>
            </View>

            {/* Notes */}
            <FLabel label="Notes" c={c} />
            <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
              value={formNotes} onChangeText={setFormNotes} placeholder="Optional notes…" placeholderTextColor={c.textMuted} />

            <TouchableOpacity style={[s.saveBtn, { backgroundColor:c.greenGlow, borderColor:c.green }]} onPress={logSession}>
              <Text style={[s.saveBtnTxt, { color:c.green, fontFamily:MONO }]}>+ Save Session</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Session History ────────────────────────── */}
        <SecHeader title={`Session History (${sessions.length})`} open={open.history} onToggle={() => toggle('history')} c={c} />
        {open.history && (
          sortedSessions.length === 0 ? (
            <View style={[s.emptyBox, { borderColor:c.borderSubtle }]}>
              <Text style={[s.emptyTxt, { color:c.textMuted, fontFamily:MONO }]}>No sessions logged yet.</Text>
            </View>
          ) : (
            sortedSessions.map(session => (
              <SessionRow key={session.id} session={session} c={c} onDelete={() => deleteSession(session.id)} />
            ))
          )
        )}

      </ScrollView>

      {/* ── Club picker modal ───────────────────────────── */}
      <ClubPickerModal
        visible={showClubPicker}
        clubs={clubs}
        sessions={sessions}
        onSelect={setFormClub}
        onClose={() => setShowClubPicker(false)}
        c={c}
      />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:      { flex:1, alignItems:'center', justifyContent:'center' },
  scroll:        { padding:14, paddingBottom:60 },
  savedBadge:    { position:'absolute', bottom:16, right:16, zIndex:99, borderWidth:1, borderRadius:20, paddingHorizontal:14, paddingVertical:5 },
  savedText:     { fontSize:11, fontWeight:'600' },
  topActions:    { flexDirection:'row', justifyContent:'flex-end', marginBottom:4 },
  syncBtn:       { borderWidth:1, borderRadius:20, paddingVertical:5, paddingHorizontal:14 },
  syncTxt:       { fontSize:11, fontWeight:'600', letterSpacing:0.4 },
  syncNotice:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:1, borderRadius:8, paddingHorizontal:12, paddingVertical:8, marginBottom:8 },
  syncNoticeTxt: { fontSize:11, flex:1, marginRight:8 },
  emptyBox:      { borderWidth:1, borderStyle:'dashed', borderRadius:8, padding:24, alignItems:'center', marginBottom:6 },
  emptyTxt:      { fontSize:12 },
  formCard:      { borderWidth:1, borderRadius:10, padding:14, marginBottom:6 },
  pickerBtn:     { borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:8, marginBottom:2 },
  pickerTxt:     { fontSize:12 },
  distRow:       { flexDirection:'row' },
  input:         { borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:7, fontSize:12, marginBottom:2 },
  saveBtn:       { borderWidth:1, borderRadius:20, paddingVertical:9, paddingHorizontal:20, alignSelf:'flex-end', marginTop:12 },
  saveBtnTxt:    { fontSize:12, fontWeight:'600', letterSpacing:0.5 },
});
