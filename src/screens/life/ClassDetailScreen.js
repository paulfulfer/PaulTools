import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, Modal, Switch, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { MONO } from '../../theme';

// ─── Constants & helpers ──────────────────────────────────────────────────────

const COLORS       = ['#2a7de1','#0e9e70','#c27d08','#d03030','#6c5bbf','#e06030','#1899a8','#888888'];
const ASSIGN_TYPES = ['Homework','Quiz','Exam','Project','Reading','Lab','Discussion','Other'];

function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDateDisp(dateStr) {
  if (!dateStr) return 'No due date';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
function getDueColor(dateStr, c) {
  if (!dateStr) return c.textMuted;
  const today = new Date(); today.setHours(0,0,0,0);
  const diff  = Math.round((new Date(dateStr + 'T00:00:00') - today) / 86400000);
  if (diff < 0)  return c.red;
  if (diff <= 7) return c.amber;
  return c.textMuted;
}

// ─── Shared label ─────────────────────────────────────────────────────────────

function FLabel({ label, c }) {
  return (
    <Text style={{ fontSize:9, fontWeight:'600', letterSpacing:0.8, marginBottom:3, marginTop:10, color:c.textMuted, fontFamily:MONO }}>
      {label.toUpperCase()}
    </Text>
  );
}

// ─── Assignment row ───────────────────────────────────────────────────────────

function AssignmentRow({ assignment, courseColor, onToggleDone, onEdit, onDelete, c }) {
  const dueColor = getDueColor(assignment.due, c);
  return (
    <TouchableOpacity onPress={onEdit} activeOpacity={0.75}
      style={[ar.row, { backgroundColor: assignment.done ? c.bgBase : c.bgCard, borderColor:c.borderSubtle, opacity: assignment.done ? 0.6 : 1 }]}>
      <TouchableOpacity onPress={onToggleDone} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
        <View style={[ar.check, { borderColor: assignment.done ? courseColor : c.borderSubtle, backgroundColor: assignment.done ? courseColor : 'transparent' }]}>
          {assignment.done && <Text style={{ color:'#fff', fontSize:10, fontWeight:'700' }}>✓</Text>}
        </View>
      </TouchableOpacity>
      <View style={{ flex:1, minWidth:0 }}>
        <Text style={[ar.name, { color:c.textPrimary, fontFamily:MONO, textDecorationLine: assignment.done ? 'line-through' : 'none' }]} numberOfLines={1}>
          {assignment.name}
        </Text>
        <View style={ar.meta}>
          {!!assignment.type && (
            <View style={[ar.typePill, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]}>
              <Text style={[ar.typeTxt, { color:c.textMuted, fontFamily:MONO }]}>{assignment.type}</Text>
            </View>
          )}
          {!!assignment.grade && <Text style={[ar.grade, { color:c.green, fontFamily:MONO }]}>{assignment.grade}</Text>}
          <Text style={[ar.due, { color:dueColor, fontFamily:MONO }]}>{fmtDateDisp(assignment.due)}</Text>
        </View>
        {!!assignment.notes && <Text style={[ar.notes, { color:c.textMuted, fontFamily:MONO }]} numberOfLines={1}>{assignment.notes}</Text>}
      </View>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
        <Text style={{ color:c.textMuted, fontSize:14 }}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
const ar = StyleSheet.create({
  row:     { flexDirection:'row', alignItems:'center', gap:10, borderWidth:1, borderRadius:8, padding:10, marginBottom:5 },
  check:   { width:22, height:22, borderRadius:11, borderWidth:2, alignItems:'center', justifyContent:'center', flexShrink:0 },
  name:    { fontSize:12, fontWeight:'600', marginBottom:3 },
  meta:    { flexDirection:'row', alignItems:'center', flexWrap:'wrap', gap:6 },
  typePill:{ borderWidth:1, borderRadius:10, paddingHorizontal:6, paddingVertical:1 },
  typeTxt: { fontSize:9, fontWeight:'600', letterSpacing:0.5 },
  grade:   { fontSize:11, fontWeight:'700' },
  due:     { fontSize:10 },
  notes:   { fontSize:10, fontStyle:'italic', marginTop:3 },
});

// ─── Assignment Modal (isolated — reads theme internally, never re-renders from parent) ──

const AssignmentModal = React.memo(function AssignmentModal({ visible, initialValues, onSave, onClose }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [name,          setName]          = useState('');
  const [type,          setType]          = useState('Homework');
  const [hasDue,        setHasDue]        = useState(false);
  const [date,          setDate]          = useState(new Date());
  const [grade,         setGrade]         = useState('');
  const [notes,         setNotes]         = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Populate / reset whenever the modal opens or switches between add and edit
  useEffect(() => {
    if (!visible) return;
    if (initialValues) {
      setName(initialValues.name  || '');
      setType(initialValues.type  || 'Homework');
      setGrade(initialValues.grade || '');
      setNotes(initialValues.notes || '');
      setHasDue(!!initialValues.due);
      setDate(initialValues.due ? new Date(initialValues.due + 'T12:00:00') : new Date());
    } else {
      setName(''); setType('Homework'); setGrade(''); setNotes('');
      setHasDue(false); setDate(new Date());
    }
    setShowDatePicker(false);
  }, [visible, initialValues]);

  const handleSave = () => {
    if (!name.trim()) return Alert.alert('Required', 'Assignment name is required.');
    onSave(
      { name: name.trim(), type, due: hasDue ? fmtDateKey(date) : '', grade: grade.trim(), notes: notes.trim() },
      initialValues?.id ?? null,
    );
  };

  const isEdit = !!initialValues;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={[ms.sheet, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
          <View style={[ms.header, { borderBottomColor: c.borderSubtle }]}>
            <Text style={[ms.title, { color: c.textPrimary, fontFamily: MONO }]}>
              {isEdit ? 'Edit Assignment' : 'Add Assignment'}
            </Text>
            <TouchableOpacity style={[ms.closeBtn, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]} onPress={onClose}>
              <Text style={{ color: c.textMuted, fontSize: 14 }}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={ms.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <FLabel label="Name *" c={c} />
            <TextInput
              style={[ms.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              value={name} onChangeText={setName}
              placeholder="Assignment name" placeholderTextColor={c.textMuted}
              autoCorrect={false}
            />

            <FLabel label="Type" c={c} />
            <View style={[ms.pickerBox, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}>
              <Picker selectedValue={type} onValueChange={setType}
                style={{ color: c.textPrimary }} dropdownIconColor={c.textMuted}
                itemStyle={{ fontSize: 13, color: c.textPrimary, fontFamily: MONO }}>
                {ASSIGN_TYPES.map(t => <Picker.Item key={t} label={t} value={t} color={c.textPrimary} />)}
              </Picker>
            </View>

            <View style={ms.switchRow}>
              <Text style={[ms.switchLabel, { color: c.textMuted, fontFamily: MONO }]}>Has due date</Text>
              <Switch value={hasDue} onValueChange={setHasDue}
                trackColor={{ false: c.borderSubtle, true: c.blueGlow }}
                thumbColor={hasDue ? c.blue : c.textMuted} />
            </View>

            {hasDue && (
              <>
                <FLabel label="Due Date" c={c} />
                <TouchableOpacity
                  style={[ms.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: c.textPrimary, fontFamily: MONO, fontSize: 12 }}>
                    {date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={date} mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => {
                      if (Platform.OS === 'android') setShowDatePicker(false);
                      if (d) setDate(d);
                    }}
                    textColor={c.textPrimary}
                  />
                )}
              </>
            )}

            <View style={ms.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <FLabel label="Grade" c={c} />
                <TextInput
                  style={[ms.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={grade} onChangeText={setGrade}
                  placeholder="e.g. 95 or A-" placeholderTextColor={c.textMuted}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <FLabel label="Notes" c={c} />
                <TextInput
                  style={[ms.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={notes} onChangeText={setNotes}
                  placeholder="Optional" placeholderTextColor={c.textMuted}
                />
              </View>
            </View>

            <View style={[ms.actions, { borderTopColor: c.borderSubtle }]}>
              <TouchableOpacity onPress={onClose} style={[ms.btn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}>
                <Text style={[ms.btnTxt, { color: c.textMuted, fontFamily: MONO }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={[ms.btn, { backgroundColor: c.blueGlow, borderColor: c.blue }]}>
                <Text style={[ms.btnTxt, { color: c.blue, fontFamily: MONO }]}>{isEdit ? 'Save Changes' : 'Add Assignment'}</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

// ─── Edit Course Modal (isolated — same pattern) ───────────────────────────────

const EditCourseModal = React.memo(function EditCourseModal({ visible, initialValues, onSave, onClose }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [name,  setName]  = useState('');
  const [code,  setCode]  = useState('');
  const [prof,  setProf]  = useState('');
  const [sem,   setSem]   = useState('');
  const [creds, setCreds] = useState('3');
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (!visible || !initialValues) return;
    setName(initialValues.name      || '');
    setCode(initialValues.code      || '');
    setProf(initialValues.professor || '');
    setSem(initialValues.semester   || '');
    setCreds(String(initialValues.credits || 3));
    setColor(initialValues.color    || COLORS[0]);
  }, [visible, initialValues]);

  const handleSave = () => {
    if (!name.trim()) return Alert.alert('Required', 'Course name is required.');
    onSave({ name: name.trim(), code: code.trim(), professor: prof.trim(), semester: sem.trim(), credits: parseInt(creds) || 3, color });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={[ms.sheet, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
          <View style={[ms.header, { borderBottomColor: c.borderSubtle }]}>
            <Text style={[ms.title, { color: c.textPrimary, fontFamily: MONO }]}>Edit Course</Text>
            <TouchableOpacity style={[ms.closeBtn, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]} onPress={onClose}>
              <Text style={{ color: c.textMuted, fontSize: 14 }}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={ms.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <FLabel label="Course Name *" c={c} />
            <TextInput
              style={[ms.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              value={name} onChangeText={setName}
              placeholder="e.g. American History" placeholderTextColor={c.textMuted}
            />

            <View style={ms.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <FLabel label="Course Code" c={c} />
                <TextInput
                  style={[ms.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={code} onChangeText={setCode}
                  placeholder="HIST201" placeholderTextColor={c.textMuted}
                  autoCorrect={false} autoCapitalize="characters"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <FLabel label="Credits" c={c} />
                <TextInput
                  style={[ms.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={creds} onChangeText={setCreds}
                  keyboardType="number-pad" placeholder="3" placeholderTextColor={c.textMuted}
                />
              </View>
            </View>

            <FLabel label="Professor" c={c} />
            <TextInput
              style={[ms.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              value={prof} onChangeText={setProf}
              placeholder="Prof. Benowitz" placeholderTextColor={c.textMuted}
            />

            <FLabel label="Semester" c={c} />
            <TextInput
              style={[ms.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              value={sem} onChangeText={setSem}
              placeholder="Fall 2026" placeholderTextColor={c.textMuted}
            />

            <FLabel label="Color" c={c} />
            <View style={ms.colorRow}>
              {COLORS.map(col => (
                <TouchableOpacity key={col} onPress={() => setColor(col)}
                  style={[ms.swatch, { backgroundColor: col, borderWidth: color === col ? 3 : 0, borderColor: '#fff' }]} />
              ))}
            </View>

            <View style={[ms.actions, { borderTopColor: c.borderSubtle }]}>
              <TouchableOpacity onPress={onClose} style={[ms.btn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}>
                <Text style={[ms.btnTxt, { color: c.textMuted, fontFamily: MONO }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={[ms.btn, { backgroundColor: c.blueGlow, borderColor: c.blue }]}>
                <Text style={[ms.btnTxt, { color: c.blue, fontFamily: MONO }]}>Save Changes</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

// Shared modal stylesheet
const ms = StyleSheet.create({
  overlay:   { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.45)' },
  sheet:     { flex:1, marginTop:72, borderTopLeftRadius:20, borderTopRightRadius:20, borderTopWidth:1, borderLeftWidth:1, borderRightWidth:1, overflow:'hidden' },
  header:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, borderBottomWidth:1 },
  title:     { fontSize:15, fontWeight:'600', flex:1, marginRight:10 },
  closeBtn:  { width:28, height:28, borderRadius:14, borderWidth:1, alignItems:'center', justifyContent:'center' },
  body:      { padding:18, paddingBottom:36 },
  input:     { borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:7, fontSize:12, marginBottom:2 },
  pickerBox: { borderWidth:1, borderRadius:6, marginBottom:2, overflow:'hidden' },
  switchRow: { flexDirection:'row', alignItems:'center', marginTop:10, marginBottom:4 },
  switchLabel:{ flex:1, fontSize:12 },
  row:       { flexDirection:'row' },
  colorRow:  { flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:6, marginBottom:6 },
  swatch:    { width:28, height:28, borderRadius:14 },
  actions:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:18, paddingTop:14, borderTopWidth:1 },
  btn:       { borderWidth:1, borderRadius:20, paddingVertical:7, paddingHorizontal:18 },
  btnTxt:    { fontSize:12, fontWeight:'600' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ClassDetailScreen({ route, navigation }) {
  const { courseId } = route.params;
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;

  // ── Data state ──────────────────────────────────────────
  const [courses,      setCourses]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saved,        setSaved]        = useState(false);

  // Inline fields — save on blur, live in parent (not inside a modal)
  const [currentGrade, setCurrentGrade] = useState('');
  const [finalGrade,   setFinalGrade]   = useState('');
  const [courseNotes,  setCourseNotes]  = useState('');

  // Modal visibility + seed data (only these stay in parent)
  const [assignModal,    setAssignModal]    = useState(false);
  const [editingAssign,  setEditingAssign]  = useState(null); // null=add, object=edit
  const [editCourseModal, setEditCourseModal] = useState(false);
  const [editCourseSnap, setEditCourseSnap]  = useState(null); // snapshot passed to EditCourseModal

  // ── Refs — keep latest values for stable callbacks ──────
  const coursesRef    = useRef(courses);
  const courseIdRef   = useRef(courseId);
  const userRef       = useRef(user);
  const navigationRef = useRef(navigation);
  useEffect(() => { coursesRef.current    = courses;    }, [courses]);
  useEffect(() => { courseIdRef.current   = courseId;   }, [courseId]);
  useEffect(() => { userRef.current       = user;       }, [user]);
  useEffect(() => { navigationRef.current = navigation; }, [navigation]);

  // ── Firestore write (reads from refs so it can be called from stable callbacks)
  const writeFirestore = async (updCourses) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    await firebase.firestore()
      .collection('users').doc(uid)
      .collection('localStorage').doc('data')
      .set({ acad_courses: JSON.stringify(updCourses) }, { merge: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  // ── Stable callbacks — passed to React.memo modals ─────
  // Empty dep arrays intentional: refs give us fresh values at call time.

  const onSaveAssignStable = useCallback(async (fields, editingId) => {
    const allCourses = coursesRef.current;
    const cId        = courseIdRef.current;
    const course     = allCourses.find(c2 => c2.id === cId);
    const assigns    = course?.assignments || [];
    const updAssigns = editingId != null
      ? assigns.map(a => a.id === editingId ? { ...a, ...fields } : a)
      : [...assigns, { id: Date.now(), done: false, ...fields }];
    const updCourses = allCourses.map(c2 => c2.id === cId ? { ...c2, assignments: updAssigns } : c2);
    setCourses(updCourses);
    setAssignModal(false);
    try { await writeFirestore(updCourses); }
    catch (err) { Alert.alert('Save error', err.message); }
  }, []);

  const onCloseAssignStable = useCallback(() => setAssignModal(false), []);

  const onSaveEditCourseStable = useCallback(async (fields) => {
    const allCourses = coursesRef.current;
    const cId        = courseIdRef.current;
    const updCourses = allCourses.map(c2 => c2.id === cId ? { ...c2, ...fields } : c2);
    setCourses(updCourses);
    setEditCourseModal(false);
    navigationRef.current?.setOptions({
      title: fields.code ? `${fields.code} — ${fields.name}` : fields.name,
    });
    try { await writeFirestore(updCourses); }
    catch (err) { Alert.alert('Save error', err.message); }
  }, []);

  const onCloseEditCourseStable = useCallback(() => setEditCourseModal(false), []);

  // ── Load ────────────────────────────────────────────────
  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const uid  = user?.uid;
      if (!uid) return;
      const snap = await firebase.firestore()
        .collection('users').doc(uid)
        .collection('localStorage').doc('data').get();
      const d      = snap.exists ? snap.data() : {};
      const loaded = JSON.parse(d.acad_courses || '[]');
      setCourses(loaded);
      const found = loaded.find(c2 => c2.id === courseId);
      if (found) {
        setCurrentGrade(found.currentGrade || '');
        setFinalGrade(found.finalGrade   || '');
        setCourseNotes(found.notes        || '');
        navigation.setOptions({
          title: found.code ? `${found.code} — ${found.name}` : found.name,
        });
      }
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  // ── Inline-field save (blur) ─────────────────────────────
  const saveField = async (fields) => {
    const allCourses = coursesRef.current;
    const cId        = courseIdRef.current;
    const updCourses = allCourses.map(c2 => c2.id === cId ? { ...c2, ...fields } : c2);
    setCourses(updCourses);
    try { await writeFirestore(updCourses); }
    catch (err) { Alert.alert('Save error', err.message); }
  };

  // ── Assignment actions ───────────────────────────────────
  const openAddAssign  = () => { setEditingAssign(null); setAssignModal(true); };
  const openEditAssign = (a) => { setEditingAssign(a);   setAssignModal(true); };

  const toggleDone = async (assignId) => {
    const allCourses = coursesRef.current;
    const cId        = courseIdRef.current;
    const course     = allCourses.find(c2 => c2.id === cId);
    const assigns    = (course?.assignments || []).map(a => a.id === assignId ? { ...a, done: !a.done } : a);
    const updCourses = allCourses.map(c2 => c2.id === cId ? { ...c2, assignments: assigns } : c2);
    setCourses(updCourses);
    try { await writeFirestore(updCourses); }
    catch (err) { Alert.alert('Save error', err.message); }
  };

  const deleteAssign = (assignId) => {
    Alert.alert('Delete assignment?', '', [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        const allCourses = coursesRef.current;
        const cId        = courseIdRef.current;
        const course     = allCourses.find(c2 => c2.id === cId);
        const assigns    = (course?.assignments || []).filter(a => a.id !== assignId);
        const updCourses = allCourses.map(c2 => c2.id === cId ? { ...c2, assignments: assigns } : c2);
        setCourses(updCourses);
        try { await writeFirestore(updCourses); }
        catch (err) { Alert.alert('Save error', err.message); }
      }},
    ]);
  };

  // ── Course actions ───────────────────────────────────────
  const openEditCourse = () => {
    const course = coursesRef.current.find(c2 => c2.id === courseIdRef.current);
    if (!course) return;
    setEditCourseSnap({ ...course }); // stable snapshot, won't change until next open
    setEditCourseModal(true);
  };

  const toggleArchive = async () => {
    const allCourses = coursesRef.current;
    const cId        = courseIdRef.current;
    const course     = allCourses.find(c2 => c2.id === cId);
    const updCourses = allCourses.map(c2 => c2.id === cId ? { ...c2, archived: !course?.archived } : c2);
    setCourses(updCourses);
    try { await writeFirestore(updCourses); }
    catch (err) { Alert.alert('Save error', err.message); }
  };

  const deleteCourse = () => {
    Alert.alert('Delete course?', 'This will remove all assignments. This cannot be undone.', [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        const uid = userRef.current?.uid;
        if (!uid) return;
        const updated = coursesRef.current.filter(c2 => c2.id !== courseIdRef.current);
        setCourses(updated);
        try {
          await firebase.firestore().collection('users').doc(uid)
            .collection('localStorage').doc('data')
            .set({ acad_courses: JSON.stringify(updated) }, { merge: true });
          navigation.goBack();
        } catch (err) { Alert.alert('Save error', err.message); }
      }},
    ]);
  };

  // ── Render ──────────────────────────────────────────────
  if (loading) {
    return <View style={[s.centered, { backgroundColor: c.bgBase }]}><ActivityIndicator color={c.blue} size="large" /></View>;
  }

  const course     = courses.find(c2 => c2.id === courseId);
  if (!course) {
    return <View style={[s.centered, { backgroundColor: c.bgBase }]}><Text style={{ color: c.textMuted }}>Course not found.</Text></View>;
  }

  const incomplete = (course.assignments || []).filter(a => !a.done);
  const done       = (course.assignments || []).filter(a =>  a.done);

  return (
    <View style={{ flex:1, backgroundColor:c.bgBase }}>
      {saved && (
        <View style={[s.savedBadge, { backgroundColor:c.greenGlow, borderColor:c.green }]}>
          <Text style={[s.savedText, { color:c.green, fontFamily:MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Course header ─────────────────────────── */}
        <View style={[s.courseHeader, { borderLeftColor: course.color || '#2a7de1', backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
          <View style={{ flex:1 }}>
            <Text style={[s.courseName, { color:c.textPrimary, fontFamily:MONO }]}>{course.name}</Text>
            {!!course.code      && <Text style={[s.courseMeta, { color:c.textMuted, fontFamily:MONO }]}>{course.code}</Text>}
            {!!course.professor && <Text style={[s.courseMeta, { color:c.textMuted, fontFamily:MONO }]}>{course.professor}</Text>}
            <View style={{ flexDirection:'row', gap:12, marginTop:4 }}>
              {!!course.semester && <Text style={[s.courseMeta, { color:c.textMuted, fontFamily:MONO }]}>{course.semester}</Text>}
              {!!course.credits  && <Text style={[s.courseMeta, { color:c.textMuted, fontFamily:MONO }]}>{course.credits} credits</Text>}
            </View>
          </View>
          <TouchableOpacity onPress={openEditCourse} style={[s.editBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]}>
            <Text style={[s.editBtnTxt, { color:c.textMuted, fontFamily:MONO }]}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* ── Grades ──────────────────────────────────── */}
        <View style={s.gradeRow}>
          <View style={{ flex:1, marginRight:8 }}>
            <FLabel label="Current Grade" c={c} />
            <TextInput
              style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
              value={currentGrade} onChangeText={setCurrentGrade}
              onBlur={() => saveField({ currentGrade })}
              placeholder="e.g. B+ or 91.4%" placeholderTextColor={c.textMuted}
            />
          </View>
          <View style={{ flex:1, marginLeft:8 }}>
            <FLabel label="Final Grade (GPA)" c={c} />
            <TextInput
              style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
              value={finalGrade} onChangeText={setFinalGrade}
              onBlur={() => saveField({ finalGrade })}
              placeholder="e.g. A-" placeholderTextColor={c.textMuted}
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* ── Assignments ─────────────────────────────── */}
        <View style={s.sectionHead}>
          <Text style={[s.secLabel, { color:c.textMuted, fontFamily:MONO }]}>ASSIGNMENTS</Text>
          <TouchableOpacity style={[s.addBtn, { backgroundColor:c.blueGlow, borderColor:c.blue }]} onPress={openAddAssign}>
            <Text style={[s.addBtnTxt, { color:c.blue, fontFamily:MONO }]}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {(course.assignments || []).length === 0 ? (
          <Text style={[s.emptyNote, { color:c.textMuted, fontFamily:MONO }]}>No assignments yet.</Text>
        ) : (
          <>
            {incomplete.map(a => (
              <AssignmentRow key={a.id} assignment={a} courseColor={course.color} c={c}
                onToggleDone={() => toggleDone(a.id)}
                onEdit={() => openEditAssign(a)}
                onDelete={() => deleteAssign(a.id)} />
            ))}
            {done.length > 0 && (
              <>
                <Text style={[s.doneHeader, { color:c.textMuted, fontFamily:MONO }]}>COMPLETED ({done.length})</Text>
                {done.map(a => (
                  <AssignmentRow key={a.id} assignment={a} courseColor={course.color} c={c}
                    onToggleDone={() => toggleDone(a.id)}
                    onEdit={() => openEditAssign(a)}
                    onDelete={() => deleteAssign(a.id)} />
                ))}
              </>
            )}
          </>
        )}

        {/* ── Notes ───────────────────────────────────── */}
        <FLabel label="Course Notes" c={c} />
        <TextInput
          style={[s.notesInput, { borderColor:c.borderSubtle, backgroundColor:c.bgCard, color:c.textPrimary, fontFamily:MONO }]}
          value={courseNotes}
          onChangeText={setCourseNotes}
          onBlur={() => saveField({ notes: courseNotes })}
          placeholder="Notes, reminders, links…"
          placeholderTextColor={c.textMuted}
          multiline
        />

        {/* ── Actions ─────────────────────────────────── */}
        <View style={[s.actionsRow, { borderTopColor:c.borderSubtle }]}>
          <TouchableOpacity onPress={toggleArchive} style={[s.archiveBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgCard }]}>
            <Text style={[s.archiveTxt, { color:c.textMuted, fontFamily:MONO }]}>{course.archived ? '↩ Unarchive' : '📦 Archive'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={deleteCourse} style={[s.deleteBtn, { borderColor:c.red, backgroundColor:c.redGlow }]}>
            <Text style={[s.deleteTxt, { color:c.red, fontFamily:MONO }]}>Delete Course</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Isolated modals — never re-render from parent state changes */}
      <AssignmentModal
        visible={assignModal}
        initialValues={editingAssign}
        onSave={onSaveAssignStable}
        onClose={onCloseAssignStable}
      />
      <EditCourseModal
        visible={editCourseModal}
        initialValues={editCourseSnap}
        onSave={onSaveEditCourseStable}
        onClose={onCloseEditCourseStable}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:     { flex:1, alignItems:'center', justifyContent:'center' },
  scroll:       { padding:14, paddingBottom:60 },
  savedBadge:   { position:'absolute', bottom:16, right:16, zIndex:99, borderWidth:1, borderRadius:20, paddingHorizontal:14, paddingVertical:5 },
  savedText:    { fontSize:11, fontWeight:'600' },

  courseHeader: { flexDirection:'row', alignItems:'flex-start', borderWidth:1, borderLeftWidth:4, borderRadius:10, padding:14, marginBottom:12 },
  courseName:   { fontSize:16, fontWeight:'700', marginBottom:3 },
  courseMeta:   { fontSize:11, marginBottom:1 },
  editBtn:      { borderWidth:1, borderRadius:20, paddingHorizontal:12, paddingVertical:5, marginLeft:10 },
  editBtnTxt:   { fontSize:11, fontWeight:'600' },

  gradeRow:     { flexDirection:'row' },
  input:        { borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:7, fontSize:12, marginBottom:2 },

  sectionHead:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:18, marginBottom:8 },
  secLabel:     { fontSize:10, fontWeight:'600', letterSpacing:1 },
  addBtn:       { borderWidth:1, borderRadius:20, paddingHorizontal:12, paddingVertical:4 },
  addBtnTxt:    { fontSize:11, fontWeight:'600' },
  doneHeader:   { fontSize:9, fontWeight:'600', letterSpacing:1, marginTop:10, marginBottom:6 },
  emptyNote:    { fontSize:11, fontStyle:'italic', marginBottom:8 },

  notesInput:   { borderWidth:1, borderRadius:8, padding:12, fontSize:12, minHeight:80, textAlignVertical:'top' },

  actionsRow:   { flexDirection:'row', justifyContent:'space-between', marginTop:24, paddingTop:16, borderTopWidth:1, gap:10 },
  archiveBtn:   { flex:1, borderWidth:1, borderRadius:20, paddingVertical:8, alignItems:'center' },
  archiveTxt:   { fontSize:12, fontWeight:'600' },
  deleteBtn:    { flex:1, borderWidth:1, borderRadius:20, paddingVertical:8, alignItems:'center' },
  deleteTxt:    { fontSize:12, fontWeight:'600' },
});
