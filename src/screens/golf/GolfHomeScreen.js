import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import ToolCard from '../../components/ToolCard';

const SECTIONS = [
  {
    label: 'On the Course',
    tools: [
      {
        id: 'rt',
        title: 'Round Tracker',
        description: 'Log rounds, scorecard stats, par 3 breakdowns, and scoring trends.',
        icon: '⛳',
        accent: 'teal',
        route: 'RoundTracker',
      },
      {
        id: 'pl',
        title: 'Practice Log',
        description: 'Field goals, short game sinks, putting drills, custom routines.',
        icon: '🎯',
        accent: 'green',
        route: 'PracticeLog',
      },
    ],
  },
  {
    label: 'Equipment',
    tools: [
      {
        id: 'eq',
        title: 'Equipment',
        description: "Club inventory with full spec tracking. What's in the bag.",
        icon: '🏌️',
        accent: 'teal',
        route: 'Equipment',
      },
      {
        id: 'cd',
        title: 'Club Distances',
        description: 'Carry and total averages per club, session tracking, trend spark.',
        icon: '📡',
        accent: 'blue',
        route: 'ClubDistances',
      },
    ],
  },
];

export default function GolfHomeScreen({ navigation }) {
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
