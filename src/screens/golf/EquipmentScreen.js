import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, Modal, KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// ─── Configuration ────────────────────────────────────────────────────────────

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const SECTIONS = [
  { key:'driver',   label:'Drivers',                        icon:'🏌️', singular:'Driver'       },
  { key:'wood',     label:'Fairway Woods',                  icon:'🪵', singular:'Fairway Wood'  },
  { key:'hybrid',   label:'Hybrids',                        icon:'⚡', singular:'Hybrid'        },
  { key:'iron',     label:'Irons',                          icon:'🔩', singular:'Iron'          },
  { key:'wedge',    label:'Wedges',                         icon:'✂️', singular:'Wedge'         },
  { key:'putter',   label:'Putters',                        icon:'🎯', singular:'Putter'        },
  { key:'ball',     label:'Balls',                          icon:'⚪', singular:'Ball'          },
  { key:'training', label:'Training & Launch Monitors',     icon:'📡', singular:'Training Aid'  },
  { key:'other',    label:'Other Equipment',                icon:'🎒', singular:'Other'         },
];

const FIELDS = {
  driver:   ['make','model','loft','lie','length','swingweight','shaft','grip','notes'],
  wood:     ['make','model','loft','lie','length','swingweight','shaft','grip','notes'],
  hybrid:   ['make','model','loft','lie','length','swingweight','shaft','grip','notes'],
  iron:     ['make','model','loft','lie','length','swingweight','shaft','grip','notes'],
  wedge:    ['make','model','loft','lie','bounce','grind','length','shaft','grip','notes'],
  putter:   ['make','model','length','loft','lie','offset','grip','notes'],
  ball:     ['make','model','construction','compression','notes'],
  training: ['make','model','notes'],
  other:    ['make','model','notes'],
};

const FIELD_LABELS = {
  make:'Make', model:'Model', loft:'Loft (°)', lie:'Lie (°)',
  length:'Length (in)', swingweight:'Swingweight', shaft:'Shaft',
  grip:'Grip', notes:'Notes', bounce:'Bounce (°)', grind:'Grind',
  offset:'Offset', construction:'Construction', compression:'Compression',
};

// Keys excluded from the "What's in the Bag" summary
const BAG_EXCLUDE = new Set(['ball','training','other']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function itemName(item) {
  return [item.make, item.model].filter(Boolean).join(' ') || 'Unnamed';
}

function itemSub(item) {
  return item.loft ? `${item.loft}°` : item.compression || item.shaft || '';
}

function emptyEquipment() {
  const obj = {};
  SECTIONS.forEach(s => { obj[s.key] = []; });
  return obj;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SecHeader({ title, open, onToggle, rightEl, c }) {
  return (
    <TouchableOpacity style={[sh.row, { borderBottomColor:c.borderSubtle }]} onPress={onToggle} activeOpacity={0.7}>
      <Text style={[sh.label, { color:c.textMuted, fontFamily:MONO }]}>{title}</Text>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
        {rightEl}
        <Text style={{ color:c.textMuted, fontSize:10 }}>{open ? '▲' : '▼'}</Text>
      </View>
    </TouchableOpacity>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth:1, paddingVertical:10, marginTop:16, marginBottom:8 },
  label: { fontSize:10, fontWeight:'600', letterSpacing:0.8, flex:1 },
});

function FLabel({ label, c }) {
  return <Text style={{ fontSize:9, fontWeight:'600', letterSpacing:0.7, marginBottom:3, marginTop:10, color:c.textMuted, fontFamily:MONO }}>{label.toUpperCase()}</Text>;
}

// Item bubble pill
function ItemBubble({ item, inPlay, onPress, c }) {
  const name = itemName(item);
  const sub  = itemSub(item);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[ib.bubble, {
        backgroundColor: inPlay ? c.greenGlow : c.bgCard,
        borderColor:     inPlay ? c.green     : c.borderSubtle,
      }]}
    >
      <View style={[ib.dot, { backgroundColor: inPlay ? c.green : c.textMuted }]} />
      <View style={{ flex:1, minWidth:0 }}>
        <Text style={[ib.name, { color: inPlay ? c.green : c.textPrimary, fontFamily:MONO }]} numberOfLines={1}>{name}</Text>
        {!!sub && <Text style={[ib.sub, { color: inPlay ? c.green : c.textMuted, fontFamily:MONO }]} numberOfLines={1}>{sub}</Text>}
      </View>
    </TouchableOpacity>
  );
}
const ib = StyleSheet.create({
  bubble: { flexDirection:'row', alignItems:'center', gap:8, borderWidth:1.5, borderRadius:50, paddingHorizontal:14, paddingVertical:8, marginRight:8, marginBottom:8, maxWidth:240 },
  dot:    { width:7, height:7, borderRadius:4, flexShrink:0 },
  name:   { fontSize:12, fontWeight:'600' },
  sub:    { fontSize:10 },
});

