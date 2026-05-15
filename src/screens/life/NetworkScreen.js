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

// ─── Constants & helpers ──────────────────────────────────────────────────────

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const TAGS = ['mentor','peer','professor','industry','recruiter','other'];

const TAG_COLOR = {
  mentor:'#6c5bbf', peer:'#2a7de1', professor:'#0e9e70',
  industry:'#c27d08', recruiter:'#d03030', other:'#888888',
};

function getTagColors(tag, c) {
  const map = {
    mentor:    { main:c.purple,  bg:c.purpleGlow },
    peer:      { main:c.blue,    bg:c.blueGlow   },
    professor: { main:c.green,   bg:c.greenGlow  },
    industry:  { main:c.amber,   bg:c.amberGlow  },
    recruiter: { main:c.red,     bg:c.redGlow    },
    other:     { main:c.textMuted, bg:c.bgBase   },
  };
  return map[tag] || map.other;
}

function getInitials(name) {
  const parts = (name || '').trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name || '??').slice(0, 2).toUpperCase();
}

function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function isFollowUpDue(str) {
  if (!str) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(str + 'T00:00:00') <= today;
}

// ─── Shared label ─────────────────────────────────────────────────────────────

function FLabel({ label, c }) {
  return (
    <Text style={{ fontSize:9, fontWeight:'600', letterSpacing:0.8, marginBottom:3, marginTop:10, color:c.textMuted, fontFamily:MONO }}>
      {label.toUpperCase()}
    </Text>
  );
}

// ─── Contact Form Modal ───────────────────────────────────────────────────────
// React.memo + internal useTheme so keystrokes never cause parent re-renders

