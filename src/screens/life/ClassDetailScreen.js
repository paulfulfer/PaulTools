import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, Modal, KeyboardAvoidingView,
  Switch, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// ─── Constants & helpers ──────────────────────────────────────────────────────

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const COLORS      = ['#2a7de1','#0e9e70','#c27d08','#d03030','#6c5bbf','#e06030','#1899a8','#888888'];
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
  const due   = new Date(dateStr + 'T00:00:00');
  const diff  = Math.round((due - today) / 86400000);
  if (diff < 0)  return c.red;
  if (diff <= 1) return c.amber;
  if (diff <= 7) return c.amber;
  return c.textMuted;
}

// ─── Assignment row ───────────────────────────────────────────────────────────

function AssignmentRow({ assignment, courseColor, onToggleDone, onEdit, onDelete, c }) {
  const dueColor = getDueColor(assignment.due, c);
  return (
    <TouchableOpacity onPress={onEdit} activeOpacity={0.75}
      style={[ar.row, { backgroundColor: assignment.done ? c.bgBase : c.bgCard, borderColor:c.borderSubtle, opacity: assignment.done ? 0.6 : 1 }]}>
      {/* Done toggle */}
      <TouchableOpacity onPress={onToggleDone} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
        <View style={[ar.check, { borderColor: assignment.done ? courseColor : c.borderSubtle, backgroundColor: assignment.done ? courseColor : 'transparent' }]}>
          {assignment.done && <Text style={{ color:'#fff', fontSize:10, fontWeight:'700' }}>✓</Text>}
        </View>
      </TouchableOpacity>
      {/* Info */}
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
      {/* Delete */}
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

function FLabel({ label, c }) {
  return <Text style={{ fontSize:9, fontWeight:'600', letterSpacing:0.8, marginBottom:3, marginTop:10, color:c.textMuted, fontFamily:MONO }}>{label.toUpperCase()}</Text>;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ClassDetailScreen({ route, navigation }) {
  const { courseId } = route.params;
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;

  const [courses,    setCourses]    = useState([]);
  const [idCounter,  setIdCounter]  = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [saved,      setSaved]      = useState(false);

  // Inline grade & notes state (saves on blur)
  const [currentGrade, setCurrentGrade] = useState('');
  const [finalGrade,   setFinalGrade]   = useState('');
  const [courseNotes,  setCourseNotes]  = useState('');

  // Assignment modal
  const [assignModal,  setAssignModal]  = useState(false);
  const [editingAssign, setEditingAssign] = useState(null); // null = add, object = edit
  const [fName,   setFName]   = useState('');
  const [fType,   setFType]   = useState('Homework');
  const [fDate,   setFDate]   = useState(new Date());
  const [fGrade,  setFGrade]  = useState('');
  const [fNotes,  setFNotes]  = useState('');
  const [fHasDue, setFHasDue] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Edit course modal
  const [editModal,   setEditModal]   = useState(false);
  const [eName,   setEName]   = useState('');
  const [eCode,   setECode]   = useState('');
  const [eProf,   setEProf]   = useState('');
  const [eSem,    setESem]    = useState('');
  const [eCreds,  setECreds]  = useState('');
  const [eColor,  setEColor]  = useState(COLORS[0]);

  const docRef = () =>
    firebase.firestore().collection('users').doc(user.uid).collection('localStorage').doc('data');

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const persist = async (updCourses) => {
    try {
      await docRef().set({ acad_courses: JSON.stringify(updCourses) }, { merge: true });
      flash();
    } catch (err) { Alert.alert('Save error', err.message); }
  };

  const updateCourse = async (fields) => {
    const updated = courses.map(c2 => c2.id === courseId ? { ...c2, ...fields } : c2);
    setCourses(updated);
    await persist(updated);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await docRef().get();
      const d = snap.exists ? snap.data() : {};
      const loaded = JSON.parse(d.acad_courses || '[]');
      setCourses(loaded);
      setIdCounter(parseInt(d.acad_id_counter || '1'));
      const course = loaded.find(c2 => c2.id === courseId);
      if (course) {
        setCurrentGrade(course.currentGrade || '');
        setFinalGrade(course.finalGrade || '');
        setCourseNotes(course.notes || '');
        navigation.setOptions({
          title: course.code ? `${course.code} — ${course.name}` : course.name,
        });
      }
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  const course = courses.find(c2 => c2.id === courseId);

  // ── Assignment CRUD ──────────────────────────────────────

  const openAddAssign = () => {
    setEditingAssign(null);
    setFName(''); setFType('Homework'); setFGrade(''); setFNotes('');
    setFDate(new Date()); setFHasDue(false);
    setAssignModal(true);
  };

  const openEditAssign = (a) => {
    setEditingAssign(a);
    setFName(a.name || ''); setFType(a.type || 'Homework');
    setFGrade(a.grade || ''); setFNotes(a.notes || '');
    setFHasDue(!!a.due);
    setFDate(a.due ? new Date(a.due + 'T12:00:00') : new Date());
    setAssignModal(true);
  };

  const saveAssign = async () => {
    if (!fName.trim()) return Alert.alert('Required', 'Assignment name is required.');
    const assignments = course?.assignments || [];
    let updAssignments;
    if (editingAssign) {
      updAssignments = assignments.map(a =>
        a.id === editingAssign.id
          ? { ...a, name:fName.trim(), type:fType, due: fHasDue ? fmtDateKey(fDate) : '', grade:fGrade.trim(), notes:fNotes.trim() }
          : a
      );
    } else {
      const newAssign = { id: Date.now(), name:fName.trim(), type:fType, due: fHasDue ? fmtDateKey(fDate) : '', done:false, grade:fGrade.trim(), notes:fNotes.trim() };
      updAssignments = [...assignments, newAssign];
    }
    setAssignModal(false);
    await updateCourse({ assignments: updAssignments });
  };

  const toggleDone = async (assignId) => {
    const assignments = (course?.assignments || []).map(a =>
      a.id === assignId ? { ...a, done: !a.done } : a
    );
    await updateCourse({ assignments });
  };

  const deleteAssign = (assignId) => {
    Alert.alert('Delete assignment?', '', [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        const assignments = (course?.assignments || []).filter(a => a.id !== assignId);
        await updateCourse({ assignments });
      }},
    ]);
  };

  // ── Edit course ─────────────────────────────────────────

  const openEditCourse = () => {
    if (!course) return;
    setEName(course.name || ''); setECode(course.code || '');
    setEProf(course.professor || ''); setESem(course.semester || '');
    setECreds(String(course.credits || 3)); setEColor(course.color || COLORS[0]);
    setEditModal(true);
  };

  const saveEditCourse = async () => {
    if (!eName.trim()) return Alert.alert('Required', 'Course name is required.');
    const fields = { name:eName.trim(), code:eCode.trim(), professor:eProf.trim(), semester:eSem.trim(), credits:parseInt(eCreds)||3, color:eColor };
    setEditModal(false);
    navigation.setOptions({ title: eCode.trim() ? `${eCode.trim()} — ${eName.trim()}` : eName.trim() });
    await updateCourse(fields);
  };

  // ── Archive / Delete ────────────────────────────────────

  const toggleArchive = async () => {
    await updateCourse({ archived: !course?.archived });
  };

  const deleteCourse = () => {
    Alert.alert('Delete course?', 'This will remove all assignments. This cannot be undone.', [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        const updated = courses.filter(c2 => c2.id !== courseId);
        setCourses(updated);
        await persist(updated);
        navigation.goBack();
      }},
    ]);
  };

  if (loading || !course) {
    return <View style={[s.centered, { backgroundColor:c.bgBase }]}><ActivityIndicator color={c.blue} size="large" /></View>;
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
              onBlur={() => updateCourse({ currentGrade })}
              placeholder="e.g. B+ or 91.4%" placeholderTextColor={c.textMuted}
            />
          </View>
          <View style={{ flex:1, marginLeft:8 }}>
            <FLabel label="Final Grade (GPA)" c={c} />
            <TextInput
              style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
              value={finalGrade} onChangeText={setFinalGrade}
              onBlur={() => updateCourse({ finalGrade })}
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
          onBlur={() => updateCourse({ notes: courseNotes })}
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

      {/* ── Add/Edit Assignment Modal ────────────────── */}
      <Modal visible={assignModal} animationType="slide" transparent onRequestClose={() => setAssignModal(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'}
            style={[s.modalSheet, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
            <View style={[s.modalHeader, { borderBottomColor:c.borderSubtle }]}>
              <Text style={[s.modalTitle, { color:c.textPrimary, fontFamily:MONO }]}>{editingAssign ? 'Edit Assignment' : 'Add Assignment'}</Text>
              <TouchableOpacity style={[s.closeBtn, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]} onPress={() => setAssignModal(false)}>
                <Text style={{ color:c.textMuted, fontSize:14 }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex:1 }} contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">

              <FLabel label="Name *" c={c} />
              <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                value={fName} onChangeText={setFName} placeholder="Assignment name" placeholderTextColor={c.textMuted} />

              <FLabel label="Type" c={c} />
              <View style={[s.pickerBox, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]}>
                <Picker selectedValue={fType} onValueChange={setFType} style={{ color:c.textPrimary }} dropdownIconColor={c.textMuted}
                  itemStyle={{ fontSize:13, color:c.textPrimary, fontFamily:MONO }}>
                  {ASSIGN_TYPES.map(t => <Picker.Item key={t} label={t} value={t} color={c.textPrimary} />)}
                </Picker>
              </View>

              <View style={[s.gradeRow, { alignItems:'center', marginTop:0 }]}>
                <Text style={[s.switchLabel, { color:c.textMuted, fontFamily:MONO }]}>Has due date</Text>
                <Switch value={fHasDue} onValueChange={setFHasDue}
                  trackColor={{ false:c.borderSubtle, true:c.blueGlow }} thumbColor={fHasDue?c.blue:c.textMuted} />
              </View>

              {fHasDue && (
                <>
                  <FLabel label="Due Date" c={c} />
                  <TouchableOpacity style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]} onPress={() => setShowDatePicker(true)}>
                    <Text style={{ color:c.textPrimary, fontFamily:MONO, fontSize:12 }}>{fDate.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker value={fDate} mode="date"
                      display={Platform.OS==='ios'?'spinner':'default'}
                      onChange={(e, d) => { if (Platform.OS==='android') setShowDatePicker(false); if (d) setFDate(d); }}
                      textColor={c.textPrimary} />
                  )}
                </>
              )}

              <View style={s.gradeRow}>
                <View style={{ flex:1, marginRight:8 }}>
                  <FLabel label="Grade" c={c} />
                  <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                    value={fGrade} onChangeText={setFGrade} placeholder="e.g. 95 or A-" placeholderTextColor={c.textMuted} />
                </View>
                <View style={{ flex:1, marginLeft:8 }}>
                  <FLabel label="Notes" c={c} />
                  <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                    value={fNotes} onChangeText={setFNotes} placeholder="Optional" placeholderTextColor={c.textMuted} />
                </View>
              </View>

              <View style={[s.modalActions, { borderTopColor:c.borderSubtle }]}>
                <TouchableOpacity onPress={() => setAssignModal(false)} style={[s.actionBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]}>
                  <Text style={[s.actionTxt, { color:c.textMuted, fontFamily:MONO }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveAssign} style={[s.actionBtn, { backgroundColor:c.blueGlow, borderColor:c.blue }]}>
                  <Text style={[s.actionTxt, { color:c.blue, fontFamily:MONO }]}>{editingAssign ? 'Save Changes' : 'Add Assignment'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Edit Course Modal ────────────────────────── */}
      <Modal visible={editModal} animationType="slide" transparent onRequestClose={() => setEditModal(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'}
            style={[s.modalSheet, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
            <View style={[s.modalHeader, { borderBottomColor:c.borderSubtle }]}>
              <Text style={[s.modalTitle, { color:c.textPrimary, fontFamily:MONO }]}>Edit Course</Text>
              <TouchableOpacity style={[s.closeBtn, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]} onPress={() => setEditModal(false)}>
                <Text style={{ color:c.textMuted, fontSize:14 }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex:1 }} contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              <FLabel label="Course Name *" c={c} />
              <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                value={eName} onChangeText={setEName} placeholder="e.g. American History" placeholderTextColor={c.textMuted} />
              <View style={s.gradeRow}>
                <View style={{ flex:1, marginRight:8 }}>
                  <FLabel label="Course Code" c={c} />
                  <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                    value={eCode} onChangeText={setECode} placeholder="HIST201" placeholderTextColor={c.textMuted} />
                </View>
                <View style={{ flex:1, marginLeft:8 }}>
                  <FLabel label="Credits" c={c} />
                  <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                    value={eCreds} onChangeText={setECreds} keyboardType="number-pad" placeholder="3" placeholderTextColor={c.textMuted} />
                </View>
              </View>
              <FLabel label="Professor" c={c} />
              <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                value={eProf} onChangeText={setEProf} placeholder="Prof. Benowitz" placeholderTextColor={c.textMuted} />
              <FLabel label="Semester" c={c} />
              <TextInput style={[s.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
                value={eSem} onChangeText={setESem} placeholder="Fall 2026" placeholderTextColor={c.textMuted} />
              <FLabel label="Color" c={c} />
              <View style={s.colorRow}>
                {COLORS.map(col => (
                  <TouchableOpacity key={col} onPress={() => setEColor(col)}
                    style={[s.colorSwatch, { backgroundColor:col, borderWidth: eColor===col ? 3 : 0, borderColor:'#fff' }]} />
                ))}
              </View>
              <View style={[s.modalActions, { borderTopColor:c.borderSubtle }]}>
                <TouchableOpacity onPress={() => setEditModal(false)} style={[s.actionBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]}>
                  <Text style={[s.actionTxt, { color:c.textMuted, fontFamily:MONO }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveEditCourse} style={[s.actionBtn, { backgroundColor:c.blueGlow, borderColor:c.blue }]}>
                  <Text style={[s.actionTxt, { color:c.blue, fontFamily:MONO }]}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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
  pickerBox:    { borderWidth:1, borderRadius:6, marginBottom:2, overflow:'hidden' },
  switchLabel:  { flex:1, fontSize:12 },

  sectionHead:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:18, marginBottom:8 },
  secLabel:     { fontSize:10, fontWeight:'600', letterSpacing:1 },
  addBtn:       { borderWidth:1, borderRadius:20, paddingHorizontal:12, paddingVertical:4 },
  addBtnTxt:    { fontSize:11, fontWeight:'600' },
  doneHeader:   { fontSize:9, fontWeight:'600', letterSpacing:1, marginTop:10, marginBottom:6 },
  emptyNote:    { fontSize:11, fontStyle:'italic', marginBottom:8 },

  notesInput:   { borderWidth:1, borderRadius:8, padding:12, fontSize:12, minHeight:80, textAlignVertical:'top', marginTop:0 },

  actionsRow:   { flexDirection:'row', justifyContent:'space-between', marginTop:24, paddingTop:16, borderTopWidth:1, gap:10 },
  archiveBtn:   { flex:1, borderWidth:1, borderRadius:20, paddingVertical:8, alignItems:'center' },
  archiveTxt:   { fontSize:12, fontWeight:'600' },
  deleteBtn:    { flex:1, borderWidth:1, borderRadius:20, paddingVertical:8, alignItems:'center' },
  deleteTxt:    { fontSize:12, fontWeight:'600' },

  colorRow:     { flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:6, marginBottom:6 },
  colorSwatch:  { width:28, height:28, borderRadius:14 },

  modalOverlay: { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.45)' },
  modalSheet:   { flex:1, marginTop:72, borderTopLeftRadius:20, borderTopRightRadius:20, borderTopWidth:1, borderLeftWidth:1, borderRightWidth:1, overflow:'hidden' },
  modalHeader:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, borderBottomWidth:1 },
  modalTitle:   { fontSize:15, fontWeight:'600', flex:1, marginRight:10 },
  closeBtn:     { width:28, height:28, borderRadius:14, borderWidth:1, alignItems:'center', justifyContent:'center' },
  modalBody:    { padding:18, paddingBottom:36 },
  modalActions: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:18, paddingTop:14, borderTopWidth:1 },
  actionBtn:    { borderWidth:1, borderRadius:20, paddingVertical:7, paddingHorizontal:18 },
  actionTxt:    { fontSize:12, fontWeight:'600' },
});