// Bag slot card
function BagSlotCard({ item, section, c }) {
  const sub = item.loft ? `${item.loft}°` : item.compression || '';
  return (
    <View style={[bs.slot, { backgroundColor:c.greenGlow, borderColor:c.green }]}>
      <Text style={[bs.cat, { color:c.green, fontFamily:MONO }]}>{section.icon} {section.singular}</Text>
      <Text style={[bs.name, { color:c.green, fontFamily:MONO }]} numberOfLines={2}>{itemName(item)}</Text>
      {!!sub && <Text style={[bs.sub, { color:c.green, fontFamily:MONO }]}>{sub}</Text>}
    </View>
  );
}
const bs = StyleSheet.create({
  slot: { width:'47%', borderWidth:1, borderRadius:8, padding:10, margin:'1.5%' },
  cat:  { fontSize:9, fontWeight:'600', letterSpacing:0.8, marginBottom:3 },
  name: { fontSize:11, fontWeight:'600', lineHeight:15 },
  sub:  { fontSize:10, marginTop:2, opacity:0.8 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EquipmentScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;

  // ── Data ────────────────────────────────────────────────
  const [equipment, setEquipment] = useState(emptyEquipment());
  const [idCounter, setIdCounter] = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [saved,     setSaved]     = useState(false);

  // ── Section open state ──────────────────────────────────
  const initOpen = () => {
    const o = { bag: true };
    SECTIONS.forEach(s => { o[s.key] = true; });
    return o;
  };
  const [open, setOpen] = useState(initOpen);
  const toggle = key => setOpen(p => ({ ...p, [key]: !p[key] }));

  // ── Modal ───────────────────────────────────────────────
  // mode: null | 'view' | 'add' | 'edit'
  const [modalMode,   setModalMode]   = useState(null);
  const [modalType,   setModalType]   = useState(null);
  const [modalItemId, setModalItemId] = useState(null);
  const [formValues,  setFormValues]  = useState({});
  const setField = (key, val) => setFormValues(p => ({ ...p, [key]: val }));

  // ── Firestore ─────────────────────────────────────────
  const docRef = () =>
    firebase.firestore().collection('users').doc(user.uid).collection('localStorage').doc('data');

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const persist = async (updEq, updCounter) => {
    try {
      await docRef().set({
        golf_equipment:   JSON.stringify(updEq),
        golf_id_counter:  String(updCounter),
      }, { merge: true });
      flash();
    } catch (err) { Alert.alert('Save error', err.message); }
  };

  // ── Load ────────────────────────────────────────────────
  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await docRef().get();
      const d = snap.exists ? snap.data() : {};
      const eq = JSON.parse(d.golf_equipment || '{}');
      SECTIONS.forEach(s => { if (!eq[s.key]) eq[s.key] = []; });
      setEquipment(eq);
      setIdCounter(parseInt(d.golf_id_counter || '1'));
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  // ── Modal helpers ────────────────────────────────────────
  const openView = (type, id) => {
    setModalType(type); setModalItemId(id); setModalMode('view');
  };

  const openAdd = (type) => {
    setModalType(type); setModalItemId(null);
    setFormValues({});
    setModalMode('add');
  };

  const openEdit = (type, id) => {
    const item = (equipment[type] || []).find(x => x.id === id);
    if (!item) return;
    setModalType(type); setModalItemId(id);
    const vals = {};
    (FIELDS[type] || []).forEach(f => { vals[f] = item[f] || ''; });
    setFormValues(vals);
    setModalMode('edit');
  };

  // ── Save handlers ────────────────────────────────────────
  const saveAdd = async () => {
    if (!formValues.make && !formValues.model) {
      return Alert.alert('Required', 'Enter at least a Make or Model.');
    }
    const newId = idCounter;
    const item = { id: newId, status: 'not-in-play' };
    (FIELDS[modalType] || []).forEach(f => { item[f] = formValues[f] || ''; });
    const updEq = { ...equipment, [modalType]: [...(equipment[modalType] || []), item] };
    const newCounter = idCounter + 1;
    setEquipment(updEq); setIdCounter(newCounter); setModalMode(null);
    await persist(updEq, newCounter);
  };

  const saveEdit = async () => {
    const items = equipment[modalType] || [];
    const updItems = items.map(x => {
      if (x.id !== modalItemId) return x;
      const updated = { ...x };
      (FIELDS[modalType] || []).forEach(f => { updated[f] = formValues[f] || ''; });
      return updated;
    });
    const updEq = { ...equipment, [modalType]: updItems };
    setEquipment(updEq); setModalMode(null);
    await persist(updEq, idCounter);
  };

  const toggleStatus = async (type, id, inPlay) => {
    const updItems = (equipment[type] || []).map(x =>
      x.id === id ? { ...x, status: inPlay ? 'in-play' : 'not-in-play' } : x
    );
    const updEq = { ...equipment, [type]: updItems };
    setEquipment(updEq);
    await persist(updEq, idCounter);
  };

  const deleteItem = (type, id) => {
    Alert.alert('Remove item?', 'Remove this item from your inventory?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const updEq = { ...equipment, [type]: (equipment[type] || []).filter(x => x.id !== id) };
          setEquipment(updEq); setModalMode(null);
          await persist(updEq, idCounter);
        },
      },
    ]);
  };

  // ── Modal item lookup ───────────────────────────────────
  const modalItem = modalItemId != null
    ? (equipment[modalType] || []).find(x => x.id === modalItemId)
    : null;
  const modalSection = SECTIONS.find(s => s.key === modalType);
  const modalTitle =
    modalMode === 'add'  ? `${modalSection?.icon || ''} Add ${modalSection?.singular || ''}`
    : modalMode === 'edit' ? `Edit — ${itemName(modalItem || {})}`
    : modalItem           ? `${modalSection?.icon || ''} ${itemName(modalItem)}`
    : '';

  // ── Bag items ───────────────────────────────────────────
  const bagItems = SECTIONS
    .filter(s => !BAG_EXCLUDE.has(s.key))
    .flatMap(s => (equipment[s.key] || []).filter(x => x.status === 'in-play').map(x => ({ item: x, section: s })));

  if (loading) {
    return <View style={[s.centered]}><ActivityIndicator color={c.green} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {saved && (
        <View style={[s.savedBadge, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
          <Text style={[s.savedText, { color: c.green, fontFamily: MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── What's in the Bag ──────────────────────── */}
        <SecHeader title="WHAT'S IN THE BAG" open={open.bag} onToggle={() => toggle('bag')} c={c} />
        {open.bag && (
          bagItems.length === 0 ? (
            <Text style={[s.emptyNote, { color: c.textMuted, fontFamily: MONO }]}>
              No clubs marked In Play yet. Mark clubs as In Play to populate this section.
            </Text>
          ) : (
            <View style={s.bagGrid}>
              {bagItems.map(({ item, section }) => (
                <BagSlotCard key={`${section.key}-${item.id}`} item={item} section={section} c={c} />
              ))}
            </View>
          )
        )}

        {/* ── Equipment Sections ─────────────────────── */}
        {SECTIONS.map(sec => {
          const items = equipment[sec.key] || [];
          return (
            <View key={sec.key}>
              <SecHeader
                title={`${sec.icon}  ${sec.label.toUpperCase()}${items.length > 0 ? `  (${items.length})` : ''}`}
                open={open[sec.key]}
                onToggle={() => toggle(sec.key)}
                c={c}
                rightEl={
                  <TouchableOpacity
                    style={[s.addBubble, { borderColor: c.borderSubtle }]}
                    onPress={() => openAdd(sec.key)}
                  >
                    <Text style={[s.addBubbleTxt, { color: c.textMuted, fontFamily: MONO }]}>+ Add</Text>
                  </TouchableOpacity>
                }
              />
              {open[sec.key] && (
                items.length === 0 ? (
                  <Text style={[s.emptyNote, { color: c.textMuted, fontFamily: MONO, marginBottom: 8 }]}>No items yet.</Text>
                ) : (
                  <View style={s.bubbleRow}>
                    {items.map(item => (
                      <ItemBubble
                        key={item.id}
                        item={item}
                        inPlay={item.status === 'in-play'}
                        onPress={() => openView(sec.key, item.id)}
                        c={c}
                      />
                    ))}
                  </View>
                )
              )}
            </View>
          );
        })}

      </ScrollView>

      {/* ── Modal ──────────────────────────────────────── */}
      <Modal visible={modalMode !== null} animationType="slide" transparent onRequestClose={() => setModalMode(null)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[s.modalSheet, { backgroundColor: c.bgCard, borderColor: c.borderSubtle }]}
          >
            {/* Header */}
            <View style={[s.modalHeader, { borderBottomColor: c.borderSubtle, backgroundColor: c.bgCard }]}>
              <Text style={[s.modalTitle, { color: c.textPrimary, fontFamily: MONO }]} numberOfLines={1}>{modalTitle}</Text>
              <TouchableOpacity style={[s.closeBtn, { backgroundColor: c.bgBase, borderColor: c.borderSubtle }]} onPress={() => setModalMode(null)}>
                <Text style={{ color: c.textMuted, fontSize: 14 }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {/* ── VIEW MODE ── */}
              {modalMode === 'view' && modalItem && (() => {
                const fields = FIELDS[modalType] || [];
                const inPlay = modalItem.status === 'in-play';
                return (
                  <>
                    {/* Status toggle */}
                    <View style={s.statusRow}>
                      <TouchableOpacity
                        style={[s.stBtn, { backgroundColor: inPlay ? c.greenGlow : c.bgBase, borderColor: inPlay ? c.green : c.borderSubtle }]}
                        onPress={() => toggleStatus(modalType, modalItemId, true)}
                      >
                        <Text style={[s.stTxt, { color: inPlay ? c.green : c.textMuted, fontFamily: MONO }]}>✓ In Play</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.stBtn, { backgroundColor: !inPlay ? c.bgBase : 'transparent', borderColor: !inPlay ? c.borderSubtle : c.borderSubtle }]}
                        onPress={() => toggleStatus(modalType, modalItemId, false)}
                      >
                        <Text style={[s.stTxt, { color: !inPlay ? c.textSecondary : c.textMuted, fontFamily: MONO }]}>Not In Play</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Detail fields */}
                    <View style={s.detailGrid}>
                      {fields.filter(f => f !== 'notes').map(f => (
                        <View key={f} style={[s.df, { backgroundColor: c.bgBase }]}>
                          <Text style={[s.dfLabel, { color: c.textMuted, fontFamily: MONO }]}>{(FIELD_LABELS[f] || f).toUpperCase()}</Text>
                          <Text style={[s.dfVal, { color: modalItem[f] ? c.textPrimary : c.textMuted, fontFamily: MONO, fontStyle: modalItem[f] ? 'normal' : 'italic' }]}>
                            {modalItem[f] || '—'}
                          </Text>
                        </View>
                      ))}
                      {!!modalItem.notes && (
                        <View style={[s.df, s.dfFull, { backgroundColor: c.bgBase }]}>
                          <Text style={[s.dfLabel, { color: c.textMuted, fontFamily: MONO }]}>NOTES</Text>
                          <Text style={[s.dfVal, { color: c.textPrimary, fontFamily: MONO }]}>{modalItem.notes}</Text>
                        </View>
                      )}
                    </View>

                    {/* Actions */}
                    <View style={[s.modalActions, { borderTopColor: c.borderSubtle }]}>
                      <TouchableOpacity onPress={() => deleteItem(modalType, modalItemId)} style={[s.actionBtn, { backgroundColor: c.redGlow, borderColor: c.red }]}>
                        <Text style={[s.actionTxt, { color: c.red, fontFamily: MONO }]}>Delete</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => openEdit(modalType, modalItemId)} style={[s.actionBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                        <Text style={[s.actionTxt, { color: c.green, fontFamily: MONO }]}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}

              {/* ── ADD / EDIT FORM ── */}
              {(modalMode === 'add' || modalMode === 'edit') && (() => {
                const fields = FIELDS[modalType] || [];
                const nonNoteFields = fields.filter(f => f !== 'notes');
                return (
                  <>
                    <View style={s.formGrid}>
                      {nonNoteFields.map(f => (
                        <View key={f} style={s.formField}>
                          <FLabel label={FIELD_LABELS[f] || f} c={c} />
                          <TextInput
                            style={[s.input, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                            value={formValues[f] || ''}
                            onChangeText={v => setField(f, v)}
                            placeholder={FIELD_LABELS[f] || f}
                            placeholderTextColor={c.textMuted}
                          />
                        </View>
                      ))}
                    </View>

                    {fields.includes('notes') && (
                      <View>
                        <FLabel label="Notes" c={c} />
                        <TextInput
                          style={[s.input, s.notesInput, { borderColor: c.borderSubtle, backgroundColor: c.bgBase, color: c.textPrimary, fontFamily: MONO }]}
                          value={formValues.notes || ''}
                          onChangeText={v => setField('notes', v)}
                          placeholder="Any additional notes..."
                          placeholderTextColor={c.textMuted}
                          multiline
                        />
                      </View>
                    )}

                    <View style={[s.modalActions, { borderTopColor: c.borderSubtle }]}>
                      <TouchableOpacity onPress={() => setModalMode(null)} style={[s.actionBtn, { borderColor: c.borderSubtle, backgroundColor: c.bgBase }]}>
                        <Text style={[s.actionTxt, { color: c.textMuted, fontFamily: MONO }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={modalMode === 'add' ? saveAdd : saveEdit} style={[s.actionBtn, { backgroundColor: c.greenGlow, borderColor: c.green }]}>
                        <Text style={[s.actionTxt, { color: c.green, fontFamily: MONO }]}>{modalMode === 'add' ? 'Add to Inventory' : 'Save Changes'}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}

            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:    { flex:1, alignItems:'center', justifyContent:'center' },
  scroll:      { padding:14, paddingBottom:60 },
  savedBadge:  { position:'absolute', bottom:16, right:16, zIndex:99, borderWidth:1, borderRadius:20, paddingHorizontal:14, paddingVertical:5 },
  savedText:   { fontSize:11, fontWeight:'600' },
  emptyNote:   { fontSize:11, fontStyle:'italic', marginBottom:6 },
  bagGrid:     { flexDirection:'row', flexWrap:'wrap', marginBottom:4 },
  bubbleRow:   { flexDirection:'row', flexWrap:'wrap', marginBottom:4 },
  addBubble:   { borderWidth:1.5, borderStyle:'dashed', borderRadius:50, paddingHorizontal:12, paddingVertical:5 },
  addBubbleTxt:{ fontSize:11, fontWeight:'600' },

  // Modal
  modalOverlay:{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.45)' },
  modalSheet:  { flex:1, marginTop:72, borderTopLeftRadius:20, borderTopRightRadius:20, borderTopWidth:1, borderLeftWidth:1, borderRightWidth:1, overflow:'hidden' },
  modalHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, borderBottomWidth:1 },
  modalTitle:  { fontSize:15, fontWeight:'600', flex:1, marginRight:10 },
  closeBtn:    { width:28, height:28, borderRadius:14, borderWidth:1, alignItems:'center', justifyContent:'center' },
  modalBody:   { padding:18, paddingBottom:36 },
  modalActions:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:18, paddingTop:14, borderTopWidth:1 },
  actionBtn:   { borderWidth:1, borderRadius:20, paddingVertical:7, paddingHorizontal:18 },
  actionTxt:   { fontSize:12, fontWeight:'600', letterSpacing:0.3 },

  // Status toggle
  statusRow:   { flexDirection:'row', gap:8, marginBottom:14 },
  stBtn:       { flex:1, borderWidth:1.5, borderRadius:8, paddingVertical:8, alignItems:'center', justifyContent:'center' },
  stTxt:       { fontSize:11, fontWeight:'600', letterSpacing:0.5 },

  // Detail view
  detailGrid:  { flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:6 },
  df:          { width:'47%', borderRadius:8, padding:10 },
  dfFull:      { width:'100%' },
  dfLabel:     { fontSize:9, fontWeight:'600', letterSpacing:0.5, marginBottom:3 },
  dfVal:       { fontSize:13, fontWeight:'500' },

  // Form
  formGrid:    { flexDirection:'row', flexWrap:'wrap', gap:0 },
  formField:   { width:'50%', paddingRight:8 },
  input:       { borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:7, fontSize:12, marginBottom:2 },
  notesInput:  { minHeight:60, textAlignVertical:'top' },
});
