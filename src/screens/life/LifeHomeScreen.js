import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import ToolCard from '../../components/ToolCard';

const SECTIONS = [
  {
    label: 'Academics',
    tools: [
      {
        id: 'ap',
        title: 'Academic Planner',
        description: 'Courses, assignments, grade tracking, notes, and GPA overview.',
        icon: '🎓',
        accent: 'blue',
        route: 'AcademicPlanner',
      },
    ],
  },
  {
    label: 'Career',
    tools: [
      {
        id: 'nw',
        title: 'Network',
        description: 'Personal CRM — contacts, relationship strength, follow-ups.',
        icon: '🤝',
        accent: 'blue',
        route: 'Network',
      },
    ],
  },
  {
    label: 'Fitness',
    tools: [
      {
        id: 'wt',
        title: 'Workout Tracker',
        description: 'Program cards, day/week tabs, log weights, PR tracker.',
        icon: '💪',
        accent: 'red',
        route: 'WorkoutTracker',
      },
    ],
  },
];

export default function LifeHomeScreen({ navigation }) {
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
  content: { padding: 16, paddingBottom: 32 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 2,
  },
});
