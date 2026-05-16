import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import ToolCard from '../../components/ToolCard';

const SECTIONS = [
  {
    label: 'Academics',
    tools: [
      { id: 'ap', title: 'Academic Planner', description: 'Courses, assignments, grade tracking, notes, and GPA overview.', icon: '🎓', accent: 'blue', route: 'AcademicPlanner' },
    ],
  },
  {
    label: 'Career',
    tools: [
      { id: 'nw', title: 'Network', description: 'Personal CRM — contacts, relationship strength, follow-ups.', icon: '🤝', accent: 'blue', route: 'Network' },
    ],
  },
  {
    label: 'Fitness',
    tools: [
      { id: 'wt', title: 'Workout Tracker', description: 'Program cards, day/week tabs, log weights, PR tracker.', icon: '💪', accent: 'red', route: 'WorkoutTracker' },
    ],
  },
];

export default function LifeHomeScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* ── Hero gradient banner ── */}
      <LinearGradient
        colors={isDark ? ['rgba(22,27,34,0.95)', 'transparent'] : ['rgba(255,255,255,0.9)', 'transparent']}
        style={styles.hero}
      >
        <Text style={[styles.heroTitle, { color: c.textPrimary }]}>Life</Text>
        <Text style={[styles.heroSub,   { color: c.textMuted   }]}>Academics, career & fitness</Text>
      </LinearGradient>

      {SECTIONS.map(section => (
        <View key={section.label}>
          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
            {section.label.toUpperCase()}
          </Text>
          {section.tools.map(tool => (
            <ToolCard
              key={tool.id}
              title={tool.title}
              description={tool.description}
              icon={tool.icon}
              accent={tool.accent}
              onPress={() => navigation.navigate(tool.route)}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content:      { paddingBottom: 32 },
  hero:         { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  heroTitle:    { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 4, fontFamily: 'Inter_700Bold' },
  heroSub:      { fontSize: 13, fontFamily: 'Inter_400Regular' },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 8, marginBottom: 8, marginLeft: 16, fontFamily: 'Inter_600SemiBold' },
});
