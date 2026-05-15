import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../hooks/useHaptics';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(str) {
  return new Date(str+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
}
function fmtShort(str) {
  return new Date(str+'T00:00:00').toLocaleDateString('en-US',{month:'numeric',day:'numeric'});
}
function fmt$(n) { return '$'+(parseFloat(n)||0).toFixed(2); }

// ─── Shared sub-components ────────────────────────────────────────────────────

function FLabel({ label, c }) {
  return <Text style={[fl.t, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>;
}
const fl = StyleSheet.create({ t: { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, marginBottom: 3, marginTop: 10 } });

function MetCard({ label, value, sub, color, c }) {
  return (
    <View style={[mc.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
      <Text style={[mc.label, { color: c.textMuted, fontFamily: MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[mc.value, { color: color || c.textPrimary, fontFamily: MONO }]}>{value}</Text>
      {!!sub && <Text style={[mc.sub, { color: c.textMuted, fontFamily: MONO }]}>{sub}</Text>}
    </View>
  );
}
const mc = StyleSheet.create({
  card:  { flex: 1, minWidth: '30%', borderWidth: 1, borderRadius: 8, padding: 10, margin: 3 },
  label: { fontSize: 9, letterSpacing: 0.8, marginBottom: 3 },
  value: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  sub:   { fontSize: 9, marginTop: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MealCostTrackerScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const { triggerHaptic } = useHaptics();
  const c = theme.colors;

  // ── Data state ──────────────────────────────────────────────────────────────
  const [inventory, setInventory] = useState([]);
  const [meals,     setMeals]     = useState([]);
  const [idC,       setIdC]       = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [saved,     setSaved]     = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('grocery');

  // ── Grocery form ────────────────────────────────────────────────────────────
  const [fDate,     setFDate]     = useState(new Date());
  const [fName,     setFName]     = useState('');
  const [fType,     setFType]     = useState('grocery');
  const [fCost,     setFCost]     = useState('');
  const [fUnits,    setFUnits]    = useState('');
  const [fUnitName, setFUnitName] = useState('');
  const [fNotes,    setFNotes]    = useState('');
  const [showFDate, setShowFDate] = useState(false);

  // ── Meal form ───────────────────────────────────────────────────────────────
  const [mDate,       setMDate]       = useState(new Date());
  const [mName,       setMName]       = useState('');
  const [mType,       setMType]       = useState('home');
  const [mNotes,      setMNotes]      = useState('');
  const [mToCost,     setMToCost]     = useState('');
  const [mToPortions, setMToPortions] = useState('1');
  const [mToAddInv,   setMToAddInv]   = useState(false);
  const [mealIngs,    setMealIngs]    = useState({}); // { [itemId]: qtyString }
  const [showMDate,   setShowMDate]   = useState(false);

  // ── Refs (stale-closure guard for async handlers) ───────────────────────────
  const invRef   = useRef(inventory);
  const mealsRef = useRef(meals);
  const idCRef   = useRef(idC);
  const userRef  = useRef(user);
  useEffect(() => { invRef.current   = inventory; }, [inventory]);
  useEffect(() => { mealsRef.current = meals;     }, [meals]);
  useEffect(() => { idCRef.current   = idC;       }, [idC]);
  useEffect(() => { userRef.current  = user;      }, [user]);

  // ── Firestore ───────────────────────────────────────────────────────────────

  const docRef = () => {
    const uid = userRef.current?.uid;
    if (!uid) return null;
    return firebase.firestore().collection('users').doc(uid).collection('localStorage').doc('data');
  };

  const writeAll = async (inv, mls, id) => {
    const ref = docRef();
    if (!ref) return;
    await ref.set({
      meal_inventory: JSON.stringify(inv),
      meal_meals:     JSON.stringify(mls),
      meal_id:        String(id),
    }, { merge: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const ref  = docRef();
      if (!ref) return;
      const snap = await ref.get();
      const d    = snap.exists ? snap.data() : {};
      setInventory(JSON.parse(d.meal_inventory || '[]'));
      setMeals(JSON.parse(d.meal_meals || '[]'));
      setIdC(parseInt(d.meal_id || '1', 10));
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const addPurchase = async () => {
    triggerHaptic();
    const cost  = parseFloat(fCost);
    const units = parseFloat(fUnits);
    if (!fName.trim())              return Alert.alert('Required', 'Enter an item name.');
    if (isNaN(cost)  || cost  <= 0) return Alert.alert('Required', 'Enter a valid cost.');
    if (isNaN(units) || units <= 0) return Alert.alert('Required', 'Enter valid units.');
    const unitName = fUnitName.trim() || 'serving';
    const item = {
      id: idCRef.current, name: fName.trim(), cost,
      totalUnits: units, remainingUnits: units,
      unitName, costPerUnit: cost / units,
      date: fmtDateKey(fDate), type: fType, notes: fNotes.trim(),
    };
    const newInv = [...invRef.current, item];
    const newId  = idCRef.current + 1;
    setInventory(newInv);
    setIdC(newId);
    setFName(''); setFCost(''); setFUnits(''); setFUnitName(''); setFNotes('');
    try { await writeAll(newInv, mealsRef.current, newId); }
    catch (err) { Alert.alert('Save error', err.message); }
  };

  const deleteInventoryItem = (id) => {
    Alert.alert('Remove item?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = invRef.current.filter(x => x.id !== id);
        setInventory(updated);
        try { await writeAll(updated, mealsRef.current, idCRef.current); }
        catch (err) { Alert.alert('Save error', err.message); }
      }},
    ]);
  };

  const logMeal = async () => {
    triggerHaptic();
    if (!mName.trim()) return Alert.alert('Required', 'Enter a meal name.');

    let mealCost = 0;
    let ingredientsList = [];
    let newId = idCRef.current;
    let updatedInv = invRef.current.map(x => ({ ...x })); // shallow copy each item

    if (mType === 'home') {
      const groceries = updatedInv.filter(x => x.type === 'grocery' && x.remainingUnits > 0);
      const used = groceries.filter(item => parseFloat(mealIngs[item.id]) > 0);
      if (used.length === 0) return Alert.alert('Required', 'Select at least one ingredient.');

      for (const item of used) {
        const qty = parseFloat(mealIngs[item.id]);
        if (qty > item.remainingUnits) {
          return Alert.alert('Not enough stock', `Only ${item.remainingUnits.toFixed(1)} ${item.unitName} of ${item.name} remaining.`);
        }
        const cost = qty * item.costPerUnit;
        mealCost += cost;
        ingredientsList.push({ id: item.id, name: item.name, qty, unitName: item.unitName, cost });
        // Deduct from the copied inventory
        const inv_item = updatedInv.find(x => x.id === item.id);
        if (inv_item) inv_item.remainingUnits = Math.max(0, parseFloat((inv_item.remainingUnits - qty).toFixed(2)));
      }
    } else {
      const totalCost = parseFloat(mToCost);
      const portions  = parseFloat(mToPortions) || 1;
      if (isNaN(totalCost) || totalCost <= 0) return Alert.alert('Required', 'Enter the takeout cost.');
      const portionCost = totalCost / portions;
      mealCost = portionCost;
      ingredientsList = [{ name: 'Takeout', qty: portions, unitName: 'portions', cost: totalCost }];
      if (mToAddInv) {
        updatedInv = [...updatedInv, {
          id: newId++,
          name: mName.trim() + ' (leftover)',
          cost: totalCost,
          totalUnits: portions,
          remainingUnits: Math.max(0, portions - 1),
          unitName: 'portions',
          costPerUnit: portionCost,
          date: fmtDateKey(mDate),
          type: 'takeout',
          notes: 'Auto from meal log',
        }];
      }
    }

    const meal = {
      id: newId++,
      name: mName.trim(),
      date: fmtDateKey(mDate),
      type: mType,
      cost: mealCost,
      ingredients: ingredientsList,
      notes: mNotes.trim(),
    };

    const updatedMeals = [meal, ...mealsRef.current];
    setInventory(updatedInv);
    setMeals(updatedMeals);
    setIdC(newId);
    setMealIngs({});
    setMName(''); setMNotes(''); setMToCost(''); setMToPortions('1'); setMToAddInv(false);
    try { await writeAll(updatedInv, updatedMeals, newId); }
    catch (err) { Alert.alert('Save error', err.message); }
  };

  const deleteMeal = (id) => {
    Alert.alert('Delete meal?', 'Ingredient deductions are not restored.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const updated = mealsRef.current.filter(m => m.id !== id);
        setMeals(updated);
        try { await writeAll(invRef.current, updated, idCRef.current); }
        catch (err) { Alert.alert('Save error', err.message); }
      }},
    ]);
  };

  // ── Derived metrics ─────────────────────────────────────────────────────────

  const totalSpent    = inventory.reduce((s, x) => s + x.cost, 0);
  const homeMeals     = meals.filter(m => m.type === 'home');
  const takeoutMeals  = meals.filter(m => m.type === 'takeout');
  const avgMeal       = meals.length     > 0 ? meals.reduce((s, m) => s + m.cost, 0) / meals.length       : null;
  const avgHome       = homeMeals.length > 0 ? homeMeals.reduce((s, m) => s + m.cost, 0) / homeMeals.length     : null;
  const avgTakeout    = takeoutMeals.length > 0 ? takeoutMeals.reduce((s, m) => s + m.cost, 0) / takeoutMeals.length : null;
  const savingsPerMeal = avgHome != null && avgTakeout != null ? avgTakeout - avgHome : null;
  const totalSaved     = savingsPerMeal != null && savingsPerMeal > 0 ? savingsPerMeal * homeMeals.length : null;

  const groceryItems   = inventory.filter(x => x.type === 'grocery' && x.remainingUnits > 0);
  const calcMealCost   = groceryItems.reduce((s, item) => s + (parseFloat(mealIngs[item.id])||0) * item.costPerUnit, 0);
  const usedIngCount   = groceryItems.filter(item => parseFloat(mealIngs[item.id]) > 0).length;
  const toPreview      = (parseFloat(mToCost)||0) / (parseFloat(mToPortions)||1);
  const fCostPreview   = (parseFloat(fCost)||0) / (parseFloat(fUnits)||1);

  // ── Stats ───────────────────────────────────────────────────────────────────

  const renderStats = () => {
    if (meals.length === 0 && inventory.length === 0) {
      return (
        <View style={[st.emptyBox, { borderColor: c.borderSubtle }]}>
          <Text style={[st.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>
            Add groceries and log meals to see stats.
          </Text>
        </View>
      );
    }

    const totalPurchased = inventory.reduce((s, x) => s + x.cost, 0);
    const totalUsed      = inventory.reduce((s, x) => x.totalUnits > 0 ? s + x.cost * (1 - x.remainingUnits / x.totalUnits) : s, 0);
    const efficiency     = totalPurchased > 0 ? (totalUsed / totalPurchased * 100) : 0;
    const potentialWaste = inventory.filter(x => x.remainingUnits > 0).reduce((s, x) => s + x.remainingUnits * x.costPerUnit, 0);

    const byDay      = {};
    meals.forEach(m => { byDay[m.date] = (byDay[m.date] || 0) + m.cost; });
    const dayEntries = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
    const maxDay     = Math.max(...dayEntries.map(([, v]) => v), 0.01);

    const ingCosts = {};
    homeMeals.forEach(m => m.ingredients.forEach(i => { ingCosts[i.name] = (ingCosts[i.name] || 0) + i.cost; }));
    const topIngs = Object.entries(ingCosts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxIng  = Math.max(...topIngs.map(([, v]) => v), 0.01);

    const sorted   = [...meals].sort((a, b) => a.cost - b.cost);
    const cheapest = sorted.slice(0, 3);
    const priciest = sorted.slice(-3).reverse();

    const effColor = efficiency > 80 ? c.green : efficiency > 50 ? c.amber : c.red;

    return (
      <>
        {/* Savings banner */}
        {savingsPerMeal != null && savingsPerMeal > 0 && (
          <View style={[st.savingsBanner, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
            <Text style={[st.savingsTxt, { color: c.green, fontFamily: MONO }]}>
              ✓ Cooking saves {fmt$(savingsPerMeal)}/meal vs takeout · Estimated total saved: {fmt$(totalSaved)}
            </Text>
          </View>
        )}

        {/* Comparison cards */}
        <View style={st.cmpRow}>
          <View style={[st.cmpCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <Text style={[st.cmpLabel, { color: c.textMuted, fontFamily: MONO }]}>AVG HOME</Text>
            <Text style={[st.cmpVal,   { color: c.green,     fontFamily: MONO }]}>{avgHome != null ? fmt$(avgHome) : '—'}</Text>
            <Text style={[st.cmpSub,   { color: c.textMuted, fontFamily: MONO }]}>{homeMeals.length} meals</Text>
          </View>
          <View style={[st.cmpCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <Text style={[st.cmpLabel, { color: c.textMuted, fontFamily: MONO }]}>AVG TAKEOUT</Text>
            <Text style={[st.cmpVal,   { color: c.amber,     fontFamily: MONO }]}>{avgTakeout != null ? fmt$(avgTakeout) : '—'}</Text>
            <Text style={[st.cmpSub,   { color: c.textMuted, fontFamily: MONO }]}>{takeoutMeals.length} meals</Text>
          </View>
          <View style={[st.cmpCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <Text style={[st.cmpLabel, { color: c.textMuted, fontFamily: MONO }]}>EFFICIENCY</Text>
            <Text style={[st.cmpVal,   { color: effColor,    fontFamily: MONO }]}>{efficiency.toFixed(0)}%</Text>
            <Text style={[st.cmpSub,   { color: c.textMuted, fontFamily: MONO }]}>food used</Text>
          </View>
          <View style={[st.cmpCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <Text style={[st.cmpLabel, { color: c.textMuted, fontFamily: MONO }]}>WASTE RISK</Text>
            <Text style={[st.cmpVal,   { color: c.red,       fontFamily: MONO }]}>{fmt$(potentialWaste)}</Text>
            <Text style={[st.cmpSub,   { color: c.textMuted, fontFamily: MONO }]}>unused value</Text>
          </View>
        </View>

        {/* Cost per day chart */}
        {dayEntries.length > 1 && (
          <View style={[st.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <Text style={[st.cardTitle, { color: c.textMuted, fontFamily: MONO }]}>COST PER DAY</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 90 }}>
              {dayEntries.map(([date, cost]) => {
                const h = Math.max(4, Math.round((cost / maxDay) * 72) + 6);
                return (
                  <View key={date} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                    <Text style={{ fontSize: 8, fontWeight: '600', color: c.amber, fontFamily: MONO }}>{fmt$(cost)}</Text>
                    <View style={{ width: '100%', height: h, backgroundColor: c.amber, borderRadius: 3, opacity: 0.8 }} />
                    <Text style={{ fontSize: 8, color: c.textMuted, fontFamily: MONO }}>{fmtShort(date)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Top ingredients */}
        {topIngs.length > 0 && (
          <View style={[st.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            <Text style={[st.cardTitle, { color: c.textMuted, fontFamily: MONO }]}>TOP INGREDIENTS BY COST</Text>
            {topIngs.map(([name, cost]) => (
              <View key={name} style={st.barRow}>
                <Text style={[st.barLabel, { color: c.textSecondary, fontFamily: MONO }]} numberOfLines={1}>{name}</Text>
                <View style={[st.barTrack, { backgroundColor: c.bgBase }]}>
                  <View style={[st.barFill, { width: `${(cost / maxIng * 100).toFixed(1)}%`, backgroundColor: c.green }]} />
                </View>
                <Text style={[st.barVal, { color: c.textPrimary, fontFamily: MONO }]}>{fmt$(cost)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Cheapest / priciest */}
        {meals.length > 0 && (
          <View style={st.rankRow}>
            <View style={[st.card, st.rankCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
              <Text style={[st.cardTitle, { color: c.textMuted, fontFamily: MONO }]}>CHEAPEST</Text>
              {cheapest.map(m => (
                <View key={m.id} style={[st.rankItem, { borderBottomColor: c.borderSubtle }]}>
                  <Text style={[st.rankName, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>{m.name}</Text>
                  <Text style={[st.rankCost, { color: c.green, fontFamily: MONO }]}>{fmt$(m.cost)}</Text>
                </View>
              ))}
            </View>
            <View style={[st.card, st.rankCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
              <Text style={[st.cardTitle, { color: c.textMuted, fontFamily: MONO }]}>PRICIEST</Text>
              {priciest.map(m => (
                <View key={m.id} style={[st.rankItem, { borderBottomColor: c.borderSubtle }]}>
                  <Text style={[st.rankName, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>{m.name}</Text>
                  <Text style={[st.rankCost, { color: c.amber, fontFamily: MONO }]}>{fmt$(m.cost)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={[st.centered]}><ActivityIndicator color={c.amber} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {saved && (
        <View style={[st.savedBadge, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
          <Text style={[st.savedText, { color: c.green, fontFamily: MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Metrics ──────────────────────────────────────────────────── */}
        <View style={st.metRow}>
          <MetCard label="Total Spent"  value={fmt$(totalSpent)}                        sub="all food"     color={c.amber} c={c} />
          <MetCard label="Avg / Meal"   value={avgMeal    != null ? fmt$(avgMeal)    : '—'} sub="all meals"    color={c.blue}  c={c} />
          <MetCard label="Avg Home"     value={avgHome    != null ? fmt$(avgHome)    : '—'} sub="cooked"       color={c.green} c={c} />
          <MetCard label="Avg Takeout"  value={avgTakeout != null ? fmt$(avgTakeout) : '—'} sub="per meal"     color={c.amber} c={c} />
          <MetCard label="Meals"        value={String(meals.length)}                    sub="logged"       c={c} />
          <MetCard label="Savings"      value={totalSaved != null ? fmt$(totalSaved) : '—'} sub="vs takeout" color={c.green} c={c} />
        </View>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <View style={st.tabRow}>
          {[
            { key: 'grocery', label: 'Groceries', color: c.green, bg: c.greenGlow },
            { key: 'meal',    label: 'Log Meal',  color: c.amber, bg: c.amberGlow },
            { key: 'stats',   label: 'Stats',     color: c.blue,  bg: c.blueGlow  },
          ].map(tab => (
            <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)}
              style={[st.tabBtn, {
                borderColor:     activeTab === tab.key ? tab.color : c.borderSubtle,
                backgroundColor: activeTab === tab.key ? tab.bg    : c.bgCard,
              }]}>
              <Text style={[st.tabTxt, { color: activeTab === tab.key ? tab.color : c.textMuted, fontFamily: MONO }]}>
                {tab.label.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* GROCERY TAB                                                   */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'grocery' && (
          <>
            <View style={[st.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
              <Text style={[st.cardTitle, { color: c.textMuted, fontFamily: MONO }]}>ADD GROCERY / TAKEOUT PURCHASE</Text>

              <View style={st.formRow}>
                <View style={{ flex: 1 }}>
                  <FLabel label="Date" c={c} />
                  <TouchableOpacity style={[st.dateBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                    onPress={() => setShowFDate(true)}>
                    <Text style={[st.dateTxt, { color: c.textPrimary, fontFamily: MONO }]}>
                      {fDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 2 }}>
                  <FLabel label="Item Name" c={c} />
                  <TextInput style={[st.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                    value={fName} onChangeText={setFName}
                    placeholder="e.g. Turkey, Bread loaf..." placeholderTextColor={c.textMuted} />
                </View>
              </View>

              <FLabel label="Type" c={c} />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
                {[
                  { v: 'grocery', label: 'Grocery', color: c.green, bg: c.greenGlow },
                  { v: 'takeout', label: 'Takeout', color: c.amber, bg: c.amberGlow },
                ].map(opt => (
                  <TouchableOpacity key={opt.v} onPress={() => setFType(opt.v)}
                    style={[st.typeBtn, { borderColor: fType === opt.v ? opt.color : c.borderSubtle, backgroundColor: fType === opt.v ? opt.bg : 'transparent' }]}>
                    <Text style={[st.typeTxt, { color: fType === opt.v ? opt.color : c.textMuted, fontFamily: MONO }]}>
                      {opt.label.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={st.formRow}>
                <View style={{ flex: 1 }}>
                  <FLabel label="Total Cost ($)" c={c} />
                  <TextInput style={[st.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.amber, fontFamily: MONO }]}
                    value={fCost} onChangeText={setFCost} placeholder="0.00"
                    placeholderTextColor={c.textMuted} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <FLabel label="Total Units" c={c} />
                  <TextInput style={[st.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                    value={fUnits} onChangeText={setFUnits} placeholder="e.g. 20"
                    placeholderTextColor={c.textMuted} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <FLabel label="Unit Name" c={c} />
                  <TextInput style={[st.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                    value={fUnitName} onChangeText={setFUnitName} placeholder="slices, oz..."
                    placeholderTextColor={c.textMuted} />
                </View>
              </View>

              {parseFloat(fCost) > 0 && parseFloat(fUnits) > 0 && (
                <View style={[st.costPreview, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                  <Text style={[st.costPreviewTxt, { color: c.green, fontFamily: MONO }]}>
                    {fmt$(fCostPreview)} / {fUnitName.trim() || 'unit'}
                  </Text>
                </View>
              )}

              <FLabel label="Notes (optional)" c={c} />
              <TextInput style={[st.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                value={fNotes} onChangeText={setFNotes} placeholder="e.g. 50% off, on sale..."
                placeholderTextColor={c.textMuted} />

              <TouchableOpacity style={[st.actionBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]} onPress={addPurchase}>
                <Text style={[st.actionBtnTxt, { color: c.green, fontFamily: MONO }]}>+ Add to Inventory</Text>
              </TouchableOpacity>
            </View>

            {showFDate && Platform.OS === 'android' && (
              <DateTimePicker value={fDate} mode="date" display="default"
                onChange={(e, d) => { setShowFDate(false); if (d) setFDate(d); }} />
            )}
            {showFDate && Platform.OS === 'ios' && (
              <>
                <DateTimePicker value={fDate} mode="date" display="spinner"
                  onChange={(e, d) => { if (d) setFDate(d); }} />
                <TouchableOpacity onPress={() => setShowFDate(false)} style={{ alignItems: 'flex-end', paddingRight: 4 }}>
                  <Text style={{ color: c.blue, fontWeight: '600', fontFamily: MONO }}>Done</Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={[st.secLabel, { color: c.textMuted, borderBottomColor: c.borderSubtle, fontFamily: MONO }]}>
              INVENTORY ({inventory.length} ITEMS)
            </Text>

            {inventory.length === 0 ? (
              <View style={[st.emptyBox, { borderColor: c.borderSubtle }]}>
                <Text style={[st.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No items yet. Add your first purchase above.</Text>
              </View>
            ) : (
              <View style={st.invGrid}>
                {inventory.map(item => {
                  const pct      = item.totalUnits > 0 ? Math.max(0, Math.min(100, (item.remainingUnits / item.totalUnits) * 100)) : 0;
                  const barColor = pct > 50 ? c.green : pct > 20 ? c.amber : c.red;
                  return (
                    <View key={item.id} style={[st.invCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                      <TouchableOpacity style={st.invDel} onPress={() => deleteInventoryItem(item.id)}>
                        <Text style={{ color: c.textMuted, fontSize: 12 }}>✕</Text>
                      </TouchableOpacity>
                      <View style={[st.invTag, {
                        backgroundColor: item.type === 'takeout' ? c.amberGlow : c.greenGlow,
                        borderColor:     item.type === 'takeout' ? c.amber     : c.green,
                      }]}>
                        <Text style={[st.invTagTxt, { color: item.type === 'takeout' ? c.amber : c.green, fontFamily: MONO }]}>
                          {item.type.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[st.invName, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>{item.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                        <Text style={[st.invPrice, { color: c.green, fontFamily: MONO }]}>{fmt$(item.costPerUnit)}</Text>
                        <Text style={[st.invPriceUnit, { color: c.textMuted, fontFamily: MONO }]}>/ {item.unitName}</Text>
                      </View>
                      <Text style={[st.invMeta, { color: c.textMuted, fontFamily: MONO }]}>
                        {fmt$(item.cost)} total · {item.totalUnits} {item.unitName}
                      </Text>
                      <Text style={[{ fontSize: 11, fontWeight: '600', color: barColor, fontFamily: MONO }]}>
                        {item.remainingUnits.toFixed(1)} {item.unitName} left
                      </Text>
                      {item.notes ? <Text style={[st.invMeta, { color: c.textMuted, fontFamily: MONO, fontStyle: 'italic' }]}>{item.notes}</Text> : null}
                      <View style={[st.stockTrack, { backgroundColor: c.bgBase }]}>
                        <View style={[st.stockFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* MEAL TAB                                                      */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'meal' && (
          <>
            <View style={[st.card, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
              <Text style={[st.cardTitle, { color: c.textMuted, fontFamily: MONO }]}>BUILD A MEAL</Text>

              <View style={st.formRow}>
                <View style={{ flex: 1 }}>
                  <FLabel label="Date" c={c} />
                  <TouchableOpacity style={[st.dateBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                    onPress={() => setShowMDate(true)}>
                    <Text style={[st.dateTxt, { color: c.textPrimary, fontFamily: MONO }]}>
                      {mDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 2 }}>
                  <FLabel label="Meal Name" c={c} />
                  <TextInput style={[st.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                    value={mName} onChangeText={setMName}
                    placeholder="e.g. Turkey sandwich..." placeholderTextColor={c.textMuted} />
                </View>
              </View>

              <FLabel label="Type" c={c} />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                {[
                  { v: 'home',    label: 'Home Cooked', color: c.green, bg: c.greenGlow },
                  { v: 'takeout', label: 'Takeout',     color: c.amber, bg: c.amberGlow },
                ].map(opt => (
                  <TouchableOpacity key={opt.v} onPress={() => setMType(opt.v)}
                    style={[st.typeBtn, { borderColor: mType === opt.v ? opt.color : c.borderSubtle, backgroundColor: mType === opt.v ? opt.bg : 'transparent' }]}>
                    <Text style={[st.typeTxt, { color: mType === opt.v ? opt.color : c.textMuted, fontFamily: MONO }]}>
                      {opt.label.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Home: ingredient picker ── */}
              {mType === 'home' && (
                <View style={[st.ingPicker, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
                  <Text style={[st.ingTitle, { color: c.textMuted, fontFamily: MONO }]}>SELECT INGREDIENTS USED</Text>
                  {groceryItems.length === 0 ? (
                    <Text style={[st.ingEmpty, { color: c.textMuted, fontFamily: MONO }]}>
                      No grocery items in inventory. Add groceries first.
                    </Text>
                  ) : (
                    groceryItems.map(item => {
                      const qty     = mealIngs[item.id] || '';
                      const rowCost = (parseFloat(qty) || 0) * item.costPerUnit;
                      return (
                        <View key={item.id} style={[st.ingRow, { borderBottomColor: c.borderSubtle }]}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[st.ingName, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>{item.name}</Text>
                            <Text style={[st.ingStock, { color: c.textMuted, fontFamily: MONO }]}>
                              {item.remainingUnits.toFixed(1)} {item.unitName} left
                            </Text>
                          </View>
                          <TextInput
                            style={[st.ingQty, { borderColor: c.borderSubtle, backgroundColor: c.bgCard, color: c.textPrimary, fontFamily: MONO }]}
                            value={qty}
                            onChangeText={v => setMealIngs(prev => ({ ...prev, [item.id]: v }))}
                            placeholder="0" placeholderTextColor={c.textMuted} keyboardType="decimal-pad"
                          />
                          <Text style={[st.ingUnit, { color: c.textMuted, fontFamily: MONO }]}>{item.unitName}</Text>
                          <Text style={[st.ingCost, { color: rowCost > 0 ? c.green : c.textMuted, fontFamily: MONO }]}>
                            {rowCost > 0 ? fmt$(rowCost) : '$0.00'}
                          </Text>
                        </View>
                      );
                    })
                  )}
                  <View style={[st.calcRow, { borderTopColor: c.borderSubtle }]}>
                    <Text style={[st.calcLabel, { color: c.textMuted, fontFamily: MONO }]}>Meal cost:</Text>
                    <Text style={[st.calcCost, { color: c.green, fontFamily: MONO }]}>{fmt$(calcMealCost)}</Text>
                    {usedIngCount > 0 && (
                      <Text style={[st.calcSub, { color: c.textMuted, fontFamily: MONO }]}>
                        ({usedIngCount} ingredient{usedIngCount > 1 ? 's' : ''})
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* ── Takeout ── */}
              {mType === 'takeout' && (
                <View>
                  <View style={st.formRow}>
                    <View style={{ flex: 1 }}>
                      <FLabel label="Total Cost ($)" c={c} />
                      <TextInput style={[st.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.amber, fontFamily: MONO }]}
                        value={mToCost} onChangeText={setMToCost} placeholder="0.00"
                        placeholderTextColor={c.textMuted} keyboardType="decimal-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FLabel label="Your Portions" c={c} />
                      <TextInput style={[st.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                        value={mToPortions} onChangeText={setMToPortions} placeholder="1"
                        placeholderTextColor={c.textMuted} keyboardType="decimal-pad" />
                    </View>
                    {parseFloat(mToCost) > 0 && (
                      <View style={[st.costPreview, { backgroundColor: c.amberGlow, borderColor: c.amber, alignSelf: 'flex-end', marginTop: 10 }]}>
                        <Text style={[st.costPreviewTxt, { color: c.amber, fontFamily: MONO }]}>{fmt$(toPreview)} / meal</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[st.hint, { color: c.textMuted, fontFamily: MONO }]}>
                    e.g. $9.11 pizza ÷ 4 slices = $2.28/meal. Enter portions YOU ate.
                  </Text>
                  <TouchableOpacity style={st.checkRow} onPress={() => setMToAddInv(v => !v)}>
                    <View style={[st.checkbox, {
                      borderColor:     mToAddInv ? c.green : c.borderSubtle,
                      backgroundColor: mToAddInv ? c.greenGlow : 'transparent',
                    }]}>
                      {mToAddInv && <Text style={{ color: c.green, fontSize: 10, fontWeight: '700' }}>✓</Text>}
                    </View>
                    <Text style={[st.checkLabel, { color: c.textSecondary, fontFamily: MONO }]}>
                      Add remaining portions to inventory
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <FLabel label="Notes (optional)" c={c} />
              <TextInput style={[st.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                value={mNotes} onChangeText={setMNotes} placeholder="Anything worth remembering..."
                placeholderTextColor={c.textMuted} />

              <TouchableOpacity style={[st.actionBtn, { backgroundColor: c.amberGlow, borderColor: c.amber }]} onPress={logMeal}>
                <Text style={[st.actionBtnTxt, { color: c.amber, fontFamily: MONO }]}>+ Log Meal</Text>
              </TouchableOpacity>
            </View>

            {showMDate && Platform.OS === 'android' && (
              <DateTimePicker value={mDate} mode="date" display="default"
                onChange={(e, d) => { setShowMDate(false); if (d) setMDate(d); }} />
            )}
            {showMDate && Platform.OS === 'ios' && (
              <>
                <DateTimePicker value={mDate} mode="date" display="spinner"
                  onChange={(e, d) => { if (d) setMDate(d); }} />
                <TouchableOpacity onPress={() => setShowMDate(false)} style={{ alignItems: 'flex-end', paddingRight: 4 }}>
                  <Text style={{ color: c.blue, fontWeight: '600', fontFamily: MONO }}>Done</Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={[st.secLabel, { color: c.textMuted, borderBottomColor: c.borderSubtle, fontFamily: MONO }]}>
              MEAL HISTORY ({meals.length})
            </Text>

            {meals.length === 0 ? (
              <View style={[st.emptyBox, { borderColor: c.borderSubtle }]}>
                <Text style={[st.emptyTxt, { color: c.textMuted, fontFamily: MONO }]}>No meals logged yet.</Text>
              </View>
            ) : (
              meals.map(meal => {
                const ingList   = meal.ingredients.map(i => `${i.qty}×${i.name}`).join(', ');
                const typeColor = meal.type === 'home' ? c.green : c.amber;
                const typeBg    = meal.type === 'home' ? c.greenGlow : c.amberGlow;
                return (
                  <View key={meal.id} style={[st.mealItem, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[st.mealName, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>{meal.name}</Text>
                      <Text style={[st.mealIngs, { color: c.textMuted, fontFamily: MONO }]} numberOfLines={2}>
                        {ingList}{meal.notes ? ` · ${meal.notes}` : ''}
                      </Text>
                    </View>
                    <View style={st.mealRight}>
                      <Text style={[st.mealCost, { color: typeColor, fontFamily: MONO }]}>{fmt$(meal.cost)}</Text>
                      <View style={[st.mealPill, { backgroundColor: typeBg, borderColor: typeColor }]}>
                        <Text style={[st.mealPillTxt, { color: typeColor, fontFamily: MONO }]}>
                          {meal.type === 'home' ? 'HOME' : 'TAKEOUT'}
                        </Text>
                      </View>
                      <Text style={[st.mealDate, { color: c.textMuted, fontFamily: MONO }]}>{fmtDate(meal.date)}</Text>
                      <TouchableOpacity onPress={() => deleteMeal(meal.id)}>
                        <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* STATS TAB                                                     */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'stats' && renderStats()}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { padding: 14, paddingBottom: 60 },
  savedBadge: { position: 'absolute', bottom: 16, right: 16, zIndex: 99, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  savedText:  { fontSize: 11, fontWeight: '600' },

  metRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },

  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  tabBtn: { flex: 1, borderWidth: 1.5, borderRadius: 20, paddingVertical: 7, alignItems: 'center' },
  tabTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  card:      { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 8 },
  cardTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  secLabel:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 14, marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1 },

  formRow:   { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  input:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, marginBottom: 2 },
  dateBtn:   { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  dateTxt:   { fontSize: 12 },
  typeBtn:   { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  typeTxt:   { fontSize: 10, fontWeight: '700' },

  costPreview:    { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6, marginBottom: 4 },
  costPreviewTxt: { fontSize: 11, fontWeight: '600' },

  actionBtn:    { borderWidth: 1, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 20, alignSelf: 'flex-end', marginTop: 12 },
  actionBtnTxt: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },

  // Inventory
  invGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  invCard:    { width: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 10, padding: 11, position: 'relative' },
  invDel:     { position: 'absolute', top: 8, right: 10, padding: 2 },
  invTag:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 5 },
  invTagTxt:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  invName:    { fontSize: 12, fontWeight: '600', marginBottom: 3, marginRight: 16 },
  invPrice:   { fontSize: 14, fontWeight: '700' },
  invPriceUnit: { fontSize: 10 },
  invMeta:    { fontSize: 10, marginTop: 2, lineHeight: 15 },
  stockTrack: { height: 4, borderRadius: 2, marginTop: 7, overflow: 'hidden' },
  stockFill:  { height: '100%', borderRadius: 2 },

  // Ingredient picker
  ingPicker: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8 },
  ingTitle:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  ingEmpty:  { fontSize: 12, fontStyle: 'italic', paddingVertical: 6 },
  ingRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1 },
  ingName:   { fontSize: 12, fontWeight: '600' },
  ingStock:  { fontSize: 10, marginTop: 1 },
  ingQty:    { width: 56, borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4, fontSize: 12, textAlign: 'right' },
  ingUnit:   { fontSize: 10, minWidth: 36 },
  ingCost:   { fontSize: 11, fontWeight: '600', minWidth: 46, textAlign: 'right' },
  calcRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, marginTop: 4, borderTopWidth: 1 },
  calcLabel: { fontSize: 11 },
  calcCost:  { fontSize: 18, fontWeight: '700' },
  calcSub:   { fontSize: 10 },

  // Takeout
  hint:       { fontSize: 10, lineHeight: 15, marginBottom: 8 },
  checkRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  checkbox:   { width: 18, height: 18, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { fontSize: 12 },

  // Meal history
  mealItem:   { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 5, gap: 10 },
  mealName:   { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  mealIngs:   { fontSize: 10, lineHeight: 15 },
  mealRight:  { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  mealCost:   { fontSize: 15, fontWeight: '700' },
  mealPill:   { borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  mealPillTxt:{ fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  mealDate:   { fontSize: 10 },

  // Stats
  savingsBanner: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  savingsTxt:    { fontSize: 12, fontWeight: '600' },
  cmpRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  cmpCard:       { flex: 1, minWidth: '44%', borderWidth: 1, borderRadius: 8, padding: 11, alignItems: 'center' },
  cmpLabel:      { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  cmpVal:        { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  cmpSub:        { fontSize: 9, marginTop: 2 },
  barRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 },
  barLabel:      { width: 110, fontSize: 11 },
  barTrack:      { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill:       { height: '100%', borderRadius: 3 },
  barVal:        { width: 52, textAlign: 'right', fontSize: 11, fontWeight: '600' },
  rankRow:       { flexDirection: 'row', gap: 8 },
  rankCard:      { flex: 1 },
  rankItem:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1 },
  rankName:      { flex: 1, fontSize: 12, marginRight: 6 },
  rankCost:      { fontSize: 12, fontWeight: '700' },

  emptyBox: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 24, alignItems: 'center', marginBottom: 8 },
  emptyTxt: { fontSize: 12 },
});
