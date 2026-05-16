import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Image, Modal,
  KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../hooks/useHaptics';
import { uploadCoursePhoto } from '../../utils/storageHelpers';

const MONO = 'Inter_500Medium';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function StarRow({ value, c }) {
  return (
    <Text style={{ color: c.amber, fontSize: 14, letterSpacing: 2 }}>
      {'★'.repeat(Math.max(0, Math.round(value || 0)))}
      <Text style={{ color: c.borderSubtle }}>{'☆'.repeat(Math.max(0, 5 - Math.round(value || 0)))}</Text>
    </Text>
  );
}

function StatBox({ label, value, color, c }) {
  return (
    <View style={[sb.box, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
      <Text style={[sb.label, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[sb.value, { color: color || c.textPrimary, fontFamily: MONO }]}>{value || '—'}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  box:   { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, margin: 4, alignItems: 'center' },
  label: { fontSize: 9, letterSpacing: 0.8, marginBottom: 4 },
  value: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
});

// ─── Hole Edit Modal ──────────────────────────────────────────────────────────

function HoleEditModal({ visible, hole, tees, onSave, onClose, c, isDark }) {
  const [par,      setPar]      = useState(hole?.par || 4);
  const [hcp,      setHcp]      = useState(String(hole?.handicapIndex || ''));
  const [club,     setClub]     = useState(hole?.clubOffTee || '');
  const [hazards,  setHazards]  = useState(hole?.hazards || '');
  const [notes,    setNotes]    = useState(hole?.notes || '');
  const [yardages, setYardages] = useState(hole?.yardages || []);

  useEffect(() => {
    if (hole) {
      setPar(hole.par || 4);
      setHcp(String(hole.handicapIndex || ''));
      setClub(hole.clubOffTee || '');
      setHazards(hole.hazards || '');
      setNotes(hole.notes || '');
      setYardages(hole.yardages || []);
    }
  }, [hole]);

  const updateYardage = (teeName, val) =>
    setYardages(prev => {
      const exists = prev.find(y => y.teeName === teeName);
      if (exists) return prev.map(y => y.teeName === teeName ? { ...y, yards: parseInt(val) || 0 } : y);
      return [...prev, { teeName, yards: parseInt(val) || 0 }];
    });

  const getYardage = (teeName) => String(yardages.find(y => y.teeName === teeName)?.yards || '');

  if (!hole) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={hem.overlay}>
          <View style={[hem.sheet, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <View style={[hem.header, { borderBottomColor: c.borderSubtle }]}>
              <Text style={[hem.title, { color: c.textPrimary, fontFamily: 'Inter_700Bold' }]}>
                Edit Hole {hole.holeNumber}
              </Text>
              <TouchableOpacity onPress={onClose} style={[hem.closeBtn, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
                <Text style={{ color: c.textMuted, fontSize: 14 }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
              {/* Par */}
              <Text style={[hem.fl, { color: c.textMuted, fontFamily: MONO }]}>PAR</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[3, 4, 5].map(p => (
                  <TouchableOpacity key={p} onPress={() => setPar(p)}
                    style={[hem.parBtn, { borderColor: par === p ? c.green : c.borderSubtle, backgroundColor: par === p ? c.greenGlow : 'transparent' }]}>
                    <Text style={{ fontFamily: MONO, fontWeight: '700', fontSize: 15, color: par === p ? c.green : c.textMuted }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Handicap */}
              <Text style={[hem.fl, { color: c.textMuted, fontFamily: MONO }]}>HANDICAP INDEX</Text>
              <TextInput style={[hem.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                value={hcp} onChangeText={setHcp} keyboardType="number-pad" placeholder="1-18" placeholderTextColor={c.textMuted} />

              {/* Yardages */}
              {tees.length > 0 && (
                <>
                  <Text style={[hem.fl, { color: c.textMuted, fontFamily: MONO }]}>YARDAGES</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {tees.map(tee => (
                      <View key={tee.name} style={{ alignItems: 'center' }}>
                        <Text style={[{ color: c.textMuted, fontFamily: MONO, fontSize: 10, marginBottom: 4 }]}>{tee.name.toUpperCase()}</Text>
                        <TextInput
                          style={[hem.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO, width: 70, textAlign: 'center' }]}
                          value={getYardage(tee.name)} onChangeText={v => updateYardage(tee.name, v)} keyboardType="number-pad" placeholder="—" placeholderTextColor={c.textMuted}
                        />
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Club */}
              <Text style={[hem.fl, { color: c.textMuted, fontFamily: MONO }]}>CLUB OFF TEE</Text>
              <TextInput style={[hem.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                value={club} onChangeText={setClub} placeholder="Driver, 3W…" placeholderTextColor={c.textMuted} />

              {/* Hazards */}
              <Text style={[hem.fl, { color: c.textMuted, fontFamily: MONO }]}>HAZARDS</Text>
              <TextInput style={[hem.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                value={hazards} onChangeText={setHazards} placeholder="Water left, bunkers short…" placeholderTextColor={c.textMuted} />

              {/* Notes */}
              <Text style={[hem.fl, { color: c.textMuted, fontFamily: MONO }]}>NOTES</Text>
              <TextInput style={[hem.input, hem.multiline, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                value={notes} onChangeText={setNotes} multiline placeholder="Strategy, tips…" placeholderTextColor={c.textMuted} />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={[hem.cancelBtn, { borderColor: c.borderSubtle }]} onPress={onClose}>
                  <Text style={[{ fontFamily: MONO, fontWeight: '600', color: c.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[hem.saveBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]}
                  onPress={() => onSave({ par, handicapIndex: parseInt(hcp) || hole.holeNumber, clubOffTee: club, hazards, notes, yardages })}>
                  <Text style={[{ fontFamily: MONO, fontWeight: '700', color: c.green }]}>Save Hole</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const hem = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:     { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, maxHeight: '90%' },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  title:     { fontSize: 16, fontWeight: '700' },
  closeBtn:  { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fl:        { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginTop: 14, marginBottom: 5 },
  input:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  parBtn:    { width: 48, height: 48, borderWidth: 1.5, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 20, paddingVertical: 12, alignItems: 'center' },
  saveBtn:   { flex: 2, borderWidth: 1, borderRadius: 20, paddingVertical: 12, alignItems: 'center' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CourseDetailScreen({ route, navigation }) {
  const { courseId } = route.params;
  const { theme, isDark } = useTheme();
  const { user }          = useAuth();
  const { triggerHaptic } = useHaptics();
  const c = theme.colors;

  const [course,      setCourse]      = useState(null);
  const [holes,       setHoles]       = useState([]);
  const [rounds,      setRounds]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('overview');
  const [expandedHole,setExpandedHole]= useState(null);
  const [editingHole, setEditingHole] = useState(null);
  const [editingTips, setEditingTips] = useState(false);
  const [tips,        setTips]        = useState('');
  const [uploading,   setUploading]   = useState(false);

  const courseRef = useCallback(() =>
    firebase.firestore().collection('users').doc(user.uid).collection('courses').doc(courseId),
  [user, courseId]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      // Load course
      const snap = await courseRef().get();
      if (!snap.exists) { navigation.goBack(); return; }
      const courseData = { id: snap.id, ...snap.data() };
      setCourse(courseData);
      setTips(courseData.playingTips || '');
      navigation.setOptions({ title: courseData.name });

      // Load holes
      const hSnap = await courseRef().collection('holes').orderBy('holeNumber', 'asc').get();
      setHoles(hSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Load rounds (from the JSON blob in the existing round tracker)
      const dSnap = await firebase.firestore()
        .collection('users').doc(user.uid)
        .collection('localStorage').doc('data').get();
      const d = dSnap.exists ? dSnap.data() : {};
      const allRounds = JSON.parse(d.golf_rounds || '[]');
      // Match by courseId or course name
      const courseRounds = allRounds.filter(r =>
        r.courseId === courseId || r.course === courseData.name
      ).sort((a, b) => new Date(b.date) - new Date(a.date));
      setRounds(courseRounds);
    } catch (err) {
      Alert.alert('Load error', err.message);
    } finally {
      setLoading(false);
    }
  }, [user, courseId]);

  useEffect(() => { if (user) load(); }, [user, load]);

  // ── Save playing tips ────────────────────────────────────────────────────────
  const saveTips = async () => {
    try {
      await courseRef().update({ playingTips: tips });
      setCourse(prev => ({ ...prev, playingTips: tips }));
      setEditingTips(false);
    } catch (err) { Alert.alert('Save error', err.message); }
  };

  // ── Save hole edit ────────────────────────────────────────────────────────────
  const saveHole = async (updatedData) => {
    if (!editingHole) return;
    try {
      await courseRef().collection('holes').doc(String(editingHole.holeNumber)).update(updatedData);
      setHoles(prev => prev.map(h =>
        h.holeNumber === editingHole.holeNumber ? { ...h, ...updatedData } : h
      ));
      setEditingHole(null);
    } catch (err) { Alert.alert('Save error', err.message); }
  };

  // ── Change cover photo ────────────────────────────────────────────────────────
  const changeCoverPhoto = async (fromCamera) => {
    const { status } = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [16, 9] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [16, 9] });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const url = await uploadCoursePhoto(user.uid, courseId, 'cover', result.assets[0].uri);
      await courseRef().update({ coverPhotoUrl: url });
      setCourse(prev => ({ ...prev, coverPhotoUrl: url }));
    } catch (err) { Alert.alert('Upload error', err.message); }
    finally { setUploading(false); }
  };

  // ── Add hole photo ────────────────────────────────────────────────────────────
  const addHolePhoto = async (holeNumber, fromCamera) => {
    const { status } = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const url = await uploadCoursePhoto(user.uid, courseId, `hole-${holeNumber}`, result.assets[0].uri);
      const holeRef = courseRef().collection('holes').doc(String(holeNumber));
      await holeRef.update({ photoUrls: firebase.firestore.FieldValue.arrayUnion(url) });
      setHoles(prev => prev.map(h =>
        h.holeNumber === holeNumber ? { ...h, photoUrls: [...(h.photoUrls || []), url] } : h
      ));
    } catch (err) { Alert.alert('Upload error', err.message); }
    finally { setUploading(false); }
  };

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={c.green} size="large" />
    </View>;
  }

  if (!course) return null;

  // ── Round stats for overview ─────────────────────────────────────────────────
  const roundScores = rounds.map(r => r.score).filter(s => s > 0);
  const avgScore    = roundScores.length ? (roundScores.reduce((a, b) => a + b, 0) / roundScores.length).toFixed(1) : '—';
  const bestScore   = roundScores.length ? Math.min(...roundScores) : '—';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>

        {/* ── Hero header ────────────────────────────── */}
        <TouchableOpacity
          style={s.heroWrap}
          onPress={() => Alert.alert('Change Photo', 'Choose a source', [
            { text: 'Camera',  onPress: () => changeCoverPhoto(true) },
            { text: 'Library', onPress: () => changeCoverPhoto(false) },
            { text: 'Cancel',  style: 'cancel' },
          ])}
          activeOpacity={0.9}
        >
          {course.coverPhotoUrl ? (
            <Image source={{ uri: course.coverPhotoUrl }} style={s.heroImg} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={isDark ? ['#0d2b1a', '#0d1117'] : ['#d4edda', '#f0f2f5']}
              style={s.heroImg}
            >
              <Text style={{ fontSize: 60, opacity: 0.4 }}>⛳</Text>
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={s.heroGrad}
          >
            <View style={s.heroContent}>
              <View style={s.heroTop}>
                <View style={[s.typeTag, { backgroundColor: (c[TYPE_COLOR[course.type]] || c.teal) + '33', borderColor: c[TYPE_COLOR[course.type]] || c.teal }]}>
                  <Text style={[s.typeTagTxt, { color: c[TYPE_COLOR[course.type]] || c.teal, fontFamily: MONO }]}>{course.type || 'Public'}</Text>
                </View>
                {uploading && <ActivityIndicator color={c.green} style={{ marginLeft: 10 }} />}
              </View>
              <Text style={[s.heroName, { fontFamily: 'Inter_700Bold' }]}>{course.name}</Text>
              <Text style={[s.heroLoc, { fontFamily: MONO }]}>
                {[course.city, course.state].filter(Boolean).join(', ') || ''}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <StarRow value={course.difficultyStars || 0} c={c} />
                {course.greenFeeRange && (
                  <Text style={[s.heroBadge, { color: c.green, fontFamily: MONO }]}>{course.greenFeeRange}</Text>
                )}
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Tab bar (sticky) ───────────────────────── */}
        <View style={[s.tabBar, { backgroundColor: c.bgCard, borderBottomColor: c.borderSubtle }]}>
          {['overview', 'holes', 'rounds'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && { borderBottomColor: c.green, borderBottomWidth: 2 }]}
              onPress={() => { triggerHaptic(); setActiveTab(tab); }}
            >
              <Text style={[s.tabTxt, { color: activeTab === tab ? c.green : c.textMuted, fontFamily: activeTab === tab ? 'Inter_600SemiBold' : MONO }]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════════════ OVERVIEW TAB ══════════════════ */}
        {activeTab === 'overview' && (
          <View style={s.tabContent}>
            {/* Course stats */}
            <Text style={[s.secLabel, { color: c.textMuted, fontFamily: MONO }]}>COURSE STATS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <StatBox label="Par"    value={course.par}           color={c.green}  c={c} />
              <StatBox label="Rating" value={course.courseRating}  color={c.blue}   c={c} />
              <StatBox label="Slope"  value={course.slopeRating}   color={c.amber}  c={c} />
              <StatBox label="Holes"  value={course.holes}         color={c.teal}   c={c} />
            </View>

            {/* Tees */}
            {course.tees?.length > 0 && (
              <>
                <Text style={[s.secLabel, { color: c.textMuted, fontFamily: MONO, marginTop: 16 }]}>TEE BOXES</Text>
                {course.tees.map((tee, i) => (
                  <View key={i} style={[s.teeRow, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                    <Text style={[s.teeName, { color: c.textPrimary, fontFamily: 'Inter_600SemiBold' }]}>{tee.name}</Text>
                    <Text style={[s.teeYds, { color: c.green, fontFamily: MONO }]}>
                      {tee.totalYardage ? `${tee.totalYardage} yds` : '—'}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* Playing tips */}
            <View style={[s.tipsCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={[s.secLabel, { color: c.textMuted, fontFamily: MONO, marginTop: 0 }]}>PLAYING TIPS</Text>
                <TouchableOpacity onPress={() => setEditingTips(!editingTips)}>
                  <Text style={[{ color: c.blue, fontFamily: MONO, fontSize: 12, fontWeight: '600' }]}>
                    {editingTips ? 'Cancel' : 'Edit'}
                  </Text>
                </TouchableOpacity>
              </View>
              {editingTips ? (
                <>
                  <TextInput
                    style={[s.tipsInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                    value={tips}
                    onChangeText={setTips}
                    multiline
                    placeholder="Add strategy notes, landing zones, tricky holes…"
                    placeholderTextColor={c.textMuted}
                    autoFocus
                  />
                  <TouchableOpacity style={[s.saveBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]} onPress={saveTips}>
                    <Text style={[{ color: c.green, fontFamily: MONO, fontWeight: '700' }]}>Save Tips</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={[s.tipsTxt, { color: course.playingTips ? c.textPrimary : c.textMuted, fontFamily: MONO }]}>
                  {course.playingTips || 'No playing tips yet. Tap Edit to add strategy notes.'}
                </Text>
              )}
            </View>

            {/* Round summary */}
            <Text style={[s.secLabel, { color: c.textMuted, fontFamily: MONO, marginTop: 16 }]}>YOUR STATS HERE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <StatBox label="Rounds Played" value={rounds.length} color={c.blue}  c={c} />
              <StatBox label="Avg Score"     value={avgScore}     color={c.amber}  c={c} />
              <StatBox label="Best Round"    value={bestScore}    color={c.green}  c={c} />
            </View>
          </View>
        )}

        {/* ══════════════════ HOLES TAB ══════════════════ */}
        {activeTab === 'holes' && (
          <View style={s.tabContent}>
            {holes.length === 0 ? (
              <View style={[s.emptyBox, { borderColor: c.borderSubtle }]}>
                <Text style={[{ color: c.textMuted, fontFamily: MONO, textAlign: 'center' }]}>
                  No hole data yet. Edit the course to add hole details.
                </Text>
              </View>
            ) : holes.map(hole => {
              const expanded = expandedHole === hole.holeNumber;
              return (
                <View key={hole.holeNumber} style={[s.holeCard, { backgroundColor: c.bgCard, borderColor: expanded ? c.teal : c.borderSubtle }]}>
                  <TouchableOpacity
                    style={s.holeCardTop}
                    onPress={() => { triggerHaptic(); setExpandedHole(expanded ? null : hole.holeNumber); }}
                    activeOpacity={0.7}
                  >
                    <View style={[s.holeNumBadge, { backgroundColor: c.tealGlow, borderColor: c.teal }]}>
                      <Text style={[s.holeNum, { color: c.teal, fontFamily: MONO }]}>{hole.holeNumber}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[{ color: c.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }]}>
                        Par {hole.par}  ·  HCP {hole.handicapIndex || '—'}
                      </Text>
                      {hole.yardages?.length > 0 && (
                        <Text style={[{ color: c.textMuted, fontFamily: MONO, fontSize: 11, marginTop: 2 }]}>
                          {hole.yardages.filter(y => y.yards > 0).map(y => `${y.teeName}: ${y.yards}`).join('  ·  ')}
                        </Text>
                      )}
                    </View>
                    <Text style={{ color: c.textMuted, fontSize: 14 }}>{expanded ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {expanded && (
                    <View style={[s.holeExpanded, { borderTopColor: c.borderSubtle }]}>
                      {hole.clubOffTee ? (
                        <Text style={[s.holeDetail, { color: c.textSecondary, fontFamily: MONO }]}>
                          🏌️ Club off tee: {hole.clubOffTee}
                        </Text>
                      ) : null}
                      {hole.hazards ? (
                        <Text style={[s.holeDetail, { color: c.textSecondary, fontFamily: MONO }]}>
                          ⚠️ {hole.hazards}
                        </Text>
                      ) : null}
                      {hole.notes ? (
                        <Text style={[s.holeDetail, { color: c.textSecondary, fontFamily: MONO }]}>
                          📝 {hole.notes}
                        </Text>
                      ) : null}

                      {/* Photos */}
                      {(hole.photoUrls?.length > 0) && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                          {hole.photoUrls.map((url, i) => (
                            <Image key={i} source={{ uri: url }} style={s.holePhoto} />
                          ))}
                        </ScrollView>
                      )}

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <TouchableOpacity
                          style={[s.holeActionBtn, { borderColor: c.teal, backgroundColor: c.tealGlow }]}
                          onPress={() => { triggerHaptic(); setEditingHole(hole); }}
                        >
                          <Text style={[{ color: c.teal, fontFamily: MONO, fontSize: 12, fontWeight: '600' }]}>✏️ Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.holeActionBtn, { borderColor: c.blue, backgroundColor: c.blueGlow }]}
                          onPress={() => Alert.alert('Add Photo', '', [
                            { text: 'Camera',  onPress: () => addHolePhoto(hole.holeNumber, true) },
                            { text: 'Library', onPress: () => addHolePhoto(hole.holeNumber, false) },
                            { text: 'Cancel',  style: 'cancel' },
                          ])}
                        >
                          <Text style={[{ color: c.blue, fontFamily: MONO, fontSize: 12, fontWeight: '600' }]}>📷 Photo</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ══════════════════ ROUNDS TAB ══════════════════ */}
        {activeTab === 'rounds' && (
          <View style={s.tabContent}>
            {rounds.length === 0 ? (
              <View style={[s.emptyBox, { borderColor: c.borderSubtle }]}>
                <Text style={{ fontSize: 32, marginBottom: 10 }}>📋</Text>
                <Text style={[{ color: c.textMuted, fontFamily: MONO, textAlign: 'center', fontSize: 13 }]}>
                  No rounds logged at {course.name} yet.
                </Text>
                <TouchableOpacity
                  style={[s.saveBtn, { backgroundColor: c.greenGlow, borderColor: c.green, marginTop: 14 }]}
                  onPress={() => navigation.navigate('RoundTracker')}
                >
                  <Text style={[{ color: c.green, fontFamily: MONO, fontWeight: '700' }]}>Log a Round →</Text>
                </TouchableOpacity>
              </View>
            ) : rounds.map((round, i) => {
              const diff = round.score - (round.par || 72);
              const col  = diff <= 0 ? c.green : diff <= 5 ? c.blue : diff <= 12 ? c.amber : c.red;
              return (
                <View key={round.id ?? i} style={[s.roundCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                  <View style={[s.roundScore, { backgroundColor: col + '22', borderColor: col }]}>
                    <Text style={[s.roundScoreNum, { color: col, fontFamily: MONO }]}>{round.score}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[{ color: c.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }]}>
                      {fmtDate(round.date)}
                    </Text>
                    <Text style={[{ color: c.textMuted, fontFamily: MONO, fontSize: 11, marginTop: 2 }]}>
                      Par {round.par || 72}
                      {round.putts ? `  ·  ${round.putts} putts` : ''}
                      {round.gir != null ? `  ·  ${round.gir}/18 GIR` : ''}
                    </Text>
                    {round.notes ? (
                      <Text style={[{ color: c.textMuted, fontFamily: MONO, fontSize: 11, marginTop: 3 }]} numberOfLines={1}>
                        {round.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Hole edit modal */}
      <HoleEditModal
        visible={!!editingHole}
        hole={editingHole}
        tees={course.tees || []}
        onSave={saveHole}
        onClose={() => setEditingHole(null)}
        c={c}
        isDark={isDark}
      />
    </View>
  );
}

const TYPE_COLOR = { Public: 'teal', Private: 'purple', Resort: 'amber', Municipal: 'blue' };

const s = StyleSheet.create({
  // Hero
  heroWrap:    { height: 260, position: 'relative' },
  heroImg:     { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  heroGrad:    { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  heroContent: { padding: 16, paddingBottom: 20 },
  heroTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  heroName:    { fontSize: 24, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  heroLoc:     { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  heroBadge:   { fontSize: 13, fontWeight: '700' },
  typeTag:     { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  typeTagTxt:  { fontSize: 10, fontWeight: '700' },

  // Tabs
  tabBar:     { flexDirection: 'row', borderBottomWidth: 1 },
  tab:        { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabTxt:     { fontSize: 13 },
  tabContent: { padding: 14 },

  // Overview
  secLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  teeRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6 },
  teeName:  { fontSize: 13 },
  teeYds:   { fontSize: 14, fontWeight: '700' },
  tipsCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 8 },
  tipsInput:{ borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, minHeight: 100, textAlignVertical: 'top', fontSize: 13, marginBottom: 10 },
  tipsTxt:  { fontSize: 13, lineHeight: 20 },
  saveBtn:  { borderWidth: 1, borderRadius: 20, paddingVertical: 10, alignItems: 'center' },

  // Holes
  holeCard:    { borderWidth: 1, borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  holeCardTop: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  holeNumBadge:{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  holeNum:     { fontSize: 16, fontWeight: '700' },
  holeExpanded:{ borderTopWidth: 1, padding: 12 },
  holeDetail:  { fontSize: 12, lineHeight: 18, marginBottom: 3 },
  holePhoto:   { width: 100, height: 70, borderRadius: 8, marginRight: 8 },
  holeActionBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },

  // Rounds
  roundCard:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  roundScore:   { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roundScoreNum:{ fontSize: 17, fontWeight: '700' },

  emptyBox: { alignItems: 'center', padding: 40, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14 },
});
