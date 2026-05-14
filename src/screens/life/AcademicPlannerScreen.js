import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, Modal, KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// ─── Constants & helpers ──────────────────────────────────────────────────────

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const COLORS      = ['#2a7de1','#0e9e70','#c27d08','#d03030','#6c5bbf','#e06030','#1899a8','#888888'];
const COLOR_NAMES = ['Blue','Green','Amber','Red','Purple','Orange','Teal','Grey'];

const GRADE_POINTS = {
  'A+':4.0,'A':4.0,'A-':3.7,'B+':3.3,'B':3.0,'B-':2.7,
  'C+':2.3,'C':2.0,'C-':1.7,'D+':1.3,'D':1.0,'F':0,
};

function letterToGpa(l) { return GRADE_POINTS[l] ?? null; }

function getDueInfo(dateStr, c) {
  if (!dateStr) return { label: 'No due date', color: c.textMuted };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dateStr + 'T00:00:00');
  const diff  = Math.round((due - today) / 86400000);
  if (diff < 0)  return { label: 'Overdue',       color: c.red   };
  if (diff === 0) return { label: 'Due today',     color: c.amber };
  if (diff === 1) return { label: 'Tomorrow',      color: c.amber };
  if (diff <= 7)  return { label: `In ${diff} days`, color: c.amber };
  return { label: due.toLocaleDateString('en-US', { month:'short', day:'numeric' }), color: c.textMuted };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SecHeader({ title, open, onToggle, c }) {
  return (
    <TouchableOpacity style={[sh.row, { borderBottomColor:c.borderSubtle }]} onPress={onToggle} activeOpacity={0.7}>
      <Text style={[sh.label, { color:c.textMuted, fontFamily:MONO }]}>{title.toUpperCase()}</Text>
      <Text style={{ color:c.textMuted, fontSize:10 }}>{open ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth:1, paddingVertical:10, marginTop:16, marginBottom:8 },
  label: { fontSize:10, fontWeight:'600', letterSpacing:1 },
});

