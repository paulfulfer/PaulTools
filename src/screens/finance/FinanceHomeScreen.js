import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import ToolCard from '../../components/ToolCard';

const SECTIONS = [
  {
    label: 'Finance',
    tools: [
      { id: 'fp', title: 'Financial Planner', description: 'Income modeling, tax projections, expenses, repayment schedules, and goals.', icon: '📊', accent: 'green',  route: 'FinancialPlanner' },
      { id: 'sl', title: 'Shift Log',          description: 'Clock in/out, track hours and gross earnings across all jobs.',                icon: '⏱',  accent: 'blue',   route: 'ShiftLog' },
      { id: 'el', title: 'Expense Log',        description: 'Log transactions by category, track spending totals and breakdowns.',         icon: '💳', accent: 'amber',  route: 'ExpenseLog' },
      { id: 'ri', title: 'Roth IRA Tracker',   description: 'Contribution progress, pace tracking, balance, and long-term projection.',    icon: '📈', accent: 'purple', route: 'RothIRA' },
    ],
  },
  {
    label: 'Food',
    tools: [
      { id: 'mc', title: 'Meal Cost Tracker', description: 'Ingredient-level food cost tracking — grocery inventory, meal builder, and spending stats.', icon: '🍽️', accent: 'green', route: 'MealCostTracker' },
    ],
  },
];

export default function FinanceHomeScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* ── Hero gradient banner ── */}
      <LinearGradient
        colors={isDark ? ['rgba(22,27,34,0.95)', 'transparent'] : ['rgba(255,255,255,0.9)', 'transparent']}
        style={styles.hero}
      >
        <Text style={[styles.heroTitle, { color: c.textPrimary }]}>Finance</Text>
        <Text style={[styles.heroSub,   { color: c.textMuted   }]}>Your financial toolkit</Text>
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