const ContactFormModal = React.memo(function ContactFormModal({ visible, initialValues, onSave, onDelete, onClose }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [name,     setName]     = useState('');
  const [tag,      setTag]      = useState('other');
  const [company,  setCompany]  = useState('');
  const [title,    setTitle]    = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [howMet,   setHowMet]   = useState('');
  const [strength, setStrength] = useState('acquaintance');
  const [notes,    setNotes]    = useState('');

  const [lastDate,   setLastDate]   = useState(null);
  const [followDate, setFollowDate] = useState(null);
  const [picker,     setPicker]     = useState(null); // 'last' | 'follow' | null

  useEffect(() => {
    if (!visible) return;
    const iv = initialValues;
    setName(iv?.name || '');
    setTag(iv?.tag || 'other');
    setCompany(iv?.company || '');
    setTitle(iv?.title || '');
    setEmail(iv?.email || '');
    setPhone(iv?.phone || '');
    setLinkedin(iv?.linkedin || '');
    setHowMet(iv?.howMet || '');
    setStrength(iv?.strength || 'acquaintance');
    setNotes(iv?.notes || '');
    setLastDate(iv?.lastContacted ? new Date(iv.lastContacted + 'T12:00:00') : null);
    setFollowDate(iv?.followUpDate ? new Date(iv.followUpDate + 'T12:00:00') : null);
    setPicker(null);
  }, [visible, initialValues]);

  const handleSave = () => {
    if (!name.trim()) return Alert.alert('Required', 'Name is required.');
    onSave(
      {
        name: name.trim(), tag, company: company.trim(), title: title.trim(),
        email: email.trim(), phone: phone.trim(), linkedin: linkedin.trim(),
        howMet: howMet.trim(), strength, notes: notes.trim(),
        lastContacted: lastDate ? fmtDateKey(lastDate) : '',
        followUpDate:  followDate ? fmtDateKey(followDate) : '',
      },
      initialValues?.id ?? null,
    );
  };

  const isEdit = !!initialValues;

  const StrengthBtn = ({ s, label }) => {
    const colors = { close: c.green, familiar: c.blue, acquaintance: c.textMuted };
    const bgs    = { close: c.greenGlow, familiar: c.blueGlow, acquaintance: c.bgBase };
    const sel    = strength === s;
    return (
      <TouchableOpacity onPress={() => setStrength(s)} style={[fm.strBtn, {
        flex:1, borderColor: sel ? colors[s] : c.borderSubtle,
        backgroundColor: sel ? bgs[s] : 'transparent',
      }]}>
        <Text style={[fm.strTxt, { color: sel ? colors[s] : c.textMuted, fontFamily:MONO }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={fm.overlay}>
        <View style={[fm.sheet, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
          <View style={[fm.header, { borderBottomColor:c.borderSubtle }]}>
            <Text style={[fm.title, { color:c.textPrimary, fontFamily:MONO }]}>{isEdit ? 'Edit Contact' : 'Add Contact'}</Text>
            <TouchableOpacity style={[fm.closeBtn, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]} onPress={onClose}>
              <Text style={{ color:c.textMuted, fontSize:14 }}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex:1 }} contentContainerStyle={fm.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <FLabel label="Name *" c={c} />
            <TextInput style={[fm.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
              value={name} onChangeText={setName} placeholder="Full Name" placeholderTextColor={c.textMuted} autoCorrect={false} />

            <FLabel label="Tag" c={c} />
            <View style={[fm.pickerBox, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]}>
              <Picker selectedValue={tag} onValueChange={setTag} style={{ color:c.textPrimary }} dropdownIconColor={c.textMuted}
                itemStyle={{ fontSize:13, color:c.textPrimary, fontFamily:MONO }}>
                {TAGS.map(t => <Picker.Item key={t} label={t.charAt(0).toUpperCase()+t.slice(1)} value={t} color={c.textPrimary} />)}
              </Picker>
            </View>

            <View style={fm.row}>
              <View style={{ flex:1, marginRight:8 }}>
                <FLabel label="Company / Org" c={c} />
                <TextInput style={[fm.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                  value={company} onChangeText={setCompany} placeholder="Hershey Entertainment..." placeholderTextColor={c.textMuted} />
              </View>
              <View style={{ flex:1, marginLeft:8 }}>
                <FLabel label="Title / Role" c={c} />
                <TextInput style={[fm.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                  value={title} onChangeText={setTitle} placeholder="Manager..." placeholderTextColor={c.textMuted} />
              </View>
            </View>

            <View style={fm.row}>
              <View style={{ flex:1, marginRight:8 }}>
                <FLabel label="Email" c={c} />
                <TextInput style={[fm.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                  value={email} onChangeText={setEmail} placeholder="email@..." placeholderTextColor={c.textMuted}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              </View>
              <View style={{ flex:1, marginLeft:8 }}>
                <FLabel label="Phone" c={c} />
                <TextInput style={[fm.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                  value={phone} onChangeText={setPhone} placeholder="(555) 000-0000" placeholderTextColor={c.textMuted} keyboardType="phone-pad" />
              </View>
            </View>

            <FLabel label="LinkedIn" c={c} />
            <TextInput style={[fm.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
              value={linkedin} onChangeText={setLinkedin} placeholder="linkedin.com/in/..." placeholderTextColor={c.textMuted}
              autoCapitalize="none" autoCorrect={false} />

            <FLabel label="How We Met" c={c} />
            <TextInput style={[fm.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
              value={howMet} onChangeText={setHowMet} placeholder="Class, internship, event..." placeholderTextColor={c.textMuted} />

            <View style={fm.row}>
              <View style={{ flex:1, marginRight:8 }}>
                <FLabel label="Last Contacted" c={c} />
                <TouchableOpacity style={[fm.dateBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]} onPress={() => setPicker('last')}>
                  <Text style={[fm.dateTxt, { color:lastDate?c.textPrimary:c.textMuted, fontFamily:MONO }]}>
                    {lastDate ? fmtDate(fmtDateKey(lastDate)) : 'Pick date'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex:1, marginLeft:8 }}>
                <FLabel label="Follow-up Date" c={c} />
                <TouchableOpacity style={[fm.dateBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]} onPress={() => setPicker('follow')}>
                  <Text style={[fm.dateTxt, { color:followDate?c.textPrimary:c.textMuted, fontFamily:MONO }]}>
                    {followDate ? fmtDate(fmtDateKey(followDate)) : 'Pick date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Date pickers */}
            {picker !== null && Platform.OS === 'android' && (
              <DateTimePicker
                value={(picker === 'last' ? lastDate : followDate) || new Date()}
                mode="date" display="default"
                onChange={(e, d) => {
                  if (picker === 'last')   { if (d) setLastDate(d);   }
                  else                     { if (d) setFollowDate(d); }
                  setPicker(null);
                }}
              />
            )}
            {picker !== null && Platform.OS === 'ios' && (
              <>
                <DateTimePicker
                  value={(picker === 'last' ? lastDate : followDate) || new Date()}
                  mode="date" display="spinner"
                  onChange={(e, d) => {
                    if (picker === 'last')  { if (d) setLastDate(d);   }
                    else                   { if (d) setFollowDate(d); }
                  }}
                />
                <TouchableOpacity style={fm.pickerDone} onPress={() => setPicker(null)}>
                  <Text style={{ color:c.blue, fontWeight:'600', fontFamily:MONO }}>Done</Text>
                </TouchableOpacity>
              </>
            )}

            <FLabel label="Relationship Strength" c={c} />
            <View style={fm.strRow}>
              <StrengthBtn s="close"        label="Close"        />
              <StrengthBtn s="familiar"     label="Familiar"     />
              <StrengthBtn s="acquaintance" label="Acquaintance" />
            </View>

            <FLabel label="Notes" c={c} />
            <TextInput style={[fm.input, fm.notesInput, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
              value={notes} onChangeText={setNotes} placeholder="How you know them, what they do..." placeholderTextColor={c.textMuted} multiline />

            <View style={[fm.actions, { borderTopColor:c.borderSubtle }]}>
              {isEdit ? (
                <TouchableOpacity onPress={() => onDelete(initialValues.id)} style={[fm.btn, { borderColor:c.red, backgroundColor:c.redGlow }]}>
                  <Text style={[fm.btnTxt, { color:c.red, fontFamily:MONO }]}>Delete</Text>
                </TouchableOpacity>
              ) : <View />}
              <TouchableOpacity onPress={handleSave} style={[fm.btn, { backgroundColor:c.blueGlow, borderColor:c.blue }]}>
                <Text style={[fm.btnTxt, { color:c.blue, fontFamily:MONO }]}>Save</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

const fm = StyleSheet.create({
  overlay:    { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.45)' },
  sheet:      { flex:1, marginTop:60, borderTopLeftRadius:20, borderTopRightRadius:20, borderTopWidth:1, borderLeftWidth:1, borderRightWidth:1, overflow:'hidden' },
  header:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, borderBottomWidth:1 },
  title:      { fontSize:15, fontWeight:'600', flex:1, marginRight:10 },
  closeBtn:   { width:28, height:28, borderRadius:14, borderWidth:1, alignItems:'center', justifyContent:'center' },
  body:       { padding:16, paddingBottom:40 },
  input:      { borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:7, fontSize:12, marginBottom:2 },
  notesInput: { minHeight:72, textAlignVertical:'top' },
  pickerBox:  { borderWidth:1, borderRadius:6, marginBottom:2, overflow:'hidden' },
  row:        { flexDirection:'row' },
  dateBtn:    { borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:8 },
  dateTxt:    { fontSize:12 },
  pickerDone: { alignItems:'flex-end', paddingVertical:8, paddingRight:4 },
  strRow:     { flexDirection:'row', gap:6, marginBottom:4 },
  strBtn:     { borderWidth:1.5, borderRadius:6, paddingVertical:6, alignItems:'center' },
  strTxt:     { fontSize:10, fontWeight:'600', letterSpacing:0.5 },
  actions:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:16, paddingTop:14, borderTopWidth:1 },
  btn:        { borderWidth:1, borderRadius:20, paddingVertical:7, paddingHorizontal:18 },
  btnTxt:     { fontSize:12, fontWeight:'600' },
});

// ─── Contact Detail Modal ─────────────────────────────────────────────────────

const ContactDetailModal = React.memo(function ContactDetailModal({ visible, contact, onEdit, onMarkContacted, onClose }) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (!contact) return null;

  const tagColors   = getTagColors(contact.tag, c);
  const followDue   = isFollowUpDue(contact.followUpDate);
  const titleLine   = [contact.title, contact.company].filter(Boolean).join(' · ') || '—';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={dm.overlay}>
        <View style={[dm.sheet, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
          <View style={[dm.header, { borderBottomColor:c.borderSubtle }]}>
            <Text style={[dm.title, { color:c.textPrimary, fontFamily:MONO }]} numberOfLines={1}>{contact.name}</Text>
            <TouchableOpacity style={[dm.closeBtn, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]} onPress={onClose}>
              <Text style={{ color:c.textMuted, fontSize:14 }}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex:1 }} contentContainerStyle={dm.body} showsVerticalScrollIndicator={false}>

            {/* Follow-up alert */}
            {followDue && (
              <View style={[dm.alert, { backgroundColor:c.amberGlow, borderColor:c.amber }]}>
                <Text style={[dm.alertTxt, { color:c.amber, fontFamily:MONO }]}>
                  Follow-up due: {fmtDate(contact.followUpDate)}
                </Text>
              </View>
            )}

            {/* Avatar + name hero */}
            <View style={dm.hero}>
              <View style={[dm.avatar, { backgroundColor:tagColors.bg, borderColor:tagColors.main }]}>
                <Text style={[dm.initials, { color:tagColors.main, fontFamily:MONO }]}>{getInitials(contact.name)}</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={[dm.name, { color:c.textPrimary, fontFamily:MONO }]}>{contact.name}</Text>
                <Text style={[dm.sub,  { color:c.textMuted,    fontFamily:MONO }]}>{titleLine}</Text>
                <View style={{ flexDirection:'row', gap:6, marginTop:4 }}>
                  <View style={[dm.pill, { backgroundColor:tagColors.bg, borderColor:tagColors.main }]}>
                    <Text style={[dm.pillTxt, { color:tagColors.main, fontFamily:MONO }]}>{contact.tag || 'other'}</Text>
                  </View>
                  <View style={[dm.pill, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]}>
                    <Text style={[dm.pillTxt, { color:c.textMuted, fontFamily:MONO }]}>{contact.strength || 'acquaintance'}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Detail fields */}
            <View style={dm.detailGrid}>
              {[
                { label:'Email',          value:contact.email   },
                { label:'Phone',          value:contact.phone   },
                { label:'LinkedIn',       value:contact.linkedin },
                { label:'How We Met',     value:contact.howMet  },
                { label:'Last Contacted', value:fmtDate(contact.lastContacted) },
                { label:'Follow-up',      value:fmtDate(contact.followUpDate)  },
              ].map(({ label, value }) => (
                <View key={label} style={[dm.block, { backgroundColor:c.bgBase }]}>
                  <Text style={[dm.blockLabel, { color:c.textMuted,    fontFamily:MONO }]}>{label.toUpperCase()}</Text>
                  <Text style={[dm.blockVal,   { color:value&&value!=='—'?c.textPrimary:c.textMuted, fontFamily:MONO, fontStyle:value&&value!=='—'?'normal':'italic' }]}>
                    {value || '—'}
                  </Text>
                </View>
              ))}
            </View>

            {!!contact.notes && (
              <View style={[dm.notesBlock, { backgroundColor:c.bgBase }]}>
                <Text style={[dm.blockLabel, { color:c.textMuted, fontFamily:MONO }]}>NOTES</Text>
                <Text style={[dm.blockVal,   { color:c.textPrimary, fontFamily:MONO, lineHeight:18 }]}>{contact.notes}</Text>
              </View>
            )}

            <View style={[dm.actions, { borderTopColor:c.borderSubtle }]}>
              <TouchableOpacity onPress={() => onMarkContacted(contact.id)} style={[dm.btn, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]}>
                <Text style={[dm.btnTxt, { color:c.textMuted, fontFamily:MONO }]}>Mark Contacted Today</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onEdit(contact)} style={[dm.btn, { backgroundColor:c.blueGlow, borderColor:c.blue }]}>
                <Text style={[dm.btnTxt, { color:c.blue, fontFamily:MONO }]}>Edit</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

const dm = StyleSheet.create({
  overlay:    { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.45)' },
  sheet:      { flex:1, marginTop:80, borderTopLeftRadius:20, borderTopRightRadius:20, borderTopWidth:1, borderLeftWidth:1, borderRightWidth:1, overflow:'hidden' },
  header:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, borderBottomWidth:1 },
  title:      { fontSize:15, fontWeight:'600', flex:1, marginRight:10 },
  closeBtn:   { width:28, height:28, borderRadius:14, borderWidth:1, alignItems:'center', justifyContent:'center' },
  body:       { padding:16, paddingBottom:40 },
  alert:      { borderWidth:1, borderRadius:8, padding:8, marginBottom:12 },
  alertTxt:   { fontSize:11, fontWeight:'600' },
  hero:       { flexDirection:'row', alignItems:'flex-start', gap:12, marginBottom:14 },
  avatar:     { width:48, height:48, borderRadius:24, borderWidth:2, alignItems:'center', justifyContent:'center', flexShrink:0 },
  initials:   { fontSize:16, fontWeight:'700' },
  name:       { fontSize:15, fontWeight:'600', marginBottom:2 },
  sub:        { fontSize:11, marginBottom:4 },
  pill:       { borderWidth:1, borderRadius:20, paddingHorizontal:8, paddingVertical:2 },
  pillTxt:    { fontSize:9, fontWeight:'600', letterSpacing:0.5 },
  detailGrid: { flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:10 },
  block:      { width:'47%', borderRadius:8, padding:10 },
  blockLabel: { fontSize:9, fontWeight:'600', letterSpacing:0.5, marginBottom:3 },
  blockVal:   { fontSize:12, fontWeight:'500' },
  notesBlock: { borderRadius:8, padding:10, marginBottom:10 },
  actions:    { flexDirection:'row', justifyContent:'space-between', gap:10, marginTop:14, paddingTop:12, borderTopWidth:1 },
  btn:        { flex:1, borderWidth:1, borderRadius:20, paddingVertical:8, alignItems:'center' },
  btnTxt:     { fontSize:11, fontWeight:'600' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NetworkScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;

  const [contacts,  setContacts]  = useState([]);
  const [idCounter, setIdCounter] = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [saved,     setSaved]     = useState(false);

  const [search,       setSearch]       = useState('');
  const [activeFilter, setActiveFilter] = useState(null);

  const [formModal,       setFormModal]       = useState(false);
  const [editingContact,  setEditingContact]  = useState(null);
  const [detailModal,     setDetailModal]     = useState(false);
  const [viewingContact,  setViewingContact]  = useState(null);

  // Refs for stable callbacks
  const contactsRef = useRef(contacts);
  const counterRef  = useRef(idCounter);
  const userRef     = useRef(user);
  useEffect(() => { contactsRef.current = contacts;   }, [contacts]);
  useEffect(() => { counterRef.current  = idCounter;  }, [idCounter]);
  useEffect(() => { userRef.current     = user;       }, [user]);

  // Firestore helpers
  const docRef = () => {
    const uid = userRef.current?.uid;
    if (!uid) return null;
    return firebase.firestore().collection('users').doc(uid).collection('localStorage').doc('data');
  };

  const writeContacts = async (updContacts, updCounter) => {
    const ref = docRef();
    if (!ref) return;
    await ref.set({
      network_contacts: JSON.stringify(updContacts),
      network_id:       String(updCounter),
    }, { merge: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  // Load
  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const ref  = docRef();
      if (!ref) return;
      const snap = await ref.get();
      const d    = snap.exists ? snap.data() : {};
      setContacts(JSON.parse(d.network_contacts || '[]'));
      setIdCounter(parseInt(d.network_id || '1'));
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  // ── Stable callbacks ─────────────────────────────────────────────────────

  const onSaveStable = useCallback(async (formData, editingId) => {
    const allContacts = contactsRef.current;
    const ctr         = counterRef.current;
    let updContacts, newCtr;
    if (editingId != null) {
      updContacts = allContacts.map(c2 => c2.id === editingId ? { ...c2, ...formData } : c2);
      newCtr      = ctr;
    } else {
      updContacts = [...allContacts, { ...formData, id: ctr }];
      newCtr      = ctr + 1;
      setIdCounter(newCtr);
    }
    setContacts(updContacts);
    setFormModal(false);
    try { await writeContacts(updContacts, newCtr); }
    catch (err) { Alert.alert('Save error', err.message); }
  }, []);

  const onDeleteStable = useCallback(async (contactId) => {
    Alert.alert('Remove contact?', '', [
      { text:'Cancel', style:'cancel' },
      { text:'Remove', style:'destructive', onPress: async () => {
        const updContacts = contactsRef.current.filter(c2 => c2.id !== contactId);
        setContacts(updContacts);
        setFormModal(false);
        try { await writeContacts(updContacts, counterRef.current); }
        catch (err) { Alert.alert('Save error', err.message); }
      }},
    ]);
  }, []);

  const onMarkContactedStable = useCallback(async (contactId) => {
    const todayStr    = fmtDateKey(new Date());
    const allContacts = contactsRef.current;
    const updContacts = allContacts.map(c2 =>
      c2.id === contactId ? { ...c2, lastContacted: todayStr, followUpDate: '' } : c2
    );
    const updated = updContacts.find(c2 => c2.id === contactId) || null;
    setContacts(updContacts);
    setViewingContact(updated);
    try { await writeContacts(updContacts, counterRef.current); }
    catch (err) { Alert.alert('Save error', err.message); }
  }, []);

  const onCloseFormStable   = useCallback(() => setFormModal(false), []);
  const onCloseDetailStable = useCallback(() => setDetailModal(false), []);

  // Edit from detail: close detail, open form with snapshot
  const onEditFromDetailStable = useCallback((contact) => {
    setDetailModal(false);
    setEditingContact({ ...contact });
    setFormModal(true);
  }, []);

  // ── Computed ───────────────────────────────────────────────────────────────

  const today = new Date(); today.setHours(0,0,0,0);

  const filtered = contacts
    .filter(c2 => !activeFilter || c2.tag === activeFilter)
    .filter(c2 => {
      if (!search) return true;
      const q = search.toLowerCase();
      return [c2.name, c2.company, c2.notes, c2.tag, c2.howMet].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const ad = a.followUpDate && new Date(a.followUpDate + 'T00:00:00') <= today;
      const bd = b.followUpDate && new Date(b.followUpDate + 'T00:00:00') <= today;
      if (ad && !bd) return -1; if (!ad && bd) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

  const followUpsDue = contacts.filter(c2 => isFollowUpDue(c2.followUpDate));

  const metTotal    = contacts.length;
  const metFollowUp = followUpsDue.length;
  const metClose    = contacts.filter(c2 => c2.strength === 'close').length;
  const metIndustry = contacts.filter(c2 => c2.tag === 'industry' || c2.tag === 'recruiter').length;

  if (loading) {
    return <View style={[s.centered, { backgroundColor:c.bgBase }]}><ActivityIndicator color={c.blue} size="large" /></View>;
  }

  return (
    <View style={{ flex:1, backgroundColor:c.bgBase }}>
      {saved && (
        <View style={[s.savedBadge, { backgroundColor:c.greenGlow, borderColor:c.green }]}>
          <Text style={[s.savedText, { color:c.green, fontFamily:MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Metrics ─────────────────────────────────── */}
        <View style={s.metRow}>
          <MetCard label="Total"    value={metTotal}    sub="contacts"   color={c.blue}        c={c} />
          <MetCard label="Follow Up" value={metFollowUp} sub="pending"    color={c.amber}       c={c} />
          <MetCard label="Close"    value={metClose}    sub="connections" color={c.green}       c={c} />
          <MetCard label="Industry" value={metIndustry} sub="contacts"   color={c.purple}      c={c} />
        </View>

        {/* ── Search ──────────────────────────────────── */}
        <TextInput
          style={[s.searchInput, { borderColor:c.borderSubtle, backgroundColor:c.bgCard, color:c.textPrimary, fontFamily:MONO }]}
          value={search} onChangeText={setSearch}
          placeholder="Search by name, company, notes..." placeholderTextColor={c.textMuted}
          autoCorrect={false}
        />

        {/* ── Filter tags ──────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }}
          contentContainerStyle={{ gap:6, paddingRight:14 }}>
          {TAGS.filter(t => t !== 'other').map(t => {
            const active = activeFilter === t;
            const tc = getTagColors(t, c);
            return (
              <TouchableOpacity key={t} onPress={() => setActiveFilter(activeFilter === t ? null : t)}
                style={[s.filterTag, { borderColor: active ? tc.main : c.borderSubtle, backgroundColor: active ? tc.bg : c.bgCard }]}>
                <Text style={[s.filterTagTxt, { color: active ? tc.main : c.textMuted, fontFamily:MONO }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Contact list ─────────────────────────────── */}
        {filtered.length === 0 ? (
          <View style={[s.emptyBox, { borderColor:c.borderSubtle }]}>
            <Text style={[s.emptyTxt, { color:c.textMuted, fontFamily:MONO }]}>
              {contacts.length === 0 ? 'No contacts yet. Tap + to add your first.' : 'No contacts match your search.'}
            </Text>
          </View>
        ) : (
          filtered.map(contact => (
            <ContactRow
              key={contact.id}
              contact={contact}
              c={c}
              onPress={() => { setViewingContact(contact); setDetailModal(true); }}
            />
          ))
        )}

        <TouchableOpacity style={[s.addBubble, { borderColor:c.borderSubtle }]} onPress={() => { setEditingContact(null); setFormModal(true); }}>
          <Text style={[s.addBubbleTxt, { color:c.textMuted, fontFamily:MONO }]}>+ Add Contact</Text>
        </TouchableOpacity>

        {/* ── Follow-ups due ────────────────────────────── */}
        {followUpsDue.length > 0 && (
          <>
            <Text style={[s.secLabel, { color:c.textMuted, borderBottomColor:c.borderSubtle, fontFamily:MONO }]}>FOLLOW-UPS DUE</Text>
            {followUpsDue.map(contact => (
              <TouchableOpacity key={contact.id} onPress={() => { setViewingContact(contact); setDetailModal(true); }}
                style={[s.followRow, { backgroundColor:c.amberGlow, borderColor:c.amber }]}>
                <View style={[s.avatarSm, { backgroundColor:c.amberGlow, borderColor:c.amber }]}>
                  <Text style={[s.avatarTxt, { color:c.amber, fontFamily:MONO }]}>{getInitials(contact.name)}</Text>
                </View>
                <View>
                  <Text style={[s.followName, { color:c.textPrimary, fontFamily:MONO }]}>{contact.name}</Text>
                  <Text style={[s.followSub,  { color:c.amber, fontFamily:MONO }]}>
                    Follow-up: {fmtDate(contact.followUpDate)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

      </ScrollView>

      {/* Isolated modals */}
      <ContactFormModal
        visible={formModal}
        initialValues={editingContact}
        onSave={onSaveStable}
        onDelete={onDeleteStable}
        onClose={onCloseFormStable}
      />
      <ContactDetailModal
        visible={detailModal}
        contact={viewingContact}
        onEdit={onEditFromDetailStable}
        onMarkContacted={onMarkContactedStable}
        onClose={onCloseDetailStable}
      />
    </View>
  );
}

// ─── MetCard ──────────────────────────────────────────────────────────────────

function MetCard({ label, value, sub, color, c }) {
  return (
    <View style={[mc.card, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
      <Text style={[mc.label, { color:c.textMuted, fontFamily:MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[mc.value, { color, fontFamily:MONO }]}>{value}</Text>
      <Text style={[mc.sub,   { color:c.textMuted, fontFamily:MONO }]}>{sub}</Text>
    </View>
  );
}
const mc = StyleSheet.create({
  card:  { flex:1, minWidth:'22%', borderWidth:1, borderRadius:8, padding:10, margin:3 },
  label: { fontSize:9, letterSpacing:0.8, marginBottom:2 },
  value: { fontSize:18, fontWeight:'600', letterSpacing:-0.3 },
  sub:   { fontSize:9, marginTop:1 },
});

// ─── ContactRow ───────────────────────────────────────────────────────────────

function ContactRow({ contact, c, onPress }) {
  const tc       = getTagColors(contact.tag, c);
  const followDue = isFollowUpDue(contact.followUpDate);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={[cr.row, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
      <View style={[cr.avatar, { backgroundColor:tc.bg, borderColor:tc.main }]}>
        <Text style={[cr.initials, { color:tc.main, fontFamily:MONO }]}>{getInitials(contact.name)}</Text>
      </View>
      <View style={{ flex:1, minWidth:0 }}>
        <Text style={[cr.name, { color:c.textPrimary, fontFamily:MONO }]} numberOfLines={1}>{contact.name || 'Unnamed'}</Text>
        <Text style={[cr.sub,  { color:c.textMuted,    fontFamily:MONO }]} numberOfLines={1}>{contact.company || contact.tag || ''}</Text>
      </View>
      {followDue && <View style={[cr.dot, { backgroundColor:c.amber }]} />}
      <Text style={{ color:c.textMuted, fontSize:14 }}>›</Text>
    </TouchableOpacity>
  );
}
const cr = StyleSheet.create({
  row:     { flexDirection:'row', alignItems:'center', gap:10, borderWidth:1, borderRadius:50, paddingHorizontal:14, paddingVertical:9, marginBottom:6 },
  avatar:  { width:30, height:30, borderRadius:15, borderWidth:1.5, alignItems:'center', justifyContent:'center', flexShrink:0 },
  initials:{ fontSize:11, fontWeight:'700' },
  name:    { fontSize:12, fontWeight:'600', marginBottom:1 },
  sub:     { fontSize:10 },
  dot:     { width:7, height:7, borderRadius:4, flexShrink:0 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:     { flex:1, alignItems:'center', justifyContent:'center' },
  scroll:       { padding:14, paddingBottom:60 },
  savedBadge:   { position:'absolute', bottom:16, right:16, zIndex:99, borderWidth:1, borderRadius:20, paddingHorizontal:14, paddingVertical:5 },
  savedText:    { fontSize:11, fontWeight:'600' },
  metRow:       { flexDirection:'row', flexWrap:'wrap', marginBottom:10 },
  searchInput:  { borderWidth:1, borderRadius:20, paddingHorizontal:14, paddingVertical:8, fontSize:12, marginBottom:10 },
  filterTag:    { borderWidth:1, borderRadius:20, paddingHorizontal:12, paddingVertical:5 },
  filterTagTxt: { fontSize:11, fontWeight:'600', letterSpacing:0.4 },
  emptyBox:     { borderWidth:1, borderStyle:'dashed', borderRadius:8, padding:28, alignItems:'center', marginBottom:8 },
  emptyTxt:     { fontSize:12 },
  addBubble:    { borderWidth:1.5, borderStyle:'dashed', borderRadius:50, paddingHorizontal:16, paddingVertical:9, alignSelf:'flex-start', marginTop:4 },
  addBubbleTxt: { fontSize:12, fontWeight:'600' },
  secLabel:     { fontSize:10, fontWeight:'600', letterSpacing:1, marginTop:16, marginBottom:8, paddingBottom:5, borderBottomWidth:1 },
  followRow:    { flexDirection:'row', alignItems:'center', gap:10, borderWidth:1, borderRadius:8, padding:10, marginBottom:5 },
  avatarSm:     { width:30, height:30, borderRadius:15, borderWidth:1.5, alignItems:'center', justifyContent:'center', flexShrink:0 },
  avatarTxt:    { fontSize:11, fontWeight:'700' },
  followName:   { fontSize:12, fontWeight:'600' },
  followSub:    { fontSize:10, marginTop:1 },
});
