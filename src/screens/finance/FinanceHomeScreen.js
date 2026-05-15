import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
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
  const { theme } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bgBase }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {SECTIONS.map(section => (
        <View key={section.label}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>
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
  content:      { padding: 16, paddingBottom: 32 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 8, marginBottom: 8, marginLeft: 2 },
});
