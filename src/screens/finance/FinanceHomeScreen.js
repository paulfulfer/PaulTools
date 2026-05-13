import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import ToolCard from '../../components/ToolCard';

const TOOLS = [
  {
    id: 'fp',
    title: 'Financial Planner',
    description: 'Income modeling, tax projections, expenses, repayment schedules, and goals.',
    icon: '📊',
    accent: 'green',
    route: 'FinancialPlanner',
  },
  {
    id: 'sl',
    title: 'Shift Log',
    description: 'Clock in/out, track hours and gross earnings across all jobs.',
    icon: '⏱',
    accent: 'blue',
    route: 'ShiftLog',
  },
  {
    id: 'el',
    title: 'Expense Log',
    description: 'Log transactions by category, track spending totals and breakdowns.',
    icon: '💳',
    accent: 'amber',
    route: 'ExpenseLog',
  },
  {
    id: 'ri',
    title: 'Roth IRA Tracker',
    description: 'Contribution progress, pace tracking, balance, and long-term projection.',
    icon: '📈',
    accent: 'purple',
    route: 'RothIRA',
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
      {TOOLS.map(tool => (
        <ToolCard
          key={tool.id}
          title={tool.title}
          description={tool.description}
          icon={tool.icon}
          accent={tool.accent}
          onPress={() => navigation.navigate(tool.route)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
});
