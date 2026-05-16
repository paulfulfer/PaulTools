import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../hooks/useHaptics';

const MONO = 'Inter_500Medium';

const TYPE_COLOR = {
  Public: 'teal', Private: 'purple', Resort: 'amber', Municipal: 'blue',
};

function StarRow({ value, size = 12 }) {
  return (
    <Text style={{ fontSize: size, letterSpacing: 1 }}>
      {'★'.repeat(Math.max(0, Math.round(value || 0)))}
      {'☆'.repeat(Math.max(0, 5 - Math.round(value || 0)))}
    </Text>
  );
}

export default function CourseListScreen({ navigation }) {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const { triggerHaptic } = useHaptics();
  const c = theme.colors;

  const [courses,    setCourses]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const snap = await firebase.firestore()
        .collection('users').doc(user.uid)
        .collection('courses')
        .orderBy('createdAt', 'desc')
        .get();
      setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { if (user) load(); }, [user, load]);

  // Refresh when returning to this screen (e.g. after adding a course)
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { if (user) load(); });
    return unsub;
  }, [navigation, user, load]);

  const q = search.toLowerCase();
  const filtered = q
    ? courses.filter(co =>
        (co.name || '').toLowerCase().includes(q) ||
        (co.city || '').toLowerCase().includes(q) ||
        (co.state || '').toLowerCase().includes(q))
    : courses;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.green} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Search bar */}
      <View style={[s.searchRow, { backgroundColor: c.bgCard, borderBottomColor: c.borderSubtle }]}>
        <Text style={{ color: c.textMuted, marginRight: 8, fontSize: 15 }}>🔍</Text>
        <TextInput
          style={[s.searchInput, { color: c.textPrimary, fontFamily: MONO }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search courses…"
          placeholderTextColor={c.textMuted}
          returnKeyType="search"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: c.textMuted, fontSize: 14, padding: 4 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={c.green}
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={[s.emptyWrap, { borderColor: c.borderSubtle }]}>
            <Text style={s.emptyIcon}>⛳</Text>
            <Text style={[s.emptyTitle, { color: c.textPrimary, fontFamily: 'Inter_700Bold' }]}>
              {search ? 'No courses match' : 'No courses yet'}
            </Text>
            <Text style={[s.emptySub, { color: c.textMuted, fontFamily: MONO }]}>
              {search ? 'Try a different search term.' : 'Tap + to add your first course and start building your course book.'}
            </Text>
          </View>
        ) : (
          filtered.map(course => {
            const accentKey = TYPE_COLOR[course.type] || 'teal';
            const accent    = c[accentKey]       || c.teal;
            const accentBg  = c[accentKey+'Glow']|| c.tealGlow;
            return (
              <TouchableOpacity
                key={course.id}
                style={[s.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}
                onPress={() => {
                  triggerHaptic();
                  navigation.navigate('CourseDetail', { courseId: course.id });
                }}
                activeOpacity={0.75}
              >
                {/* Top row */}
                <View style={s.cardTop}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[s.cardName, { color: c.textPrimary }]} numberOfLines={1}>
                      {course.name || 'Unnamed Course'}
                    </Text>
                    <Text style={[s.cardLoc, { color: c.textMuted, fontFamily: MONO }]} numberOfLines={1}>
                      {[course.city, course.state].filter(Boolean).join(', ') || 'Location not set'}
                    </Text>
                  </View>
                  <View style={[s.typeTag, { backgroundColor: accentBg, borderColor: accent }]}>
                    <Text style={[s.typeTagTxt, { color: accent, fontFamily: MONO }]}>
                      {course.type || 'Public'}
                    </Text>
                  </View>
                </View>

                {/* Stars + stats */}
                <View style={s.cardMid}>
                  <StarRow value={course.difficultyStars || 0} />
                  <View style={s.statRow}>
                    {!!course.holes      && <Chip label={`${course.holes} holes`} c={c} />}
                    {!!course.par        && <Chip label={`Par ${course.par}`}     c={c} />}
                    {!!course.greenFeeRange && <Chip label={course.greenFeeRange} color={c.green} c={c} />}
                  </View>
                </View>

                {/* Rating/slope */}
                {(course.courseRating || course.slopeRating) ? (
                  <View style={s.ratingRow}>
                    {!!course.courseRating && (
                      <Text style={[s.ratingTxt, { color: c.textMuted, fontFamily: MONO }]}>
                        Rating {course.courseRating}
                      </Text>
                    )}
                    {!!course.slopeRating && (
                      <Text style={[s.ratingTxt, { color: c.textMuted, fontFamily: MONO }]}>
                        Slope {course.slopeRating}
                      </Text>
                    )}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { backgroundColor: c.green }]}
        onPress={() => { triggerHaptic(); navigation.navigate('AddCourse'); }}
        activeOpacity={0.85}
      >
        <Text style={[s.fabTxt, { color: '#fff' }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function Chip({ label, color, c }) {
  return (
    <Text style={[s.chip, { color: color || c.textMuted, fontFamily: MONO }]}>
      {label}
    </Text>
  );
}

const s = StyleSheet.create({
  searchRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  scroll:      { padding: 14, paddingBottom: 80 },

  card:    { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardName:{ fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold', marginBottom: 3 },
  cardLoc: { fontSize: 11 },
  typeTag: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, flexShrink: 0 },
  typeTagTxt: { fontSize: 10, fontWeight: '700' },
  cardMid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    { fontSize: 11 },
  ratingRow:  { flexDirection: 'row', gap: 16 },
  ratingTxt:  { fontSize: 10 },

  emptyWrap:  { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, marginTop: 20 },
  emptyIcon:  { fontSize: 44, marginBottom: 14 },
  emptyTitle: { fontSize: 18, marginBottom: 8, textAlign: 'center' },
  emptySub:   { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  fab:    { position: 'absolute', bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, shadowOpacity: 0.25 },
  fabTxt: { fontSize: 30, fontWeight: '300', lineHeight: 34, marginTop: -2 },
});
