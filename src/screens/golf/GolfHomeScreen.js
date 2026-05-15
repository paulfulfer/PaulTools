import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import ToolCard from '../../components/ToolCard';

const SECTIONS = [
  {
    label: 'On the Course',
    tools: [
      { id: 'rt', title: 'Round Tracker',  description: 'Log rounds, scorecard stats, par 3 breakdowns, and scoring trends.', icon: '⛳', accent: 'teal',  route: 'RoundTracker' },
      { id: 'pl', title: 'Practice Log',   description: 'Field goals, short game sinks, putting drills, custom routines.',     icon: '🎯', accent: 'green', route: 'PracticeLog'  },
    ],
  },
  {
    label: 'Equipment',
    tools: [
      { id: 'eq', title: 'Equipment',      description: "Club inventory with full spec tracking. What's in the bag.",          icon: '🏌️', accent: 'teal',  route: 'Equipment'    },
      { id: 'cd', title: 'Club Distances', description: 'Carry and total averages per club, session tracking, trend spark.',   icon: '📡', accent: 'blue',  route: 'ClubDistances'},
    ],
  },
  {
    label: 'Training & Analysis',
    tools: [
      { id: 'mt', title: 'Margin Tracker', description: 'Dispersion analysis, par margin benchmarks, and session trend tracking.', icon: '🎯', accent: 'green', route: 'MarginTracker' },
    ],
  },
];

export default function GolfHomeScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* ── Hero gradient banner ── */}
      <LinearGradient
        colors={isDark ? ['rgba(22,27,34,0.95)', 'transparent'] : ['rgba(255,255,255,0.9)', 'transparent']}
        style={styles.hero}
      >
        <Text style={[styles.heroTitle, { color: c.textPrimary }]}>Golf</Text>
        <Text style={[styles.heroSub,   { color: c.textMuted   }]}>On-course & practice tools</Text>
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
