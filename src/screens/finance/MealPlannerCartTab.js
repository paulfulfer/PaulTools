import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Modal, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const MONO = 'Inter_500Medium';
const fmt$ = n => '$' + (parseFloat(n) || 0).toFixed(2);

function cpu(ing) {
  const p = parseFloat(ing.purchasePrice) || 0;
  const y = parseFloat(ing.purchaseYield) || 1;
  return p / y;
}

function mealCostPerServing(meal, ings) {
  return meal.ingredients.reduce((sum, mi) => {
    const ing = ings.find(x => x.id === mi.ingredientId);
    return sum + (parseFloat(mi.unitsPerMeal) || 0) * (ing ? cpu(ing) : 0);
  }, 0);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MealPlannerCartTab({ user, c, onLogToInventory, onSaved }) {
  // ── Local cart state ───────────────────────────────────────────────────────
  const [ingredients,   setIngredients]   = useState([]); // CartIngredient[]
  const [meals,         setMeals]         = useState([]); // Meal[]
  const [cartName,      setCartName]      = useState('');

  // ── Saved data ─────────────────────────────────────────────────────────────
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [savedCarts,     setSavedCarts]     = useState([]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [addMealMode,         setAddMealMode]         = useState(null); // null | 'pick' | 'templates'
  const [ingPickerMealId,     setIngPickerMealId]     = useState(null);
  const [newIngName,          setNewIngName]           = useState('');
  const [editingIngId,        setEditingIngId]         = useState(null);
  const [savedCartsCollapsed, setSavedCartsCollapsed] = useState(true);
  const [expandedCartId,      setExpandedCartId]       = useState(null);
  const [logModalVisible,     setLogModalVisible]     = useState(false);
  const [logChecked,          setLogChecked]           = useState({});
  const [logExtraItems,       setLogExtraItems]        = useState([]);
  const [saving,              setSaving]               = useState(false);

  const idCounter    = useRef(1);
  const ingsRef      = useRef(ingredients);
  const mealsRef     = useRef(meals);
  const userRef      = useRef(user);
  const shopItemRefs = useRef({}); // web: keyed by ing.id → DOM node for activeElement guard
  useEffect(() => { ingsRef.current  = ingredients; }, [ingredients]);
  useEffect(() => { mealsRef.current = meals;        }, [meals]);
  useEffect(() => { userRef.current  = user;         }, [user]);

  const uid$ = () => userRef.current?.uid;
  const nid  = ()  => String(idCounter.current++);

  // ── Load saved data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const db  = firebase.firestore();
    const uid = user.uid;
    Promise.all([
      db.collection('users').doc(uid).collection('savedMeals').orderBy('createdAt', 'desc').get(),
      db.collection('users').doc(uid).collection('savedCarts').orderBy('createdAt', 'desc').get(),
    ]).then(([tmplSnap, cartsSnap]) => {
      setSavedTemplates(tmplSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSavedCarts(cartsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => {}); // non-fatal
  }, [user]);

  // ── Ingredient operations ──────────────────────────────────────────────────
  const addIngredient = (initialName = '') => {
    const id  = nid();
    const ing = { id, name: initialName, purchasePrice: '', purchaseYield: '', unitLabel: 'serving' };
    setIngredients(prev => [...prev, ing]);
    return id;
  };

  // useCallback so the function reference is stable — prevents the shopping list
  // from re-rendering the parent on every keystroke, which on web was causing
  // spurious blur/press events that collapsed the expanded row.
  const updateIng = useCallback((id, field, value) =>
    setIngredients(prev => prev.map(x => x.id !== id ? x : { ...x, [field]: value }))
  , []);

  const removeIng = (id) => {
    setIngredients(prev => prev.filter(x => x.id !== id));
    setMeals(prev => prev.map(m => ({
      ...m, ingredients: m.ingredients.filter(mi => mi.ingredientId !== id),
    })));
    if (editingIngId === id) setEditingIngId(null);
  };

  // ── Meal operations ────────────────────────────────────────────────────────
  const addNewMeal = () => {
    setMeals(prev => [...prev, { id: nid(), name: '', servingsPlanned: '1', ingredients: [] }]);
    setAddMealMode(null);
  };

  const removeMeal = id => setMeals(prev => prev.filter(m => m.id !== id));

  const updateMeal = (id, field, value) =>
    setMeals(prev => prev.map(m => m.id !== id ? m : { ...m, [field]: value }));

  const addIngToMeal = (mealId, ingId) =>
    setMeals(prev => prev.map(m => {
      if (m.id !== mealId || m.ingredients.some(mi => mi.ingredientId === ingId)) return m;
      return { ...m, ingredients: [...m.ingredients, { ingredientId: ingId, unitsPerMeal: '1' }] };
    }));

  const updateMealIng = (mealId, ingId, field, value) =>
    setMeals(prev => prev.map(m =>
      m.id !== mealId ? m : {
        ...m,
        ingredients: m.ingredients.map(mi =>
          mi.ingredientId !== ingId ? mi : { ...mi, [field]: value }
        ),
      }
    ));

  const removeMealIng = (mealId, ingId) =>
    setMeals(prev => prev.map(m =>
      m.id !== mealId ? m :
      { ...m, ingredients: m.ingredients.filter(mi => mi.ingredientId !== ingId) }
    ));

  // When user types a new ingredient name in the meal picker, add it to shopping
  // list if it's new, then attach it to the meal.
  const handleAddNewIngToMeal = (mealId) => {
    const name = newIngName.trim();
    if (!name) return;
    const existing = ingsRef.current.find(x => x.name.toLowerCase() === name.toLowerCase());
    const ingId    = existing ? existing.id : addIngredient(name);
    addIngToMeal(mealId, ingId);
    setNewIngName('');
    setIngPickerMealId(null);
    if (!existing) setEditingIngId(ingId); // open shopping row for price entry
  };

  // ── Meal template operations ───────────────────────────────────────────────
  const saveMealTemplate = (meal) => {
    if (!meal.name.trim()) return Alert.alert('Required', 'Give the meal a name before saving.');
    const existing = savedTemplates.find(t => t.name.toLowerCase() === meal.name.trim().toLowerCase());
    if (existing) {
      Alert.alert('Update or Save New?', `"${meal.name}" already exists as a saved meal.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Update',      onPress: () => doSaveTemplate(meal, existing.id) },
        { text: 'Save as New', onPress: () => doSaveTemplate(meal, null) },
      ]);
    } else {
      doSaveTemplate(meal, null);
    }
  };

  const doSaveTemplate = async (meal, existingId) => {
    const uid = uid$();
    if (!uid) return;
    const templateIngs = meal.ingredients
      .map(mi => {
        const ing = ingsRef.current.find(x => x.id === mi.ingredientId);
        return ing ? { name: ing.name, unitsPerMeal: mi.unitsPerMeal, unitLabel: ing.unitLabel } : null;
      })
      .filter(Boolean);

    const data = {
      name:        meal.name.trim(),
      ingredients: templateIngs,
      createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    };
    try {
      const db = firebase.firestore();
      if (existingId) {
        await db.collection('users').doc(uid).collection('savedMeals').doc(existingId).set(data);
        setSavedTemplates(prev => prev.map(t => t.id === existingId ? { id: existingId, ...data } : t));
      } else {
        const ref = await db.collection('users').doc(uid).collection('savedMeals').add(data);
        setSavedTemplates(prev => [{ id: ref.id, ...data, createdAt: new Date() }, ...prev]);
      }
      onSaved?.();
    } catch (err) { Alert.alert('Save error', err.message); }
  };

  const loadTemplate = (template) => {
    setAddMealMode(null);
    const mealId    = nid();
    const updatedIngs = [...ingsRef.current];
    const mealIngRefs = [];

    for (const ti of (template.ingredients || [])) {
      const existing = updatedIngs.find(x => x.name.toLowerCase() === ti.name.toLowerCase());
      if (existing) {
        mealIngRefs.push({ ingredientId: existing.id, unitsPerMeal: String(ti.unitsPerMeal || 1) });
      } else {
        const id = nid();
        updatedIngs.push({ id, name: ti.name, purchasePrice: '', purchaseYield: '', unitLabel: ti.unitLabel || 'serving' });
        mealIngRefs.push({ ingredientId: id, unitsPerMeal: String(ti.unitsPerMeal || 1) });
      }
    }
    setIngredients(updatedIngs);
    setMeals(prev => [...prev, { id: mealId, name: template.name, servingsPlanned: '1', ingredients: mealIngRefs }]);
  };

  // ── Cart save / load ───────────────────────────────────────────────────────
  const saveCart = async () => {
    const uid  = uid$();
    const name = cartName.trim();
    if (!name) return Alert.alert('Required', 'Enter a cart name.');
    if (!uid)  return;
    const total = ingsRef.current.reduce((s, x) => s + (parseFloat(x.purchasePrice) || 0), 0);
    const data  = {
      name,
      meals:       mealsRef.current,
      ingredients: ingsRef.current,
      totalCost:   total,
      createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    };
    setSaving(true);
    try {
      const ref = await firebase.firestore().collection('users').doc(uid).collection('savedCarts').add(data);
      setSavedCarts(prev => [{ id: ref.id, ...data, createdAt: new Date() }, ...prev]);
      setCartName('');
      onSaved?.();
    } catch (err) { Alert.alert('Save error', err.message); }
    finally { setSaving(false); }
  };

  const loadCart = (cart) => {
    Alert.alert('Load Cart', 'Replace current cart with this saved cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Load', onPress: () => {
        setIngredients(cart.ingredients || []);
        setMeals(cart.meals || []);
        setCartName(cart.name || '');
        setIngPickerMealId(null);
        setEditingIngId(null);
      }},
    ]);
  };

  const deleteCart = (cartId) => {
    Alert.alert('Delete cart?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const uid = uid$();
        if (!uid) return;
        try {
          await firebase.firestore().collection('users').doc(uid).collection('savedCarts').doc(cartId).delete();
          setSavedCarts(prev => prev.filter(c => c.id !== cartId));
          if (expandedCartId === cartId) setExpandedCartId(null);
        } catch (err) { Alert.alert('Delete error', err.message); }
      }},
    ]);
  };

  // ── Log Cart ───────────────────────────────────────────────────────────────
  const openLogModal = () => {
    const checked = {};
    ingsRef.current.forEach(x => { checked[x.id] = true; });
    setLogChecked(checked);
    setLogExtraItems([]);
    setLogModalVisible(true);
  };

  const confirmLog = async () => {
    const checkedItems = Object.entries(logChecked)
      .filter(([, v]) => v)
      .map(([id]) => ingsRef.current.find(x => x.id === id))
      .filter(x => x && parseFloat(x.purchasePrice) > 0 && parseFloat(x.purchaseYield) > 0)
      .map(x => ({
        name: x.name, purchasePrice: parseFloat(x.purchasePrice),
        purchaseYield: parseFloat(x.purchaseYield), unitLabel: x.unitLabel || 'serving',
        costPerUnit: cpu(x), type: 'grocery',
      }));

    const extras = logExtraItems
      .filter(x => x.name?.trim() && parseFloat(x.purchasePrice) > 0 && parseFloat(x.purchaseYield) > 0)
      .map(x => ({
        name: x.name.trim(), purchasePrice: parseFloat(x.purchasePrice),
        purchaseYield: parseFloat(x.purchaseYield), unitLabel: x.unitLabel || 'serving',
        costPerUnit: (parseFloat(x.purchasePrice) || 0) / (parseFloat(x.purchaseYield) || 1),
        type: 'grocery',
      }));

    const all = [...checkedItems, ...extras];
    if (all.length === 0) return Alert.alert('Nothing to log', 'Check at least one item with price and yield.');

    setLogModalVisible(false);
    await onLogToInventory(all);

    Alert.alert('Cart Logged', 'Items added to inventory. Clear the cart?', [
      { text: 'Keep Cart', style: 'cancel' },
      { text: 'Clear Cart', onPress: () => { setMeals([]); setIngredients([]); setCartName(''); } },
    ]);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const cartTotal       = ingredients.reduce((s, x) => s + (parseFloat(x.purchasePrice) || 0), 0);
  const totalMealsCost  = meals.reduce((s, m) => s + mealCostPerServing(m, ingredients) * (parseFloat(m.servingsPlanned) || 1), 0);
  const totalServings   = meals.reduce((s, m) => s + (parseFloat(m.servingsPlanned) || 1), 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — MEAL PLANNER                                        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: c.textMuted }]}>MEAL PLANNER</Text>
        <TouchableOpacity onPress={() => setAddMealMode('pick')}
          style={[s.addBtn, { borderColor: c.amber, backgroundColor: c.amberGlow }]}>
          <Text style={[s.addBtnTxt, { color: c.amber }]}>+ ADD MEAL</Text>
        </TouchableOpacity>
      </View>

      {meals.length === 0 ? (
        <View style={[s.emptyBox, { borderColor: c.borderSubtle }]}>
          <Text style={[s.emptyTxt, { color: c.textMuted }]}>No meals planned yet — tap + Add Meal to start.</Text>
        </View>
      ) : (
        meals.map(meal => {
          const cpm      = mealCostPerServing(meal, ingredients);
          const servings = parseFloat(meal.servingsPlanned) || 1;
          const totalCost = cpm * servings;
          return (
            <View key={meal.id} style={[s.mealCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
              {/* Header row */}
              <View style={s.mealCardHeader}>
                <TextInput
                  style={[s.mealNameInput, { color: c.textPrimary, borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                  value={meal.name}
                  onChangeText={v => updateMeal(meal.id, 'name', v)}
                  placeholder="Meal name..."
                  placeholderTextColor={c.textMuted}
                />
                <TouchableOpacity onPress={() => saveMealTemplate(meal)} style={s.iconBtn}>
                  <Text style={{ fontSize: 17 }}>🔖</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeMeal(meal.id)} style={s.iconBtn}>
                  <Text style={{ color: c.textMuted, fontSize: 16, fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Servings */}
              <View style={[s.row, { marginBottom: 10 }]}>
                <Text style={[s.fieldLabel, { color: c.textMuted, flex: 1 }]}>SERVINGS PLANNED</Text>
                <TextInput
                  style={[s.servingsInput, { color: c.textPrimary, borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                  value={String(meal.servingsPlanned)}
                  onChangeText={v => updateMeal(meal.id, 'servingsPlanned', v)}
                  keyboardType="numeric"
                  placeholderTextColor={c.textMuted}
                />
              </View>

              {/* Ingredient rows */}
              {meal.ingredients.map(mi => {
                const ing     = ingredients.find(x => x.id === mi.ingredientId);
                if (!ing) return null;
                const ingCpu  = cpu(ing);
                const rowCost = (parseFloat(mi.unitsPerMeal) || 0) * ingCpu;
                return (
                  <View key={mi.ingredientId} style={[s.ingRow, { borderBottomColor: c.borderSubtle }]}>
                    <Text style={[s.ingName, { color: c.textPrimary }]} numberOfLines={1}>{ing.name || '—'}</Text>
                    <TextInput
                      style={[s.unitsInput, { color: c.textPrimary, borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                      value={String(mi.unitsPerMeal)}
                      onChangeText={v => updateMealIng(meal.id, mi.ingredientId, 'unitsPerMeal', v)}
                      keyboardType="decimal-pad"
                      placeholder="1"
                      placeholderTextColor={c.textMuted}
                    />
                    <Text style={[s.ingUnit, { color: c.textMuted }]}>{ing.unitLabel}</Text>
                    <Text style={[s.ingCostCol, { color: rowCost > 0 ? c.green : ingCpu > 0 ? c.textMuted : c.textMuted }]}>
                      {rowCost > 0 ? fmt$(rowCost) : ingCpu > 0 ? fmt$(ingCpu) + '/u' : '—'}
                    </Text>
                    <TouchableOpacity onPress={() => removeMealIng(meal.id, mi.ingredientId)}>
                      <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Ingredient picker */}
              {ingPickerMealId === meal.id ? (
                <View style={[s.ingPicker, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]}>
                  <Text style={[s.fieldLabel, { color: c.textMuted, marginBottom: 8 }]}>SELECT OR ADD INGREDIENT</Text>
                  {ingredients
                    .filter(x => !meal.ingredients.some(mi => mi.ingredientId === x.id))
                    .map(ing => (
                      <TouchableOpacity key={ing.id}
                        style={[s.pickerRow, { borderBottomColor: c.borderSubtle }]}
                        onPress={() => { addIngToMeal(meal.id, ing.id); setIngPickerMealId(null); }}>
                        <Text style={[s.ingName, { color: c.textPrimary }]} numberOfLines={1}>{ing.name || '—'}</Text>
                        <Text style={[s.ingUnit, { color: c.textMuted }]}>
                          {ing.unitLabel}{cpu(ing) > 0 ? ' · ' + fmt$(cpu(ing)) + '/unit' : ''}
                        </Text>
                      </TouchableOpacity>
                    ))
                  }
                  <View style={[s.row, { gap: 6, marginTop: 8 }]}>
                    <TextInput
                      style={[s.ingNameInput, { flex: 1, color: c.textPrimary, borderColor: c.borderSubtle, backgroundColor: c.bgCard }]}
                      value={newIngName}
                      onChangeText={setNewIngName}
                      placeholder="New ingredient name..."
                      placeholderTextColor={c.textMuted}
                    />
                    <TouchableOpacity
                      style={[s.addBtn, { borderColor: c.blue, backgroundColor: c.blueGlow }]}
                      onPress={() => handleAddNewIngToMeal(meal.id)}>
                      <Text style={[s.addBtnTxt, { color: c.blue }]}>+ ADD</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => setIngPickerMealId(null)} style={{ alignItems: 'center', marginTop: 8 }}>
                    <Text style={[s.fieldLabel, { color: c.textMuted }]}>CANCEL</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.addIngBtn, { borderColor: c.borderSubtle }]}
                  onPress={() => { setIngPickerMealId(meal.id); setNewIngName(''); }}>
                  <Text style={[s.fieldLabel, { color: c.textMuted }]}>+ ADD INGREDIENT</Text>
                </TouchableOpacity>
              )}

              {/* Cost summary line */}
              <View style={[s.mealSummary, { borderTopColor: c.borderSubtle, backgroundColor: c.bgBase }]}>
                <Text style={[s.mealSummaryTxt, { color: c.textMuted }]}>
                  {servings} serving{servings !== 1 ? 's' : ''}
                  {cpm > 0 ? `  ·  ${fmt$(cpm)} / meal  ·  ${fmt$(totalCost)} total` : ''}
                </Text>
              </View>
            </View>
          );
        })
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — SHOPPING LIST                                       */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <View style={[s.sectionHeader, { marginTop: 18 }]}>
        <Text style={[s.sectionTitle, { color: c.textMuted }]}>SHOPPING LIST</Text>
        {cartTotal > 0 && (
          <Text style={[s.cartTotalLabel, { color: c.green }]}>{fmt$(cartTotal)} total</Text>
        )}
        <TouchableOpacity onPress={() => { const id = addIngredient(''); setEditingIngId(id); }}
          style={[s.addBtn, { borderColor: c.green, backgroundColor: c.greenGlow, marginLeft: 8 }]}>
          <Text style={[s.addBtnTxt, { color: c.green }]}>+ ADD ITEM</Text>
        </TouchableOpacity>
      </View>

      {ingredients.length === 0 ? (
        <View style={[s.emptyBox, { borderColor: c.borderSubtle }]}>
          <Text style={[s.emptyTxt, { color: c.textMuted }]}>No items in shopping list yet.</Text>
        </View>
      ) : (
        ingredients.map(ing => {
          const ingCpu   = cpu(ing);
          const expanded = editingIngId === ing.id;

          // On web, only collapse if focus has genuinely left the container.
          // Typing in a field causes re-renders that on web can trigger onPress
          // on a TouchableOpacity parent — this guard prevents that.
          const handleHeaderPress = () => {
            if (Platform.OS === 'web' && expanded) {
              const el = shopItemRefs.current[ing.id];
              if (el?.contains?.(document.activeElement)) return;
            }
            setEditingIngId(expanded ? null : ing.id);
          };

          return (
            // Outer wrapper is a plain View — NOT TouchableOpacity.
            // Only the summary header row is tappable. This prevents typing
            // in the edit fields from bubbling a press event that closes the row.
            <View
              key={ing.id}
              ref={el => { shopItemRefs.current[ing.id] = el; }}
              style={[s.shopItem, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}
            >
              {/* Tappable summary header */}
              <TouchableOpacity activeOpacity={0.75} onPress={handleHeaderPress}>
                <View style={s.shopItemHeader}>
                  <Text style={[s.shopName, { color: ing.name ? c.textPrimary : c.textMuted }]} numberOfLines={1}>
                    {ing.name || 'Tap to edit'}
                  </Text>
                  {ingCpu > 0 && (
                    <Text style={[s.shopCpu, { color: c.textMuted }]}>{fmt$(ingCpu)}/{ing.unitLabel || 'unit'}</Text>
                  )}
                  <Text style={[s.shopPrice, { color: parseFloat(ing.purchasePrice) > 0 ? c.amber : c.textMuted }]}>
                    {parseFloat(ing.purchasePrice) > 0 ? fmt$(ing.purchasePrice) : '—'}
                  </Text>
                  <TouchableOpacity onPress={() => removeIng(ing.id)} style={{ padding: 4 }}>
                    <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              {/* Edit fields live outside the TouchableOpacity — no event bubbling */}
              {expanded && (
                <View style={s.shopEditGrid}>
                  <View style={{ flex: 2 }}>
                    <Text style={[s.fieldLabel, { color: c.textMuted }]}>NAME</Text>
                    <TextInput
                      style={[s.input, { color: c.textPrimary, borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                      value={ing.name}
                      onChangeText={v => updateIng(ing.id, 'name', v)}
                      placeholder="Item name"
                      placeholderTextColor={c.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: c.textMuted }]}>PRICE ($)</Text>
                    <TextInput
                      style={[s.input, { color: c.amber, borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                      value={String(ing.purchasePrice)}
                      onChangeText={v => updateIng(ing.id, 'purchasePrice', v)}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={c.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: c.textMuted }]}>YIELD</Text>
                    <TextInput
                      style={[s.input, { color: c.textPrimary, borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                      value={String(ing.purchaseYield)}
                      onChangeText={v => updateIng(ing.id, 'purchaseYield', v)}
                      keyboardType="decimal-pad"
                      placeholder="1"
                      placeholderTextColor={c.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: c.textMuted }]}>UNIT</Text>
                    <TextInput
                      style={[s.input, { color: c.textPrimary, borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                      value={ing.unitLabel}
                      onChangeText={v => updateIng(ing.id, 'unitLabel', v)}
                      placeholder="slices"
                      placeholderTextColor={c.textMuted}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* MEAL SUMMARY FOOTER                                             */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {(meals.length > 0 || ingredients.length > 0) && (
        <View style={[s.summaryCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
          <Text style={[s.sectionTitle, { color: c.textMuted, marginBottom: 10 }]}>CART SUMMARY</Text>

          {meals.map(m => {
            const cpm      = mealCostPerServing(m, ingredients);
            const servings = parseFloat(m.servingsPlanned) || 1;
            return (
              <View key={m.id} style={s.summaryRow}>
                <Text style={[s.summaryName, { color: c.textPrimary }]} numberOfLines={1}>
                  {m.name || 'Untitled meal'} ×{servings}
                </Text>
                <Text style={[s.summaryCost, { color: cpm > 0 ? c.amber : c.textMuted }]}>
                  {cpm > 0 ? fmt$(cpm * servings) : '—'}
                </Text>
              </View>
            );
          })}

          {meals.length > 0 && (
            <View style={[s.summaryRow, s.summaryDivider, { borderTopColor: c.borderSubtle }]}>
              <Text style={[s.summaryName, { color: c.textMuted, fontWeight: '700' }]}>
                {totalServings} total serving{totalServings !== 1 ? 's' : ''}
              </Text>
              <Text style={[s.summaryCost, { color: c.amber, fontSize: 15, fontWeight: '700' }]}>
                {fmt$(totalMealsCost)}
              </Text>
            </View>
          )}
          {ingredients.length > 0 && (
            <View style={s.summaryRow}>
              <Text style={[s.summaryName, { color: c.textMuted }]}>Shopping list total</Text>
              <Text style={[s.summaryCost, { color: c.green, fontSize: 15, fontWeight: '700' }]}>
                {fmt$(cartTotal)}
              </Text>
            </View>
          )}

          {/* Save Cart row */}
          <View style={[s.row, { gap: 8, marginTop: 14 }]}>
            <TextInput
              style={[s.input, { flex: 1, color: c.textPrimary, borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
              value={cartName}
              onChangeText={setCartName}
              placeholder="Cart name to save..."
              placeholderTextColor={c.textMuted}
            />
            <TouchableOpacity
              style={[s.actionBtn, { borderColor: c.blue, backgroundColor: c.blueGlow }]}
              onPress={saveCart}
              disabled={saving}>
              {saving
                ? <ActivityIndicator color={c.blue} size="small" />
                : <Text style={[s.actionBtnTxt, { color: c.blue }]}>Save Cart</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Log Cart button */}
          <TouchableOpacity
            style={[s.logBtn, { borderColor: c.amber, backgroundColor: c.amberGlow }]}
            onPress={openLogModal}>
            <Text style={[s.logBtnTxt, { color: c.amber }]}>Log Cart → Inventory</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SAVED CARTS                                                     */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <TouchableOpacity
        onPress={() => setSavedCartsCollapsed(p => !p)}
        style={[s.secLabelRow, { borderBottomColor: c.borderSubtle }]}>
        <Text style={[s.sectionTitle, { color: c.textMuted }]}>
          SAVED CARTS ({savedCarts.length})
        </Text>
        <Text style={{ color: c.textMuted, fontSize: 16 }}>{savedCartsCollapsed ? '▾' : '▴'}</Text>
      </TouchableOpacity>

      {!savedCartsCollapsed && (
        savedCarts.length === 0 ? (
          <View style={[s.emptyBox, { borderColor: c.borderSubtle }]}>
            <Text style={[s.emptyTxt, { color: c.textMuted }]}>No saved carts yet.</Text>
          </View>
        ) : (
          savedCarts.map(cart => (
            <View key={cart.id} style={[s.savedCartCard, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
              <TouchableOpacity
                onPress={() => setExpandedCartId(expandedCartId === cart.id ? null : cart.id)}
                style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.savedCartName, { color: c.textPrimary }]}>{cart.name}</Text>
                  <Text style={[s.savedCartMeta, { color: c.textMuted }]}>
                    {(cart.meals || []).length} meal{(cart.meals || []).length !== 1 ? 's' : ''}
                    {' · '}
                    {(cart.ingredients || []).length} item{(cart.ingredients || []).length !== 1 ? 's' : ''}
                    {' · '}
                    {fmt$(cart.totalCost || 0)}
                  </Text>
                </View>
                <Text style={{ color: c.textMuted, fontSize: 14 }}>
                  {expandedCartId === cart.id ? '▴' : '▾'}
                </Text>
              </TouchableOpacity>

              {expandedCartId === cart.id && (
                <>
                  {(cart.meals || []).map((m, i) => (
                    <Text key={i} style={[s.savedCartItem, { color: c.textSecondary }]}>
                      · {m.name || 'Untitled'} ×{m.servingsPlanned || 1}
                    </Text>
                  ))}
                  {(cart.ingredients || []).slice(0, 5).map((ing, i) => (
                    <Text key={i} style={[s.savedCartItem, { color: c.textMuted }]}>
                      · {ing.name}  {parseFloat(ing.purchasePrice) > 0 ? fmt$(ing.purchasePrice) : ''}
                    </Text>
                  ))}
                  {(cart.ingredients || []).length > 5 && (
                    <Text style={[s.savedCartItem, { color: c.textMuted }]}>
                      + {cart.ingredients.length - 5} more items...
                    </Text>
                  )}
                  <View style={[s.row, { gap: 8, marginTop: 10 }]}>
                    <TouchableOpacity onPress={() => loadCart(cart)}
                      style={[s.cartActionBtn, { borderColor: c.blue, backgroundColor: c.blueGlow }]}>
                      <Text style={{ color: c.blue, fontSize: 11, fontWeight: '700', fontFamily: MONO }}>LOAD</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteCart(cart.id)}
                      style={[s.cartActionBtn, { borderColor: c.red }]}>
                      <Text style={{ color: c.red, fontSize: 11, fontWeight: '700', fontFamily: MONO }}>DELETE</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ))
        )
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ADD MEAL MODAL                                                  */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Modal visible={addMealMode !== null} transparent animationType="fade"
        onRequestClose={() => setAddMealMode(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}>
            {addMealMode === 'pick' && (
              <>
                <Text style={[s.modalTitle, { color: c.textPrimary }]}>Add Meal</Text>
                <TouchableOpacity style={[s.modalOption, { borderColor: c.amber, backgroundColor: c.amberGlow }]}
                  onPress={addNewMeal}>
                  <Text style={[s.modalOptionTxt, { color: c.amber }]}>🍽  Build new meal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalOption, { borderColor: c.blue, backgroundColor: c.blueGlow }]}
                  onPress={() => setAddMealMode('templates')}>
                  <Text style={[s.modalOptionTxt, { color: c.blue }]}>🔖  Load saved meal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAddMealMode(null)} style={{ alignItems: 'center', marginTop: 12 }}>
                  <Text style={[s.fieldLabel, { color: c.textMuted }]}>CANCEL</Text>
                </TouchableOpacity>
              </>
            )}
            {addMealMode === 'templates' && (
              <>
                <Text style={[s.modalTitle, { color: c.textPrimary }]}>Saved Meals</Text>
                {savedTemplates.length === 0 ? (
                  <Text style={{ color: c.textMuted, fontFamily: MONO, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
                    No saved meals yet.{'\n'}Build a meal and tap 🔖 to save it as a template.
                  </Text>
                ) : (
                  savedTemplates.map(t => (
                    <TouchableOpacity key={t.id}
                      style={[s.modalOption, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}
                      onPress={() => loadTemplate(t)}>
                      <Text style={[s.modalOptionTxt, { color: c.textPrimary }]}>{t.name}</Text>
                      <Text style={{ color: c.textMuted, fontSize: 10, fontFamily: MONO, marginTop: 2 }}>
                        {(t.ingredients || []).length} ingredient{(t.ingredients || []).length !== 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity onPress={() => setAddMealMode('pick')} style={{ alignItems: 'center', marginTop: 10 }}>
                  <Text style={[s.fieldLabel, { color: c.textMuted }]}>← BACK</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* LOG CART MODAL                                                  */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Modal visible={logModalVisible} animationType="slide"
        onRequestClose={() => setLogModalVisible(false)}>
        <View style={[s.logModalContainer, { backgroundColor: c.bgBase }]}>
          {/* Header */}
          <View style={[s.logModalHeader, { borderBottomColor: c.borderSubtle, backgroundColor: c.bgCard }]}>
            <Text style={[s.logModalTitle, { color: c.textPrimary }]}>Review & Log Purchase</Text>
            <TouchableOpacity onPress={() => setLogModalVisible(false)}>
              <Text style={{ color: c.textMuted, fontSize: 20, lineHeight: 24 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled">
            <Text style={[s.fieldLabel, { color: c.textMuted, marginBottom: 10 }]}>
              CHECK ITEMS TO LOG TO INVENTORY
            </Text>

            {ingredients.map(ing => (
              <TouchableOpacity key={ing.id}
                style={[s.logRow, { borderBottomColor: c.borderSubtle }]}
                onPress={() => setLogChecked(p => ({ ...p, [ing.id]: !p[ing.id] }))}>
                <View style={[s.checkbox, {
                  borderColor:     logChecked[ing.id] ? c.green : c.borderSubtle,
                  backgroundColor: logChecked[ing.id] ? c.greenGlow : 'transparent',
                }]}>
                  {logChecked[ing.id] && <Text style={{ color: c.green, fontSize: 10, fontWeight: '700' }}>✓</Text>}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.shopName, { color: c.textPrimary }]} numberOfLines={1}>{ing.name}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 10, fontFamily: MONO }}>
                    {ing.purchaseYield} {ing.unitLabel}
                    {cpu(ing) > 0 ? '  ·  ' + fmt$(cpu(ing)) + '/unit' : ''}
                  </Text>
                </View>
                <Text style={{ color: c.amber, fontWeight: '700', fontSize: 13, fontFamily: MONO }}>
                  {parseFloat(ing.purchasePrice) > 0 ? fmt$(ing.purchasePrice) : '—'}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Extra items not in the cart */}
            {logExtraItems.map((item, i) => (
              <View key={i} style={[s.row, { gap: 5, paddingVertical: 6, borderBottomColor: c.borderSubtle, borderBottomWidth: 1 }]}>
                <TextInput style={[s.input, { flex: 2, color: c.textPrimary, borderColor: c.borderSubtle, backgroundColor: c.bgCard }]}
                  value={item.name} placeholder="Name" placeholderTextColor={c.textMuted}
                  onChangeText={v => setLogExtraItems(p => p.map((x, j) => j !== i ? x : { ...x, name: v }))} />
                <TextInput style={[s.input, { flex: 1, color: c.amber, borderColor: c.borderSubtle, backgroundColor: c.bgCard }]}
                  value={String(item.purchasePrice || '')} placeholder="$" keyboardType="decimal-pad" placeholderTextColor={c.textMuted}
                  onChangeText={v => setLogExtraItems(p => p.map((x, j) => j !== i ? x : { ...x, purchasePrice: v }))} />
                <TextInput style={[s.input, { flex: 1, color: c.textPrimary, borderColor: c.borderSubtle, backgroundColor: c.bgCard }]}
                  value={String(item.purchaseYield || '')} placeholder="qty" keyboardType="decimal-pad" placeholderTextColor={c.textMuted}
                  onChangeText={v => setLogExtraItems(p => p.map((x, j) => j !== i ? x : { ...x, purchaseYield: v }))} />
                <TextInput style={[s.input, { flex: 1, color: c.textPrimary, borderColor: c.borderSubtle, backgroundColor: c.bgCard }]}
                  value={item.unitLabel || ''} placeholder="unit" placeholderTextColor={c.textMuted}
                  onChangeText={v => setLogExtraItems(p => p.map((x, j) => j !== i ? x : { ...x, unitLabel: v }))} />
              </View>
            ))}

            <TouchableOpacity
              style={[s.addIngBtn, { borderColor: c.borderSubtle, marginTop: 8 }]}
              onPress={() => setLogExtraItems(p => [...p, { name: '', purchasePrice: '', purchaseYield: '', unitLabel: 'serving' }])}>
              <Text style={[s.fieldLabel, { color: c.textMuted }]}>+ ADD ITEM</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Confirm button — absolutely positioned so it's always visible */}
          <View style={[s.logModalFooter, { borderTopColor: c.borderSubtle, backgroundColor: c.bgCard }]}>
            <TouchableOpacity
              style={[s.logBtn, { borderColor: c.green, backgroundColor: c.greenGlow }]}
              onPress={confirmLog}>
              <Text style={[s.logBtnTxt, { color: c.green }]}>Confirm & Log to Inventory</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Layout
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle:  { flex: 1, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, fontFamily: MONO },
  row:           { flexDirection: 'row', alignItems: 'center' },
  fieldLabel:    { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, fontFamily: MONO },
  input:         { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, fontFamily: MONO },
  addBtn:        { borderWidth: 1.5, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  addBtnTxt:     { fontSize: 10, fontWeight: '700', fontFamily: MONO },
  emptyBox:      { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 20, alignItems: 'center', marginBottom: 8 },
  emptyTxt:      { fontSize: 12, fontFamily: MONO, textAlign: 'center' },

  // Meal card
  mealCard:       { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  mealCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  mealNameInput:  { flex: 1, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, fontWeight: '600', fontFamily: MONO },
  iconBtn:        { padding: 4 },
  servingsInput:  { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, width: 56, textAlign: 'center', fontFamily: MONO, marginLeft: 8 },
  ingRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, borderBottomWidth: 1 },
  ingName:        { flex: 1, fontSize: 12, fontWeight: '600', fontFamily: MONO },
  unitsInput:     { width: 48, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, fontSize: 12, textAlign: 'center', fontFamily: MONO },
  ingUnit:        { fontSize: 10, minWidth: 40, fontFamily: MONO },
  ingCostCol:     { fontSize: 11, fontWeight: '600', minWidth: 50, textAlign: 'right', fontFamily: MONO },
  addIngBtn:      { borderWidth: 1, borderRadius: 6, paddingVertical: 8, alignItems: 'center', marginTop: 8, borderStyle: 'dashed' },
  mealSummary:    { borderTopWidth: 1, marginTop: 10, paddingTop: 8, paddingHorizontal: 6, borderRadius: 6 },
  mealSummaryTxt: { fontSize: 11, fontFamily: MONO },
  ingPicker:      { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 8 },
  ingNameInput:   { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, fontFamily: MONO },
  pickerRow:      { paddingVertical: 9, borderBottomWidth: 1 },

  // Shopping list
  shopItem:       { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 6 },
  shopItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shopName:       { flex: 1, fontSize: 12, fontWeight: '600', fontFamily: MONO },
  shopCpu:        { fontSize: 10, fontFamily: MONO },
  shopPrice:      { fontSize: 13, fontWeight: '700', fontFamily: MONO, minWidth: 48, textAlign: 'right' },
  shopEditGrid:   { flexDirection: 'row', gap: 6, marginTop: 10 },
  cartTotalLabel: { fontSize: 13, fontWeight: '700', fontFamily: MONO },

  // Summary footer
  summaryCard:    { borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 8, marginBottom: 8 },
  summaryRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  summaryDivider: { borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
  summaryName:    { flex: 1, fontSize: 12, fontFamily: MONO },
  summaryCost:    { fontSize: 13, fontWeight: '700', fontFamily: MONO },
  actionBtn:      { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  actionBtnTxt:   { fontSize: 11, fontWeight: '700', fontFamily: MONO },
  logBtn:         { borderWidth: 1.5, borderRadius: 20, paddingVertical: 11, alignItems: 'center', marginTop: 8 },
  logBtnTxt:      { fontSize: 13, fontWeight: '700', fontFamily: MONO },

  // Saved carts
  secLabelRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1 },
  savedCartCard:  { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  savedCartName:  { fontSize: 13, fontWeight: '700', fontFamily: MONO, marginBottom: 2 },
  savedCartMeta:  { fontSize: 10, fontFamily: MONO },
  savedCartItem:  { fontSize: 11, fontFamily: MONO, marginTop: 4, paddingLeft: 4 },
  cartActionBtn:  { flex: 1, borderWidth: 1, borderRadius: 20, paddingVertical: 7, alignItems: 'center' },

  // Add Meal modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox:        { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: 16, padding: 20 },
  modalTitle:      { fontSize: 15, fontWeight: '700', fontFamily: MONO, marginBottom: 14, textAlign: 'center' },
  modalOption:     { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10 },
  modalOptionTxt:  { fontSize: 14, fontWeight: '600', fontFamily: MONO },

  // Log Cart modal
  logModalContainer: { flex: 1 },
  logModalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  logModalTitle:     { fontSize: 16, fontWeight: '700', fontFamily: MONO },
  logRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  checkbox:          { width: 20, height: 20, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  logModalFooter:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
});
