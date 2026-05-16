import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../hooks/useHaptics';
import { uploadCoursePhoto } from '../../utils/storageHelpers';

const MONO = 'Inter_500Medium';
const TYPES = ['Public', 'Private', 'Resort', 'Municipal'];
const HOLE_COUNTS = [9, 18];

// ─── Shared form widgets ──────────────────────────────────────────────────────

function FL({ label, c }) {
  return (
    <Text style={[fl.t, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>
  );
}
const fl = StyleSheet.create({ t: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4, marginTop: 12 } });

function TInput({ style, ...props }) {
  return <TextInput style={[ti.base, style]} {...props} />;
}
const ti = StyleSheet.create({ base: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 } });

function Pill({ label, active, color, bg, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[pill.btn, { borderColor: active ? color : 'rgba(255,255,255,0.08)', backgroundColor: active ? bg : 'transparent' }]}
    >
      <Text style={[pill.txt, { color: active ? color : 'rgba(255,255,255,0.4)', fontFamily: MONO }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const pill = StyleSheet.create({
  btn: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  txt: { fontSize: 12, fontWeight: '600' },
});

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ step, total, c }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1, height: 4, borderRadius: 2,
            backgroundColor: i < step ? c.green : i === step - 1 ? c.green : c.borderSubtle,
            opacity: i < step ? 1 : i === step - 1 ? 1 : 0.3,
          }}
        />
      ))}
    </View>
  );
}

// ─── Star selector ────────────────────────────────────────────────────────────

