import React from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth }    from '../context/AuthContext';
import { useTheme }   from '../context/ThemeContext';
import { useHaptics } from '../context/HapticsContext';

import SignInScreen from '../screens/auth/SignInScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

import FinanceHomeScreen from '../screens/finance/FinanceHomeScreen';
import FinancialPlannerScreen from '../screens/finance/FinancialPlannerScreen';
import ShiftLogScreen from '../screens/finance/ShiftLogScreen';
import ExpenseLogScreen from '../screens/finance/ExpenseLogScreen';
import RothIRAScreen from '../screens/finance/RothIRAScreen';
import MealCostTrackerScreen from '../screens/finance/MealCostTrackerScreen';

import GolfHomeScreen from '../screens/golf/GolfHomeScreen';
import RoundTrackerScreen from '../screens/golf/RoundTrackerScreen';
import PracticeLogScreen from '../screens/golf/PracticeLogScreen';
import EquipmentScreen from '../screens/golf/EquipmentScreen';
import ClubDistancesScreen from '../screens/golf/ClubDistancesScreen';
import MarginTrackerScreen from '../screens/golf/MarginTrackerScreen';

import LifeHomeScreen from '../screens/life/LifeHomeScreen';
import AcademicPlannerScreen from '../screens/life/AcademicPlannerScreen';
import ClassDetailScreen from '../screens/life/ClassDetailScreen';
import NetworkScreen from '../screens/life/NetworkScreen';
import WorkoutTrackerScreen from '../screens/life/WorkoutTrackerScreen';

const RootStack = createNativeStackNavigator();
const Tab       = createBottomTabNavigator();
const Finance   = createNativeStackNavigator();
const Golf      = createNativeStackNavigator();
const Life      = createNativeStackNavigator();

// ─── Header buttons ───────────────────────────────────────────────────────────

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const { triggerHaptic }       = useHaptics();
  return (
    <TouchableOpacity
      onPress={() => { triggerHaptic(); toggleTheme(); }}
      style={{ paddingHorizontal: 4 }}
    >
      <Text style={{ fontSize: 18 }}>{isDark ? '🌙' : '☀️'}</Text>
    </TouchableOpacity>
  );
}

// Settings gear + theme toggle shown on each tab's home screen
function HomeHeaderRight({ navigation }) {
  const { theme }         = useTheme();
  const { triggerHaptic } = useHaptics();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <TouchableOpacity
        onPress={() => { triggerHaptic(); navigation.navigate('Settings'); }}
        style={{ paddingHorizontal: 4 }}
      >
        <Ionicons name="settings-outline" size={22} color={theme.colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Stack screen options (shared default for sub-screens) ────────────────────

function useStackOptions() {
  const { theme } = useTheme();
  return {
    headerStyle:      { backgroundColor: theme.colors.bgCard },
    headerTintColor:  theme.colors.textPrimary,
    headerTitleStyle: { fontWeight: '700', fontSize: 17 },
    headerShadowVisible: false,
    contentStyle:     { backgroundColor: theme.colors.bgBase },
    headerRight:      () => <ThemeToggle />,
  };
}

// ─── Tab navigators ───────────────────────────────────────────────────────────

function FinanceNavigator() {
  const screenOptions = useStackOptions();
  return (
    <Finance.Navigator screenOptions={screenOptions}>
      <Finance.Screen
        name="FinanceHome"
        component={FinanceHomeScreen}
        options={({ navigation }) => ({
          title: 'Finance',
          headerRight: () => <HomeHeaderRight navigation={navigation} />,
        })}
      />
      <Finance.Screen name="FinancialPlanner"  component={FinancialPlannerScreen}  options={{ title: 'Financial Planner' }} />
      <Finance.Screen name="ShiftLog"          component={ShiftLogScreen}          options={{ title: 'Shift Log' }} />
      <Finance.Screen name="ExpenseLog"        component={ExpenseLogScreen}        options={{ title: 'Expense Log' }} />
      <Finance.Screen name="RothIRA"           component={RothIRAScreen}           options={{ title: 'Roth IRA Tracker' }} />
      <Finance.Screen name="MealCostTracker"   component={MealCostTrackerScreen}   options={{ title: 'Meal Cost Tracker' }} />
      <Finance.Screen name="Settings"          component={SettingsScreen}          options={{ title: 'Settings' }} />
    </Finance.Navigator>
  );
}

function GolfNavigator() {
  const screenOptions = useStackOptions();
  return (
    <Golf.Navigator screenOptions={screenOptions}>
      <Golf.Screen
        name="GolfHome"
        component={GolfHomeScreen}
        options={({ navigation }) => ({
          title: 'Golf',
          headerRight: () => <HomeHeaderRight navigation={navigation} />,
        })}
      />
      <Golf.Screen name="RoundTracker"  component={RoundTrackerScreen}  options={{ title: 'Round Tracker' }} />
      <Golf.Screen name="PracticeLog"   component={PracticeLogScreen}   options={{ title: 'Practice Log' }} />
      <Golf.Screen name="Equipment"     component={EquipmentScreen}     options={{ title: 'Equipment' }} />
      <Golf.Screen name="ClubDistances" component={ClubDistancesScreen} options={{ title: 'Club Distances' }} />
      <Golf.Screen name="MarginTracker" component={MarginTrackerScreen} options={{ title: 'Margin Tracker' }} />
      <Golf.Screen name="Settings"      component={SettingsScreen}      options={{ title: 'Settings' }} />
    </Golf.Navigator>
  );
}

function LifeNavigator() {
  const screenOptions = useStackOptions();
  return (
    <Life.Navigator screenOptions={screenOptions}>
      <Life.Screen
        name="LifeHome"
        component={LifeHomeScreen}
        options={({ navigation }) => ({
          title: 'Life',
          headerRight: () => <HomeHeaderRight navigation={navigation} />,
        })}
      />
      <Life.Screen name="AcademicPlanner" component={AcademicPlannerScreen} options={{ title: 'Academic Planner' }} />
      <Life.Screen name="ClassDetail"     component={ClassDetailScreen}     options={{ title: 'Course' }} />
      <Life.Screen name="Network"         component={NetworkScreen}         options={{ title: 'Network' }} />
      <Life.Screen name="WorkoutTracker"  component={WorkoutTrackerScreen}  options={{ title: 'Workout Tracker' }} />
      <Life.Screen name="Settings"        component={SettingsScreen}        options={{ title: 'Settings' }} />
    </Life.Navigator>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function MainTabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor:  theme.colors.tabBarBorder,
          borderTopWidth:  1,
        },
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
      }}
    >
      <Tab.Screen
        name="FinanceTab"
        component={FinanceNavigator}
        options={{
          title: 'Finance',
          tabBarActiveTintColor: theme.colors.green,
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="GolfTab"
        component={GolfNavigator}
        options={{
          title: 'Golf',
          tabBarActiveTintColor: theme.colors.teal,
          tabBarIcon: ({ color, size }) => <Ionicons name="flag-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="LifeTab"
        component={LifeNavigator}
        options={{
          title: 'Life',
          tabBarActiveTintColor: theme.colors.purple,
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────

export default function RootNavigator() {
  const { user }        = useAuth();
  const { theme, isDark } = useTheme();

  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navTheme  = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary:      theme.colors.blue,
      background:   theme.colors.bgBase,
      card:         theme.colors.bgCard,
      text:         theme.colors.textPrimary,
      border:       theme.colors.borderSubtle,
      notification: theme.colors.red,
    },
  };

  if (user === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bgBase, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.blue} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Screen name="SignIn" component={SignInScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