function MetCard({ label, value, sub, color, c }) {
  return (
    <View style={[mc.card, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
      <Text style={[mc.label, { color:c.textMuted, fontFamily:MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[mc.value, { color:color||c.textPrimary, fontFamily:MONO }]}>{value}</Text>
      {!!sub && <Text style={[mc.sub, { color:c.textMuted, fontFamily:MONO }]}>{sub}</Text>}
    </View>
  );
}
const mc = StyleSheet.create({
  card:  { flex:1, minWidth:'45%', borderWidth:1, borderRadius:8, padding:10, margin:3 },
  label: { fontSize:9, letterSpacing:0.8, marginBottom:3 },
  value: { fontSize:18, fontWeight:'600', letterSpacing:-0.3 },
  sub:   { fontSize:9, marginTop:2 },
});

function CourseBubble({ course, onPress, archived, c }) {
  const sub = [
    course.professor,
    course.credits ? `${course.credits} cr` : null,
    course.currentGrade || (archived && course.finalGrade ? `Final: ${course.finalGrade}` : null),
    archived && course.semester ? course.semester : null,
  ].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[cb.bubble, { backgroundColor:c.bgCard, borderColor:c.borderSubtle, opacity: archived ? 0.6 : 1 }]}
    >
      <View style={[cb.dot, { backgroundColor: course.color || '#2a7de1' }]} />
      <View style={{ flex:1, minWidth:0 }}>
        <Text style={[cb.name, { color:c.textPrimary, fontFamily:MONO, textDecorationLine: archived ? 'line-through' : 'none' }]} numberOfLines={1}>
          {course.code ? `${course.code} — ` : ''}{course.name}
        </Text>
        {!!sub && <Text style={[cb.sub, { color:c.textMuted, fontFamily:MONO }]} numberOfLines={1}>{sub}</Text>}
      </View>
    </TouchableOpacity>
  );
}
const cb = StyleSheet.create({
  bubble: { flexDirection:'row', alignItems:'center', gap:10, borderWidth:1.5, borderRadius:50, paddingHorizontal:16, paddingVertical:9, marginRight:8, marginBottom:8 },
  dot:    { width:8, height:8, borderRadius:4, flexShrink:0 },
  name:   { fontSize:12, fontWeight:'600' },
  sub:    { fontSize:10, marginTop:1 },
});

function UpcomingRow({ assignment, courseName, courseColor, onPress, c }) {
  const due = getDueInfo(assignment.due, c);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[ur.row, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
      <View style={[ur.dot, { backgroundColor: courseColor }]} />
      <View style={{ flex:1, minWidth:0 }}>
        <Text style={[ur.name, { color:c.textPrimary, fontFamily:MONO }]} numberOfLines={1}>{assignment.name}</Text>
        <Text style={[ur.course, { color:c.textMuted, fontFamily:MONO }]}>{courseName}</Text>
      </View>
      <View style={{ alignItems:'flex-end', gap:3 }}>
        <Text style={[ur.dueLabel, { color: due.color || c.textMuted, fontFamily:MONO }]}>{due.label}</Text>
        {!!assignment.type && (
          <View style={[ur.typePill, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]}>
            <Text style={[ur.typeTxt, { color:c.textMuted, fontFamily:MONO }]}>{assignment.type}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
const ur = StyleSheet.create({
  row:      { flexDirection:'row', alignItems:'center', gap:10, borderWidth:1, borderRadius:8, padding:10, marginBottom:5 },
  dot:      { width:8, height:8, borderRadius:4, flexShrink:0 },
  name:     { fontSize:12, fontWeight:'600', marginBottom:1 },
  course:   { fontSize:10 },
  dueLabel: { fontSize:11, fontWeight:'600' },
  typePill: { borderWidth:1, borderRadius:10, paddingHorizontal:6, paddingVertical:1 },
  typeTxt:  { fontSize:9, fontWeight:'600', letterSpacing:0.5 },
});

function FLabel({ label, c }) {
  return <Text style={{ fontSize:9, fontWeight:'600', letterSpacing:0.8, marginBottom:3, marginTop:10, color:c.textMuted, fontFamily:MONO }}>{label.toUpperCase()}</Text>;
}

// ─── Add Course Modal (isolated component so form state never re-renders parent) ──

function AddCourseModal({ visible, onSave, onClose, c }) {
  const [name,  setName]  = useState('');
  const [code,  setCode]  = useState('');
  const [prof,  setProf]  = useState('');
  const [sem,   setSem]   = useState('');
  const [creds, setCreds] = useState('3');
  const [color, setColor] = useState(COLORS[0]);

  // Reset every time the modal opens
  useEffect(() => {
    if (visible) {
      setName(''); setCode(''); setProf('');
      setSem(''); setCreds('3'); setColor(COLORS[0]);
    }
  }, [visible]);

  const handleSave = () => {
    if (!name.trim()) return Alert.alert('Required', 'Course name is required.');
    onSave({ name: name.trim(), code: code.trim(), professor: prof.trim(), semester: sem.trim(), credits: parseInt(creds) || 3, color });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[s.modalSheet, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
          <View style={[s.modalHeader, { borderBottomColor: c.borderSubtle }]}>
            <Text style={[s.modalTitle, { color: c.textPrimary, fontFamily: MONO }]}>Add Course</Text>
            <TouchableOpacity style={[s.closeBtn, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]} onPress={onClose}>
              <Text style={{ color: c.textMuted, fontSize: 14 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <FLabel label="Course Name *" c={c} />
            <TextInput
              style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              value={name} onChangeText={setName}
              placeholder="e.g. American History" placeholderTextColor={c.textMuted}
              autoCorrect={false}
            />

            <View style={s.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <FLabel label="Course Code" c={c} />
                <TextInput
                  style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={code} onChangeText={setCode}
                  placeholder="HIST201" placeholderTextColor={c.textMuted}
                  autoCorrect={false} autoCapitalize="characters"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <FLabel label="Credit Hours" c={c} />
                <TextInput
                  style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                  value={creds} onChangeText={setCreds}
                  keyboardType="number-pad" placeholder="3" placeholderTextColor={c.textMuted}
                />
              </View>
            </View>

            <FLabel label="Professor" c={c} />
            <TextInput
              style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              value={prof} onChangeText={setProf}
              placeholder="e.g. Prof. Benowitz" placeholderTextColor={c.textMuted}
            />

            <FLabel label="Semester" c={c} />
            <TextInput
              style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
              value={sem} onChangeText={setSem}
              placeholder="e.g. Fall 2026" placeholderTextColor={c.textMuted}
            />

            <FLabel label="Color" c={c} />
            <View style={s.colorRow}>
              {COLORS.map(col => (
                <TouchableOpacity
                  key={col}
                  onPress={() => setColor(col)}
                  style={[s.colorSwatch, { backgroundColor: col, borderWidth: color === col ? 3 : 0, borderColor: '#fff' }]}
                />
              ))}
            </View>

            <View style={[s.modalActions, { borderTopColor: c.borderSubtle }]}>
              <TouchableOpacity onPress={onClose} style={[s.actionBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}>
                <Text style={[s.actionTxt, { color: c.textMuted, fontFamily: MONO }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={[s.actionBtn, { backgroundColor: c.blueGlow, borderColor: c.blue }]}>
                <Text style={[s.actionTxt, { color: c.blue, fontFamily: MONO }]}>Add Course</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AcademicPlannerScreen({ navigation }) {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;

  const [courses,   setCourses]   = useState([]);
  const [idCounter, setIdCounter] = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [saved,     setSaved]     = useState(false);

  const [open, setOpen] = useState({ upcoming:true, active:true, archived:false });
  const toggle = key => setOpen(p => ({ ...p, [key]:!p[key] }));

  const [showModal, setShowModal] = useState(false);

  const docRef = () =>
    firebase.firestore().collection('users').doc(user.uid).collection('localStorage').doc('data');

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const persist = async (updCourses, updCounter) => {
    try {
      await docRef().set({
        acad_courses:     JSON.stringify(updCourses),
        acad_id_counter:  String(updCounter),
      }, { merge: true });
      flash();
    } catch (err) { Alert.alert('Save error', err.message); }
  };

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await docRef().get();
      const d = snap.exists ? snap.data() : {};
      setCourses(JSON.parse(d.acad_courses || '[]'));
      setIdCounter(parseInt(d.acad_id_counter || '1'));
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  }, [user]);

  useFocusEffect(load);

  // Computed
  const active   = courses.filter(c2 => !c2.archived);
  const archived = courses.filter(c2 =>  c2.archived);
  const graded   = courses.filter(c2 => c2.finalGrade && letterToGpa(c2.finalGrade) !== null);

  let gpaStr = '—', gpaSub = 'no graded courses yet';
  if (graded.length > 0) {
    const pts   = graded.reduce((s, c2) => s + letterToGpa(c2.finalGrade) * (parseInt(c2.credits) || 3), 0);
    const creds = graded.reduce((s, c2) => s + (parseInt(c2.credits) || 3), 0);
    gpaStr = (pts / creds).toFixed(2);
    gpaSub = `${graded.length} graded course${graded.length !== 1 ? 's' : ''}`;
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = active
    .flatMap(c2 => (c2.assignments || []).filter(a => !a.done).map(a => ({ ...a, courseName: c2.code || c2.name, courseColor: c2.color || '#2a7de1', courseId: c2.id })))
    .sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1; if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    })
    .slice(0, 20);

  // Receives validated data from AddCourseModal
  const handleSaveCourse = async (fields) => {
    const newId = idCounter;
    const course = { id: newId, ...fields, archived: false, currentGrade: '', finalGrade: '', assignments: [], notes: '' };
    const updCourses = [...courses, course];
    const newCounter = idCounter + 1;
    setCourses(updCourses); setIdCounter(newCounter); setShowModal(false);
    await persist(updCourses, newCounter);
  };

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

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── GPA Metrics ─────────────────────────── */}
        <View style={s.metRow}>
          <MetCard label="Active Courses" value={String(active.length)}                                         sub="this semester"      color={c.blue}        c={c} />
          <MetCard label="Cumulative GPA" value={gpaStr}                                                         sub={gpaSub}            color={c.green}       c={c} />
          <MetCard label="Credits Active" value={String(active.reduce((s,c2)=>s+(parseInt(c2.credits)||0),0))} sub="credit hours"       color={c.textPrimary} c={c} />
          <MetCard label="Archived"       value={String(archived.length)}                                        sub="past courses"       color={c.textPrimary} c={c} />
        </View>

        {/* ── Upcoming Assignments ─────────────────── */}
        <SecHeader title="Upcoming Assignments" open={open.upcoming} onToggle={() => toggle('upcoming')} c={c} />
        {open.upcoming && (
          upcoming.length === 0 ? (
            <Text style={[s.emptyNote, { color:c.textMuted, fontFamily:MONO }]}>
              No upcoming assignments. Add courses and assignments to see them here.
            </Text>
          ) : (
            upcoming.map((a, i) => (
              <UpcomingRow
                key={`${a.courseId}-${a.id || i}`}
                assignment={a}
                courseName={a.courseName}
                courseColor={a.courseColor}
                c={c}
                onPress={() => navigation.navigate('ClassDetail', { courseId: a.courseId })}
              />
            ))
          )
        )}

        {/* ── Active Courses ───────────────────────── */}
        <SecHeader title="Active Courses" open={open.active} onToggle={() => toggle('active')} c={c} />
        {open.active && (
          <>
            <View style={s.bubbleRow}>
              {active.map(course => (
                <CourseBubble
                  key={course.id}
                  course={course}
                  archived={false}
                  c={c}
                  onPress={() => navigation.navigate('ClassDetail', { courseId: course.id })}
                />
              ))}
            </View>
            <TouchableOpacity style={[s.addBubble, { borderColor:c.borderSubtle }]} onPress={() => setShowModal(true)}>
              <Text style={[s.addBubbleTxt, { color:c.textMuted, fontFamily:MONO }]}>+ Add Course</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Archived Courses ─────────────────────── */}
        <SecHeader title="Archived / Completed Courses" open={open.archived} onToggle={() => toggle('archived')} c={c} />
        {open.archived && (
          archived.length === 0 ? (
            <Text style={[s.emptyNote, { color:c.textMuted, fontFamily:MONO }]}>No archived courses yet.</Text>
          ) : (
            <View style={s.bubbleRow}>
              {archived.map(course => (
                <CourseBubble
                  key={course.id}
                  course={course}
                  archived
                  c={c}
                  onPress={() => navigation.navigate('ClassDetail', { courseId: course.id })}
                />
              ))}
            </View>
          )
        )}

      </ScrollView>

      <AddCourseModal
        visible={showModal}
        onSave={handleSaveCourse}
        onClose={() => setShowModal(false)}
        c={c}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:    { flex:1, alignItems:'center', justifyContent:'center' },
  scroll:      { padding:14, paddingBottom:60 },
  savedBadge:  { position:'absolute', bottom:16, right:16, zIndex:99, borderWidth:1, borderRadius:20, paddingHorizontal:14, paddingVertical:5 },
  savedText:   { fontSize:11, fontWeight:'600' },
  metRow:      { flexDirection:'row', flexWrap:'wrap', marginBottom:8 },
  bubbleRow:   { flexDirection:'row', flexWrap:'wrap', marginBottom:4 },
  emptyNote:   { fontSize:11, fontStyle:'italic', marginBottom:8 },
  addBubble:   { borderWidth:1.5, borderStyle:'dashed', borderRadius:50, paddingHorizontal:16, paddingVertical:8, alignSelf:'flex-start', marginBottom:4 },
  addBubbleTxt:{ fontSize:12, fontWeight:'600' },

  formRow:     { flexDirection:'row' },
  input:       { borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:7, fontSize:12, marginBottom:2 },
  colorRow:    { flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:6, marginBottom:6 },
  colorSwatch: { width:28, height:28, borderRadius:14 },

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