function StarSelect({ value, onChange, c }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange(n)}>
          <Text style={{ fontSize: 28, color: n <= value ? c.amber : c.borderSubtle }}>
            {n <= value ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Hole par selector ────────────────────────────────────────────────────────

function ParPills({ value, onChange, c }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[3, 4, 5].map(p => (
        <TouchableOpacity
          key={p}
          onPress={() => onChange(p)}
          style={[hf.parBtn, {
            borderColor:     value === p ? c.green : c.borderSubtle,
            backgroundColor: value === p ? c.greenGlow : 'transparent',
          }]}
        >
          <Text style={{ fontFamily: MONO, fontSize: 13, fontWeight: '700', color: value === p ? c.green : c.textMuted }}>{p}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const hf = StyleSheet.create({
  parBtn: { width: 36, height: 36, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

// ─── Default blank holes ──────────────────────────────────────────────────────

function makeHoles(count, tees) {
  return Array.from({ length: count }, (_, i) => ({
    holeNumber:    i + 1,
    par:           4,
    handicapIndex: i + 1,
    yardages:      tees.map(t => ({ teeName: t.name, yards: '' })),
    clubOffTee:    '',
    hazards:       '',
    notes:         '',
  }));
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddCourseScreen({ navigation }) {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const { triggerHaptic } = useHaptics();
  const c = theme.colors;

  const [step,    setStep]    = useState(1);
  const [saving,  setSaving]  = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // ── Step 1: Basic info ──────────────────────────────────────────────────────
  const [name,          setName]          = useState('');
  const [city,          setCity]          = useState('');
  const [state,         setState]         = useState('');
  const [type,          setType]          = useState('Public');
  const [holes,         setHoles]         = useState(18);
  const [par,           setPar]           = useState('72');
  const [courseRating,  setCourseRating]  = useState('');
  const [slopeRating,   setSlopeRating]   = useState('');
  const [greenFeeRange, setGreenFeeRange] = useState('');
  const [difficulty,    setDifficulty]    = useState(3);

  // ── Step 2: Tee boxes ───────────────────────────────────────────────────────
  const [tees, setTees] = useState([{ name: 'White', totalYardage: '' }]);

  const addTee    = () => setTees(prev => [...prev, { name: '', totalYardage: '' }]);
  const removeTee = i  => setTees(prev => prev.filter((_, j) => j !== i));
  const updateTee = (i, field, val) =>
    setTees(prev => prev.map((t, j) => j === i ? { ...t, [field]: val } : t));

  // ── Step 3: Cover photo ─────────────────────────────────────────────────────
  const [coverPhotoUri, setCoverPhotoUri] = useState(null);

  const pickPhoto = async (fromCamera) => {
    const { status } = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', fromCamera ? 'Camera access required.' : 'Photo library access required.');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [16, 9] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [16, 9] });
    if (!result.canceled && result.assets?.[0]) {
      setCoverPhotoUri(result.assets[0].uri);
    }
  };

  // ── Step 4: Hole details ────────────────────────────────────────────────────
  const [holeData, setHoleData] = useState(() => makeHoles(18, [{ name: 'White', totalYardage: '' }]));

  const updateHole = (idx, field, val) =>
    setHoleData(prev => prev.map((h, i) => i === idx ? { ...h, [field]: val } : h));

  const updateHoleYardage = (holeIdx, teeIdx, val) =>
    setHoleData(prev => prev.map((h, i) => {
      if (i !== holeIdx) return h;
      const yardages = h.yardages.map((y, j) => j === teeIdx ? { ...y, yards: val } : y);
      return { ...h, yardages };
    }));

  // ── Validation ──────────────────────────────────────────────────────────────

  const validateStep = () => {
    if (step === 1) {
      if (!name.trim()) { Alert.alert('Required', 'Course name is required.'); return false; }
    }
    if (step === 2) {
      if (tees.length === 0)              { Alert.alert('Required', 'Add at least one tee box.'); return false; }
      if (tees.some(t => !t.name.trim())) { Alert.alert('Required', 'All tee boxes need a name.'); return false; }
    }
    return true;
  };

  // Sync hole data when entering step 4 (after tees may have changed)
  const handleNext = () => {
    if (!validateStep()) return;
    triggerHaptic();
    if (step === 2) {
      // Re-build hole data with updated tees and correct hole count
      setHoleData(makeHoles(holes, tees));
    }
    setStep(s => s + 1);
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!user) return;
    triggerHaptic();
    setSaving(true);
    try {
      const courseRef = firebase.firestore()
        .collection('users').doc(user.uid).collection('courses').doc();
      const courseId = courseRef.id;

      // Upload cover photo if selected
      let coverPhotoUrl = '';
      if (coverPhotoUri) {
        setUploadProgress('Uploading cover photo…');
        coverPhotoUrl = await uploadCoursePhoto(user.uid, courseId, 'cover', coverPhotoUri);
      }

      setUploadProgress('Saving course…');

      const now = firebase.firestore.Timestamp.now();
      const courseDoc = {
        name:          name.trim(),
        city:          city.trim(),
        state:         state.trim(),
        type,
        holes,
        par:           parseInt(par) || 72,
        courseRating:  parseFloat(courseRating) || null,
        slopeRating:   parseInt(slopeRating) || null,
        greenFeeRange: greenFeeRange.trim(),
        difficultyStars: difficulty,
        tees: tees.map(t => ({ name: t.name.trim(), totalYardage: parseInt(t.totalYardage) || 0 })),
        coverPhotoUrl,
        playingTips:   '',
        createdAt:     now,
        dateFirstPlayed: null,
      };

      await courseRef.set(courseDoc);

      setUploadProgress('Saving holes…');

      // Write each hole as a sub-document
      const batch = firebase.firestore().batch();
      holeData.slice(0, holes).forEach(hole => {
        const ref = courseRef.collection('holes').doc(String(hole.holeNumber));
        batch.set(ref, {
          holeNumber:    hole.holeNumber,
          par:           hole.par,
          handicapIndex: parseInt(hole.handicapIndex) || hole.holeNumber,
          yardages:      hole.yardages.map(y => ({ ...y, yards: parseInt(y.yards) || 0 })),
          clubOffTee:    hole.clubOffTee,
          hazards:       hole.hazards,
          notes:         hole.notes,
          photoUrls:     [],
        });
      });
      await batch.commit();

      navigation.replace('CourseDetail', { courseId });
    } catch (err) {
      Alert.alert('Save error', err.message);
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const STEP_TITLES = ['Basic Info', 'Tee Boxes', 'Cover Photo', 'Hole Details'];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[s.scroll]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <StepBar step={step} total={4} c={c} />
        <Text style={[s.stepTitle, { color: c.textPrimary, fontFamily: 'Inter_700Bold' }]}>
          Step {step} of 4 — {STEP_TITLES[step - 1]}
        </Text>

        {/* ═══════════════════════════ STEP 1 ═══════════════════════════ */}
        {step === 1 && (
          <>
            <FL label="Course Name *" c={c} />
            <TInput
              style={{ borderColor: c.borderSubtle, backgroundColor: c.bgCard, color: c.textPrimary, fontFamily: MONO }}
              value={name} onChangeText={setName} placeholder="e.g. Augusta National" placeholderTextColor={c.textMuted}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FL label="City" c={c} />
                <TInput style={{ borderColor: c.borderSubtle, backgroundColor: c.bgCard, color: c.textPrimary, fontFamily: MONO }}
                  value={city} onChangeText={setCity} placeholder="Augusta" placeholderTextColor={c.textMuted} />
              </View>
              <View style={{ width: 80 }}>
                <FL label="State" c={c} />
                <TInput style={{ borderColor: c.borderSubtle, backgroundColor: c.bgCard, color: c.textPrimary, fontFamily: MONO }}
                  value={state} onChangeText={setState} placeholder="GA" placeholderTextColor={c.textMuted} autoCapitalize="characters" maxLength={2} />
              </View>
            </View>

            <FL label="Type" c={c} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {TYPES.map(t => (
                <Pill key={t} label={t} active={type === t} color={c.teal} bg={c.tealGlow} onPress={() => setType(t)} />
              ))}
            </View>

            <FL label="Holes" c={c} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              {HOLE_COUNTS.map(n => (
                <Pill key={n} label={`${n} holes`} active={holes === n} color={c.blue} bg={c.blueGlow} onPress={() => setHoles(n)} />
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FL label="Par" c={c} />
                <TInput style={{ borderColor: c.borderSubtle, backgroundColor: c.bgCard, color: c.textPrimary, fontFamily: MONO }}
                  value={par} onChangeText={setPar} keyboardType="number-pad" placeholder="72" placeholderTextColor={c.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <FL label="Course Rating" c={c} />
                <TInput style={{ borderColor: c.borderSubtle, backgroundColor: c.bgCard, color: c.textPrimary, fontFamily: MONO }}
                  value={courseRating} onChangeText={setCourseRating} keyboardType="decimal-pad" placeholder="72.4" placeholderTextColor={c.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <FL label="Slope" c={c} />
                <TInput style={{ borderColor: c.borderSubtle, backgroundColor: c.bgCard, color: c.textPrimary, fontFamily: MONO }}
                  value={slopeRating} onChangeText={setSlopeRating} keyboardType="number-pad" placeholder="131" placeholderTextColor={c.textMuted} />
              </View>
            </View>

            <FL label="Green Fee Range" c={c} />
            <TInput style={{ borderColor: c.borderSubtle, backgroundColor: c.bgCard, color: c.textPrimary, fontFamily: MONO }}
              value={greenFeeRange} onChangeText={setGreenFeeRange} placeholder="e.g. $40-60" placeholderTextColor={c.textMuted} />

            <FL label="Difficulty (tap to rate)" c={c} />
            <StarSelect value={difficulty} onChange={setDifficulty} c={c} />
          </>
        )}

        {/* ═══════════════════════════ STEP 2 ═══════════════════════════ */}
        {step === 2 && (
          <>
            <Text style={[s.stepHint, { color: c.textMuted, fontFamily: MONO }]}>
              Add the tee boxes available at this course. These will be used for hole yardages in step 4.
            </Text>
            {tees.map((tee, i) => (
              <View key={i} style={[s.teeRow, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                <View style={{ flex: 1 }}>
                  <FL label={`Tee ${i + 1} Name`} c={c} />
                  <TInput style={{ borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }}
                    value={tee.name} onChangeText={v => updateTee(i, 'name', v)} placeholder="e.g. White, Blue, Red" placeholderTextColor={c.textMuted} />
                </View>
                <View style={{ width: 110, marginLeft: 10 }}>
                  <FL label="Total Yards" c={c} />
                  <TInput style={{ borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }}
                    value={String(tee.totalYardage)} onChangeText={v => updateTee(i, 'totalYardage', v)}
                    keyboardType="number-pad" placeholder="6500" placeholderTextColor={c.textMuted} />
                </View>
                {tees.length > 1 && (
                  <TouchableOpacity onPress={() => removeTee(i)} style={{ padding: 8, marginTop: 20 }}>
                    <Text style={{ color: c.red, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={[s.addRowBtn, { borderColor: c.borderSubtle }]} onPress={addTee}>
              <Text style={[s.addRowTxt, { color: c.textMuted, fontFamily: MONO }]}>+ Add Tee Box</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ═══════════════════════════ STEP 3 ═══════════════════════════ */}
        {step === 3 && (
          <>
            <Text style={[s.stepHint, { color: c.textMuted, fontFamily: MONO }]}>
              Add a cover photo for this course. This will be shown as the header image on the course page. You can skip this step and add a photo later.
            </Text>
            {coverPhotoUri ? (
              <View style={s.photoPreview}>
                <Image source={{ uri: coverPhotoUri }} style={s.photoImg} resizeMode="cover" />
                <TouchableOpacity style={[s.removePhotoBtn, { backgroundColor: c.redGlow, borderColor: c.red }]}
                  onPress={() => setCoverPhotoUri(null)}>
                  <Text style={{ color: c.red, fontFamily: MONO, fontSize: 11 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[s.photoEmpty, { borderColor: c.borderSubtle }]}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📷</Text>
                <Text style={[s.photoEmptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No cover photo selected</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[s.photoBtn, { backgroundColor: c.blueGlow, borderColor: c.blue, flex: 1 }]}
                onPress={() => pickPhoto(false)}>
                <Text style={{ color: c.blue, fontFamily: MONO, fontWeight: '600' }}>📂 Library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.photoBtn, { backgroundColor: c.greenGlow, borderColor: c.green, flex: 1 }]}
                onPress={() => pickPhoto(true)}>
                <Text style={{ color: c.green, fontFamily: MONO, fontWeight: '600' }}>📸 Camera</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ═══════════════════════════ STEP 4 ═══════════════════════════ */}
        {step === 4 && (
          <>
            <Text style={[s.stepHint, { color: c.textMuted, fontFamily: MONO }]}>
              Enter par and handicap index for each hole. Yardage fields are optional but help with club selection.
            </Text>
            {holeData.slice(0, holes).map((hole, idx) => (
              <View key={idx} style={[s.holeCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                <View style={s.holeHeader}>
                  <View style={[s.holeNumBadge, { backgroundColor: c.tealGlow, borderColor: c.teal }]}>
                    <Text style={[s.holeNum, { color: c.teal, fontFamily: MONO }]}>{hole.holeNumber}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.holeLabel, { color: c.textMuted, fontFamily: MONO }]}>PAR</Text>
                    <ParPills value={hole.par} onChange={v => updateHole(idx, 'par', v)} c={c} />
                  </View>
                  <View style={{ width: 70 }}>
                    <Text style={[s.holeLabel, { color: c.textMuted, fontFamily: MONO }]}>HCP IDX</Text>
                    <TInput
                      style={{ borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO, textAlign: 'center', paddingVertical: 6 }}
                      value={String(hole.handicapIndex)}
                      onChangeText={v => updateHole(idx, 'handicapIndex', parseInt(v) || 0)}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                {/* Yardages per tee */}
                {tees.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {tees.map((tee, ti) => (
                      <View key={ti} style={{ alignItems: 'center' }}>
                        <Text style={[s.holeLabel, { color: c.textMuted, fontFamily: MONO, marginBottom: 3 }]}>
                          {(tee.name || 'Tee').substring(0, 5).toUpperCase()}
                        </Text>
                        <TInput
                          style={{ width: 60, borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO, textAlign: 'center', paddingVertical: 6 }}
                          value={hole.yardages[ti]?.yards ? String(hole.yardages[ti].yards) : ''}
                          onChangeText={v => updateHoleYardage(idx, ti, v)}
                          keyboardType="number-pad"
                          placeholder="—"
                          placeholderTextColor={c.textMuted}
                        />
                      </View>
                    ))}
                  </View>
                )}

                {/* Club + Notes */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.holeLabel, { color: c.textMuted, fontFamily: MONO }]}>CLUB OFF TEE</Text>
                    <TInput style={{ borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO, paddingVertical: 6 }}
                      value={hole.clubOffTee} onChangeText={v => updateHole(idx, 'clubOffTee', v)} placeholder="Driver" placeholderTextColor={c.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.holeLabel, { color: c.textMuted, fontFamily: MONO }]}>HAZARDS</Text>
                    <TInput style={{ borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO, paddingVertical: 6 }}
                      value={hole.hazards} onChangeText={v => updateHole(idx, 'hazards', v)} placeholder="Water left" placeholderTextColor={c.textMuted} />
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── Buttons ────────────────────────────────────────────────────────── */}
        <View style={s.btnRow}>
          {step > 1 && (
            <TouchableOpacity style={[s.backBtn, { borderColor: c.borderSubtle }]} onPress={() => { triggerHaptic(); setStep(s => s - 1); }}>
              <Text style={[s.backTxt, { color: c.textMuted, fontFamily: MONO }]}>← Back</Text>
            </TouchableOpacity>
          )}
          {step < 4 ? (
            <TouchableOpacity style={[s.nextBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]} onPress={handleNext}>
              <Text style={[s.nextTxt, { color: c.green, fontFamily: MONO }]}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.nextBtn, { backgroundColor: c.green }]} onPress={save} disabled={saving}>
              {saving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[s.nextTxt, { color: '#fff', fontFamily: MONO }]}>{uploadProgress || 'Saving…'}</Text>
                </View>
              ) : (
                <Text style={[s.nextTxt, { color: '#fff', fontFamily: MONO }]}>Save Course ✓</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  scroll:     { padding: 16 },
  stepTitle:  { fontSize: 20, marginBottom: 4 },
  stepHint:   { fontSize: 12, lineHeight: 18, marginBottom: 4 },

  teeRow:     { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start' },
  addRowBtn:  { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  addRowTxt:  { fontSize: 13, fontWeight: '600' },

  photoPreview:   { position: 'relative' },
  photoImg:       { width: '100%', height: 200, borderRadius: 12 },
  removePhotoBtn: { position: 'absolute', top: 10, right: 10, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  photoEmpty:     { height: 160, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  photoEmptyTxt:  { fontSize: 12 },
  photoBtn:       { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },

  holeCard:   { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  holeHeader: { flexDirection: 'row', alignItems: 'center' },
  holeNumBadge: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  holeNum:    { fontSize: 16, fontWeight: '700' },
  holeLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },

  btnRow:   { flexDirection: 'row', gap: 10, marginTop: 20 },
  backBtn:  { borderWidth: 1, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 20 },
  backTxt:  { fontSize: 14, fontWeight: '600' },
  nextBtn:  { flex: 1, borderWidth: 1, borderRadius: 20, paddingVertical: 12, alignItems: 'center' },
  nextTxt:  { fontSize: 14, fontWeight: '700' },
});
