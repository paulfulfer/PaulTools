import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Switch, StyleSheet, Alert, Platform, Modal, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// ─── Constants & defaults ─────────────────────────────────────────────────────

const MONO    = Platform.select({ ios: 'Menlo', android: 'monospace' });
const TAX     = 0.1072;
const SAVINGS = 1100;

const CATEGORIES = ['Equipment','Golf','Gas','Food','Social','Subscriptions','Emergency','Other'];
const CAT_COLOR  = { Equipment:'#9b87f5', Golf:'#4a9eff', Gas:'#e6a020', Food:'#1fbd8a', Social:'#f06292', Subscriptions:'#888', Emergency:'#555', Other:'#444' };
const GOAL_COLORS = ['#2a7de1','#0e9e70','#c27d08','#6c5bbf','#d03030','#1899a8','#e06030','#888'];

const DEF_JOBS = [
  { id:0, name:'SESP',          unit:'hrs', rate:10.25, qty:20, weeks:12 },
  { id:1, name:'Honors Center', unit:'hrs', rate:10.25, qty:2,  weeks:12 },
  { id:2, name:'Internship',    unit:'hrs', rate:15,    qty:40, weeks:12 },
];
const DEF_EXPENSES = [
  { id:0, name:'Launch Monitor',   category:'Equipment',     amount:4500 },
  { id:1, name:'iPad',             category:'Equipment',     amount:250  },
  { id:2, name:'Golf Membership',  category:'Golf',          amount:400  },
  { id:3, name:'Golf Green Fees',  category:'Golf',          amount:400  },
  { id:4, name:'Gas',              category:'Gas',           amount:600  },
  { id:5, name:'Misc Meals',       category:'Food',          amount:300  },
  { id:6, name:'Social',           category:'Social',        amount:60   },
  { id:7, name:'Claude Pro (3mo)', category:'Subscriptions', amount:60   },
  { id:8, name:'Emergency Buffer', category:'Emergency',     amount:0    },
];
const DEF_SCHEDULES = [
  { id:0, name:'Launch Monitor', total:4750, fromSavings:1100, interestFree:true, apr:22 },
];
const DEF_GOALS = [
  { id:0, name:'Launch Monitor + iPad', target:4750, current:0, deferred:false, color:'#9b87f5' },
  { id:1, name:'Roth IRA 2026',         target:7500, current:0, deferred:false, color:'#2a7de1' },
  { id:2, name:'Truck Fund',            target:1500, current:0, deferred:true,  color:'#a0a0a0' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n)  { return '$' + Math.round(Math.abs(Number(n)||0)).toLocaleString(); }
function fmtD(n) { return '$' + Math.abs(Number(n)||0).toFixed(2); }
function fmts(n) { return (Number(n)<0?'-':'') + fmt(n); }
function fmtDateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtDateDisp(d) { return d ? d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'Pick date'; }

function mpCalc(principal, apr, months) {
  if (!months) return 0;
  if (!apr) return principal / months;
  const r = (apr / 100) / 12;
  return principal * r * Math.pow(1+r, months) / (Math.pow(1+r, months) - 1);
}

// ─── Tiny shared sub-components ───────────────────────────────────────────────

function SecHeader({ title, open, onToggle, c, rightEl }) {
  return (
    <TouchableOpacity style={[sh.row, { borderBottomColor: c.borderSubtle }]} onPress={onToggle} activeOpacity={0.7}>
      <Text style={[sh.label, { color: c.textMuted, fontFamily: MONO }]}>{title.toUpperCase()}</Text>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
        {rightEl}
        <Text style={[sh.arrow, { color: c.textMuted }]}>{open ? '▲' : '▼'}</Text>
      </View>
    </TouchableOpacity>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth:1, paddingVertical:10, marginTop:18, marginBottom:8 },
  label: { fontSize:10, fontWeight:'600', letterSpacing:1 },
  arrow: { fontSize:10 },
});

function FLabel({ label, c }) {
  return <Text style={[{ fontSize:9, fontWeight:'600', letterSpacing:0.8, marginBottom:3, marginTop:10, color:c.textMuted, fontFamily:MONO }]}>{label.toUpperCase()}</Text>;
}

function MetCard({ label, value, sub, color, c }) {
  return (
    <View style={[mc.card, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
      <Text style={[mc.label, { color:c.textMuted, fontFamily:MONO }]}>{label.toUpperCase()}</Text>
      <Text style={[mc.value, { color:color||c.textPrimary, fontFamily:MONO }]}>{value}</Text>
      {!!sub && <Text style={[mc.sub, { color:c.textMuted, fontFamily:MONO }]}>{sub}</Text>}
    </View>
  );
}
const mc = StyleSheet.create({
  card:  { flex:1, minWidth:'45%', borderWidth:1, borderRadius:8, padding:10, margin:3 },
  label: { fontSize:9, letterSpacing:0.8, marginBottom:3 },
  value: { fontSize:17, fontWeight:'600', letterSpacing:-0.3 },
  sub:   { fontSize:9, marginTop:2 },
});

function BarRow({ label, value, pct, color, c }) {
  return (
    <View style={br.row}>
      <Text style={[br.label, { color:c.textMuted, fontFamily:MONO }]}>{label}</Text>
      <View style={[br.track, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]}>
        <View style={[br.fill, { width:`${Math.min(100,pct).toFixed(1)}%`, backgroundColor:color }]} />
      </View>
      <Text style={[br.amt, { color:c.textPrimary, fontFamily:MONO }]}>{value}</Text>
    </View>
  );
}
const br = StyleSheet.create({
  row:   { flexDirection:'row', alignItems:'center', marginBottom:6, gap:8 },
  label: { width:110, fontSize:11 },
  track: { flex:1, height:7, borderRadius:4, borderWidth:1, overflow:'hidden' },
  fill:  { height:'100%', borderRadius:4 },
  amt:   { width:58, textAlign:'right', fontSize:12, fontWeight:'600' },
});

function InputRow({ label, value, onChange, onBlur, c, color }) {
  return (
    <View style={ir.row}>
      <Text style={[ir.label, { color:c.textMuted, fontFamily:MONO }]}>{label}</Text>
      <TextInput
        style={[ir.input, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:color||c.textPrimary, fontFamily:MONO }]}
        value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="decimal-pad" />
    </View>
  );
}
const ir = StyleSheet.create({
  row:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:5 },
  label: { fontSize:12, flex:1 },
  input: { width:80, fontSize:12, paddingHorizontal:7, paddingVertical:4, borderWidth:1, borderRadius:5, textAlign:'right' },
});

function DashedAdd({ label, c, onPress }) {
  return (
    <TouchableOpacity style={[da.btn, { borderColor:c.borderSubtle }]} onPress={onPress}>
      <Text style={[da.txt, { color:c.textMuted, fontFamily:MONO }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const da = StyleSheet.create({
  btn: { borderWidth:1, borderStyle:'dashed', borderRadius:8, padding:14, alignItems:'center', marginBottom:6 },
  txt: { fontSize:12 },
});

// ─── JobCard ──────────────────────────────────────────────────────────────────

function JobCard({ job, c, onSave, onRemove }) {
  const [name,  setName]  = useState(job.name);
  const [qty,   setQty]   = useState(String(job.qty));
  const [rate,  setRate]  = useState(String(job.rate));
  const [unit,  setUnit]  = useState(job.unit);
  const [weeks, setWeeks] = useState(String(job.weeks));

  const save = (ov={}) => onSave(job.id, {
    name: ov.name??name, qty: parseFloat(ov.qty??qty)||0,
    rate: parseFloat(ov.rate??rate)||0, unit: ov.unit??unit,
    weeks: parseFloat(ov.weeks??weeks)||0,
  });

  const wkEarn  = (parseFloat(qty)||0) * (parseFloat(rate)||0);
  const totEarn = wkEarn * (parseFloat(weeks)||0);

  return (
    <View style={[jc.card, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
      <TouchableOpacity style={[jc.rmBtn, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]} onPress={onRemove}>
        <Text style={{ color:c.textMuted, fontSize:13 }}>×</Text>
      </TouchableOpacity>
      <TextInput style={[jc.title, { color:c.textSecondary, borderBottomColor:c.borderSubtle, fontFamily:MONO }]}
        value={name} onChangeText={setName} onBlur={()=>save()} />
      <InputRow label={unit==='nights'?'Nights/wk':'Hrs/week'} value={qty}   onChange={setQty}   onBlur={()=>save()} c={c} />
      <InputRow label="Rate ($/unit)"                            value={rate}  onChange={setRate}  onBlur={()=>save()} c={c} />
      <View style={ir.row}>
        <Text style={[ir.label, { color:c.textMuted, fontFamily:MONO }]}>Unit</Text>
        <View style={[jc.pickWrap, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]}>
          <Picker selectedValue={unit} onValueChange={val=>{ setUnit(val); save({unit:val}); }}
            style={{ color:c.textPrimary, height:32 }} dropdownIconColor={c.textMuted}
            itemStyle={{ fontSize:11, color:c.textPrimary }}>
            <Picker.Item label="hrs"    value="hrs"    color={c.textPrimary} />
            <Picker.Item label="nights" value="nights" color={c.textPrimary} />
          </Picker>
        </View>
      </View>
      <InputRow label="Weeks" value={weeks} onChange={setWeeks} onBlur={()=>save()} c={c} />
      <View style={[jc.foot, { borderTopColor:c.borderSubtle }]}>
        <Text style={[jc.fl, { color:c.textMuted, fontFamily:MONO }]}>Weekly</Text>
        <Text style={[jc.fv, { color:c.textPrimary, fontFamily:MONO }]}>{fmt(wkEarn)}</Text>
      </View>
      <View style={jc.foot}>
        <Text style={[jc.fl, { color:c.textMuted, fontFamily:MONO }]}>Total gross</Text>
        <Text style={[jc.fv, { color:c.textPrimary, fontFamily:MONO }]}>{fmt(totEarn)}</Text>
      </View>
    </View>
  );
}
const jc = StyleSheet.create({
  card:    { borderWidth:1, borderRadius:8, padding:12, marginBottom:8, position:'relative', paddingTop:14 },
  title:   { fontSize:11, fontWeight:'600', borderBottomWidth:1, paddingBottom:4, marginBottom:8, letterSpacing:0.5 },
  pickWrap:{ width:80, borderWidth:1, borderRadius:5, height:32, overflow:'hidden', justifyContent:'center' },
  foot:    { flexDirection:'row', justifyContent:'space-between', paddingTop:6, marginTop:4 },
  fl:      { fontSize:11 },
  fv:      { fontSize:11, fontWeight:'600' },
  rmBtn:   { position:'absolute', top:8, right:8, width:20, height:20, borderRadius:10, borderWidth:1, alignItems:'center', justifyContent:'center', zIndex:1 },
});

// ─── ExpenseCard ──────────────────────────────────────────────────────────────

function ExpenseCard({ expense, c, onSave, onComplete }) {
  const [name,     setName]     = useState(expense.name);
  const [amount,   setAmount]   = useState(String(expense.amount));
  const [category, setCategory] = useState(expense.category);

  const save = (ov={}) => onSave(expense.id, {
    name: ov.name??name, amount: parseFloat(ov.amount??amount)||0, category: ov.category??category,
  });

  return (
    <View style={[ec.card, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
      <TextInput style={[ec.title, { color:c.textSecondary, borderBottomColor:c.borderSubtle, fontFamily:MONO }]}
        value={name} onChangeText={setName} onBlur={()=>save()} />
      <InputRow label="Amount ($)" value={amount} onChange={setAmount} onBlur={()=>save()} c={c} />
      <View style={[ir.row, { marginBottom:4 }]}>
        <Text style={[ir.label, { color:c.textMuted, fontFamily:MONO }]}>Category</Text>
        <View style={[ec.pickWrap, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]}>
          <Picker selectedValue={category} onValueChange={val=>{ setCategory(val); save({category:val}); }}
            style={{ color:c.textPrimary }} dropdownIconColor={c.textMuted}
            itemStyle={{ fontSize:11, color:c.textPrimary }}>
            {CATEGORIES.map(cat=><Picker.Item key={cat} label={cat} value={cat} color={c.textPrimary} />)}
          </Picker>
        </View>
      </View>
      <View style={[ec.foot, { borderTopColor:c.borderSubtle }]}>
        <View style={[ec.tag, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]}>
          <View style={[ec.dot, { backgroundColor:CAT_COLOR[category]||'#aaa' }]} />
          <Text style={[ec.tagTxt, { color:c.textMuted, fontFamily:MONO }]}>{category}</Text>
        </View>
        <Text style={[ec.amt, { color:c.amber, fontFamily:MONO }]}>{fmt(parseFloat(amount)||0)}</Text>
      </View>
      <TouchableOpacity style={[ec.paidBtn, { borderColor:c.green, backgroundColor:c.greenGlow }]} onPress={()=>onComplete(expense.id)}>
        <Text style={[ec.paidTxt, { color:c.green, fontFamily:MONO }]}>✓ Mark Paid</Text>
      </TouchableOpacity>
    </View>
  );
}
const ec = StyleSheet.create({
  card:    { borderWidth:1, borderRadius:8, padding:12, marginBottom:8 },
  title:   { fontSize:11, fontWeight:'600', borderBottomWidth:1, paddingBottom:4, marginBottom:8, letterSpacing:0.5 },
  pickWrap:{ flex:1, maxWidth:130, borderWidth:1, borderRadius:5, height:34, overflow:'hidden' },
  foot:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderTopWidth:1, paddingTop:8, marginTop:6, gap:8 },
  tag:     { flexDirection:'row', alignItems:'center', gap:5, borderWidth:1, borderRadius:10, paddingHorizontal:7, paddingVertical:2 },
  dot:     { width:7, height:7, borderRadius:4 },
  tagTxt:  { fontSize:9, fontWeight:'600', letterSpacing:0.4 },
  amt:     { fontSize:13, fontWeight:'600' },
  paidBtn: { borderWidth:1, borderRadius:20, paddingVertical:5, paddingHorizontal:14, alignSelf:'flex-start', marginTop:8 },
  paidTxt: { fontSize:10, fontWeight:'600', letterSpacing:0.5 },
});

// ─── ScheduleCard ─────────────────────────────────────────────────────────────

function ScheduleCard({ schedule, c, onSave, onRemove }) {
  const [name,         setName]         = useState(schedule.name);
  const [total,        setTotal]        = useState(String(schedule.total));
  const [fromSavings,  setFromSavings]  = useState(String(schedule.fromSavings||0));
  const [interestFree, setInterestFree] = useState(schedule.interestFree);
  const [apr,          setApr]          = useState(String(schedule.apr||22));

  const save = (ov={}) => onSave(schedule.id, {
    name: ov.name??name, total: parseFloat(ov.total??total)||0,
    fromSavings: parseFloat(ov.fromSavings??fromSavings)||0,
    interestFree: ov.interestFree??interestFree,
    apr: parseFloat(ov.apr??apr)||22,
  });

  const owed = Math.max(0, (parseFloat(total)||0) - (parseFloat(fromSavings)||0));
  const effApr = interestFree ? 0 : (parseFloat(apr)||22);

  return (
    <View style={[sc.card, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
      <View style={sc.header}>
        <TextInput style={[sc.name, { color:c.textPrimary, fontFamily:MONO, borderBottomColor:c.borderSubtle }]}
          value={name} onChangeText={setName} onBlur={()=>save()} placeholder="Purchase name" placeholderTextColor={c.textMuted} />
        <TouchableOpacity onPress={onRemove} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Text style={{ color:c.textMuted, fontSize:16 }}>✕</Text>
        </TouchableOpacity>
      </View>
      <InputRow label="Total cost ($)"   value={total}       onChange={setTotal}       onBlur={()=>save()} c={c} />
      <InputRow label="From savings ($)" value={fromSavings} onChange={setFromSavings} onBlur={()=>save()} c={c} />
      <View style={[ir.row, { marginVertical:6 }]}>
        <Text style={[ir.label, { color:c.textMuted, fontFamily:MONO }]}>Interest-free?</Text>
        <Switch value={interestFree} onValueChange={val=>{ setInterestFree(val); save({interestFree:val}); }}
          trackColor={{ false:c.borderSubtle, true:c.blueGlow }} thumbColor={interestFree?c.blue:c.textMuted} />
      </View>
      {!interestFree && <InputRow label="APR (%)" value={apr} onChange={setApr} onBlur={()=>save()} c={c} />}
      <Text style={[sc.owed, { color:c.textMuted, fontFamily:MONO }]}>
        Owed after savings: <Text style={{ color:c.textPrimary, fontWeight:'600' }}>{fmtD(owed)}</Text>
      </Text>
      {/* Table */}
      <View style={[sc.tableHead, { borderBottomColor:c.borderSubtle }]}>
        {['Timeline','Monthly','Biweekly','Total','Interest'].map(h=>(
          <Text key={h} style={[sc.th, { color:c.textMuted, fontFamily:MONO }]}>{h}</Text>
        ))}
      </View>
      {[3,6,12].map(months => {
        const mPmt = mpCalc(owed, effApr, months);
        const tot2 = mPmt * months;
        const int  = tot2 - owed;
        return (
          <View key={months} style={[sc.tableRow, { borderBottomColor:c.borderSubtle }]}>
            <Text style={[sc.td, { color:c.textPrimary, fontFamily:MONO }]}>{months}mo</Text>
            <Text style={[sc.td, { color:c.textPrimary, fontFamily:MONO }]}>{fmtD(mPmt)}</Text>
            <Text style={[sc.td, { color:c.textPrimary, fontFamily:MONO }]}>{fmtD(mPmt/2)}</Text>
            <Text style={[sc.td, { color:c.textPrimary, fontFamily:MONO }]}>{fmtD(tot2)}</Text>
            <Text style={[sc.td, { color:int<0.5?c.green:c.red, fontFamily:MONO }]}>{int<0.5?'$0.00':fmtD(int)}</Text>
          </View>
        );
      })}
      <Text style={[sc.note, { color:c.textMuted, fontFamily:MONO }]}>
        {interestFree ? 'Interest-free — pay before statement due date.' : `At ${apr}% APR — pay before due date to avoid interest.`}
      </Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card:     { borderWidth:1, borderRadius:10, padding:14, marginBottom:10 },
  header:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  name:     { flex:1, fontSize:14, fontWeight:'600', borderBottomWidth:1, paddingBottom:3, marginRight:12 },
  owed:     { fontSize:11, marginVertical:8 },
  tableHead:{ flexDirection:'row', borderBottomWidth:1, paddingBottom:5, marginTop:8, marginBottom:3 },
  tableRow: { flexDirection:'row', borderBottomWidth:1, paddingVertical:5 },
  th:       { flex:1, fontSize:8, fontWeight:'600', letterSpacing:0.5 },
  td:       { flex:1, fontSize:11 },
  note:     { fontSize:10, marginTop:8, lineHeight:16 },
});

// ─── GoalCard ─────────────────────────────────────────────────────────────────

function GoalCard({ goal, c, onSave, onRemove }) {
  const [name,     setName]     = useState(goal.name);
  const [target,   setTarget]   = useState(String(goal.target));
  const [current,  setCurrent]  = useState(String(goal.current));
  const [deferred, setDeferred] = useState(goal.deferred);

  const save = (ov={}) => onSave(goal.id, {
    name: ov.name??name, target: parseFloat(ov.target??target)||0,
    current: parseFloat(ov.current??current)||0, deferred: ov.deferred??deferred, color: goal.color,
  });

  const t   = parseFloat(target)||0;
  const cur = parseFloat(current)||0;
  const pct = t > 0 ? Math.min(100, (cur/t)*100) : 0;
  const done = cur >= t && t > 0;

  return (
    <View style={[gc.card, { backgroundColor:c.bgCard, borderColor:c.borderSubtle, opacity:deferred?0.55:1 }]}>
      <TouchableOpacity style={[jc.rmBtn, { backgroundColor:c.bgBase, borderColor:c.borderSubtle }]} onPress={onRemove}>
        <Text style={{ color:c.textMuted, fontSize:13 }}>×</Text>
      </TouchableOpacity>
      <TextInput style={[gc.name, { color:c.textMuted, fontFamily:MONO, borderBottomColor:c.borderSubtle }]}
        value={name} onChangeText={setName} onBlur={()=>save()} placeholder="Goal name" placeholderTextColor={c.textMuted} />
      <View style={gc.amtRow}>
        <Text style={[gc.al, { color:c.textMuted, fontFamily:MONO }]}>Target $</Text>
        <TextInput style={[gc.ai, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.textPrimary, fontFamily:MONO }]}
          value={target} onChangeText={setTarget} onBlur={()=>save()} keyboardType="decimal-pad" />
      </View>
      <View style={gc.amtRow}>
        <Text style={[gc.al, { color:c.textMuted, fontFamily:MONO }]}>Current $</Text>
        <TextInput style={[gc.ai, { borderColor:c.borderSubtle, backgroundColor:c.bgBase, color:c.green, fontFamily:MONO }]}
          value={current} onChangeText={setCurrent} onBlur={()=>save()} keyboardType="decimal-pad" />
      </View>
      <Text style={[gc.remaining, { color:c.textMuted, fontFamily:MONO }]}>
        {t>0 ? `$${Math.max(0,Math.round(t-cur)).toLocaleString()} remaining` : '—'}
      </Text>
      <View style={[gc.track, { backgroundColor:c.bgBase }]}>
        <View style={[gc.fill, { width:`${pct.toFixed(1)}%`, backgroundColor:goal.color }]} />
      </View>
      <View style={gc.bottom}>
        <View style={[gc.pill, {
          backgroundColor: done?c.greenGlow:deferred?c.amberGlow:c.blueGlow,
          borderColor:      done?c.green:deferred?c.amber:c.blue,
        }]}>
          <Text style={[gc.pillTxt, { color:done?c.green:deferred?c.amber:c.blue, fontFamily:MONO }]}>
            {done ? 'DONE' : deferred ? 'DEFERRED' : `${pct.toFixed(0)}%`}
          </Text>
        </View>
        <View style={gc.deferRow}>
          <Text style={[gc.dl, { color:c.textMuted, fontFamily:MONO }]}>Defer</Text>
          <Switch value={deferred} onValueChange={val=>{ setDeferred(val); save({deferred:val}); }}
            trackColor={{ false:c.borderSubtle, true:c.amberGlow }} thumbColor={deferred?c.amber:c.textMuted}
            style={{ transform:[{scaleX:0.8},{scaleY:0.8}] }} />
        </View>
      </View>
    </View>
  );
}
const gc = StyleSheet.create({
  card:     { borderWidth:1, borderRadius:10, padding:12, marginBottom:8, position:'relative', paddingTop:14 },
  name:     { fontSize:10, fontWeight:'600', letterSpacing:0.5, borderBottomWidth:1, paddingBottom:3, marginBottom:8 },
  amtRow:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:5 },
  al:       { fontSize:11 },
  ai:       { width:90, fontSize:13, fontWeight:'600', paddingHorizontal:7, paddingVertical:3, borderWidth:1, borderRadius:5, textAlign:'right' },
  remaining:{ fontSize:11, marginTop:2 },
  track:    { height:5, borderRadius:3, marginTop:9, overflow:'hidden' },
  fill:     { height:'100%', borderRadius:3 },
  bottom:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:8 },
  pill:     { borderWidth:1, borderRadius:20, paddingHorizontal:9, paddingVertical:3 },
  pillTxt:  { fontSize:10, fontWeight:'600', letterSpacing:0.5 },
  deferRow: { flexDirection:'row', alignItems:'center', gap:4 },
  dl:       { fontSize:11 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FinancialPlannerScreen() {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const c = theme.colors;
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // ── Data state ──────────────────────────────────────────
  const [jobs,              setJobs]              = useState([]);
  const [expenses,          setExpenses]          = useState([]);
  const [completedExpenses, setCompletedExpenses] = useState([]);
  const [schedules,         setSchedules]         = useState([]);
  const [goals,             setGoals]             = useState([]);
  const [counters,          setCounters]          = useState({ job:3, exp:9, sched:1, goal:3 });
  const [periodDismissed,   setPeriodDismissed]   = useState(false);
  const [projStart,         setProjStart]         = useState(null);
  const [projEnd,           setProjEnd]           = useState(null);

  // ── UI state ────────────────────────────────────────────
  const [open,    setOpen]    = useState({ income:true, expenses:true, projection:true, repay:true, goals:true });
  const [loading, setLoading] = useState(true);
  const [saved,   setSaved]   = useState(false);
  const [picker,  setPicker]  = useState({ show:false, target:'start' });

  // ── Debounced Firestore save ────────────────────────────
  const saveTimer  = useRef(null);
  const pendingRef = useRef({});

  const flash = () => { setSaved(true); setTimeout(()=>setSaved(false), 1500); };

  const queueSave = (updates) => {
    pendingRef.current = { ...pendingRef.current, ...updates };
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const uid = userRef.current?.uid;
      if (!uid) return;
      try {
        await firebase.firestore()
          .collection('users').doc(uid)
          .collection('localStorage').doc('data')
          .set(pendingRef.current, { merge: true });
        flash();
        pendingRef.current = {};
      } catch (err) { console.warn('FP save:', err.message); }
    }, 600);
  };

  // ── Load ────────────────────────────────────────────────
  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await firebase.firestore()
        .collection('users').doc(user.uid)
        .collection('localStorage').doc('data')
        .get();
      const d = snap.exists ? snap.data() : {};
      const j  = d.fp_jobs              ? JSON.parse(d.fp_jobs)              : DEF_JOBS;
      const e  = d.fp_expenses          ? JSON.parse(d.fp_expenses)          : DEF_EXPENSES;
      const ce = d.fp_completedExpenses ? JSON.parse(d.fp_completedExpenses) : [];
      const sc = d.fp_schedules         ? JSON.parse(d.fp_schedules)         : DEF_SCHEDULES;
      const gl = d.fp_goals             ? JSON.parse(d.fp_goals)             : DEF_GOALS;
      setJobs(j); setExpenses(e); setCompletedExpenses(ce); setSchedules(sc); setGoals(gl);
      setCounters({
        job:   parseInt(d.fp_jobIdCounter   || j.length),
        exp:   parseInt(d.fp_expIdCounter   || e.length),
        sched: parseInt(d.fp_schedIdCounter || sc.length),
        goal:  parseInt(d.fp_goalIdCounter  || gl.length),
      });
      setPeriodDismissed(d.fp_periodDismissed === '1');
      if (d.fp_proj_start) setProjStart(new Date(d.fp_proj_start + 'T12:00:00'));
      if (d.fp_proj_end)   setProjEnd(new Date(d.fp_proj_end   + 'T12:00:00'));
    } catch (err) { Alert.alert('Load error', err.message); }
    finally { setLoading(false); }
  };

  // ── Computed ────────────────────────────────────────────
  const wkGross  = jobs.reduce((s,j) => s + j.qty * j.rate, 0);
  const wkNet    = wkGross * (1 - TAX);
  const moGross  = wkGross * (52/12);
  const moNet    = wkNet   * (52/12);
  const totGross = jobs.reduce((s,j) => s + j.qty * j.rate * j.weeks, 0);
  const totTax   = totGross * TAX;
  const totNet   = totGross - totTax;

  const expTotal = expenses.reduce((s,e) => s + e.amount, 0);
  const expEquip = expenses.filter(e=>e.category==='Equipment').reduce((s,e)=>s+e.amount,0);
  const expMisc  = expTotal - expEquip;
  const catTotals = {};
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category]||0) + e.amount; });

  let projData = null;
  if (projStart && projEnd && projEnd > projStart) {
    const weeks   = (projEnd - projStart) / 86400000 / 7;
    const pGross  = wkGross * weeks;
    const pTax    = pGross * TAX;
    const pNet    = pGross - pTax;
    const afterEx = pNet - expTotal;
    projData = { weeks, pGross, pTax, pNet, afterEx };
  }

  // ── Jobs CRUD ───────────────────────────────────────────
  const addJob = () => {
    const id = counters.job;
    const newJob = { id, name:'New Job', unit:'hrs', rate:15, qty:10, weeks:12 };
    const updated = [...jobs, newJob];
    const nc = { ...counters, job: id + 1 };
    setJobs(updated); setCounters(nc);
    queueSave({ fp_jobs: JSON.stringify(updated), fp_jobIdCounter: String(nc.job) });
  };
  const saveJob = (id, fields) => {
    const updated = jobs.map(j => j.id === id ? { ...j, ...fields } : j);
    setJobs(updated); queueSave({ fp_jobs: JSON.stringify(updated) });
  };
  const removeJob = (id) => {
    Alert.alert('Remove job?', '', [
      { text:'Cancel', style:'cancel' },
      { text:'Remove', style:'destructive', onPress: () => {
        const updated = jobs.filter(j=>j.id!==id);
        setJobs(updated); queueSave({ fp_jobs: JSON.stringify(updated) });
      }},
    ]);
  };

  // ── Expenses CRUD ───────────────────────────────────────
  const addExpense = () => {
    const id = counters.exp;
    const newExp = { id, name:'New Expense', category:'Other', amount:0 };
    const updated = [...expenses, newExp];
    const nc = { ...counters, exp: id + 1 };
    setExpenses(updated); setCounters(nc);
    queueSave({ fp_expenses: JSON.stringify(updated), fp_expIdCounter: String(nc.exp) });
  };
  const saveExpense = (id, fields) => {
    const updated = expenses.map(e => e.id === id ? { ...e, ...fields } : e);
    setExpenses(updated); queueSave({ fp_expenses: JSON.stringify(updated) });
  };
  const completeExpense = (id) => {
    const exp = expenses.find(e=>e.id===id);
    if (!exp) return;
    const updExp  = expenses.filter(e=>e.id!==id);
    const updComp = [...completedExpenses, { ...exp, completedAt: new Date().toLocaleDateString() }];
    setExpenses(updExp); setCompletedExpenses(updComp);
    queueSave({ fp_expenses: JSON.stringify(updExp), fp_completedExpenses: JSON.stringify(updComp) });
  };
  const restoreExpense = (id) => {
    const exp = completedExpenses.find(e=>e.id===id);
    if (!exp) return;
    const { completedAt, ...restored } = exp;
    const updExp  = [...expenses, restored];
    const updComp = completedExpenses.filter(e=>e.id!==id);
    setExpenses(updExp); setCompletedExpenses(updComp);
    queueSave({ fp_expenses: JSON.stringify(updExp), fp_completedExpenses: JSON.stringify(updComp) });
  };

  // ── Schedules CRUD ──────────────────────────────────────
  const addSchedule = () => {
    const id = counters.sched;
    const newS = { id, name:'New Purchase', total:1000, fromSavings:0, interestFree:true, apr:22 };
    const updated = [...schedules, newS];
    const nc = { ...counters, sched: id + 1 };
    setSchedules(updated); setCounters(nc);
    queueSave({ fp_schedules: JSON.stringify(updated), fp_schedIdCounter: String(nc.sched) });
  };
  const saveSchedule = (id, fields) => {
    const updated = schedules.map(s => s.id === id ? { ...s, ...fields } : s);
    setSchedules(updated); queueSave({ fp_schedules: JSON.stringify(updated) });
  };
  const removeSchedule = (id) => {
    const updated = schedules.filter(s=>s.id!==id);
    setSchedules(updated); queueSave({ fp_schedules: JSON.stringify(updated) });
  };

  // ── Goals CRUD ──────────────────────────────────────────
  const addGoal = () => {
    const id = counters.goal;
    const newG = { id, name:'New Goal', target:1000, current:0, deferred:false, color:GOAL_COLORS[goals.length%GOAL_COLORS.length] };
    const updated = [...goals, newG];
    const nc = { ...counters, goal: id + 1 };
    setGoals(updated); setCounters(nc);
    queueSave({ fp_goals: JSON.stringify(updated), fp_goalIdCounter: String(nc.goal) });
  };
  const saveGoal = (id, fields) => {
    const updated = goals.map(g => g.id === id ? { ...g, ...fields } : g);
    setGoals(updated); queueSave({ fp_goals: JSON.stringify(updated) });
  };
  const removeGoal = (id) => {
    const updated = goals.filter(g=>g.id!==id);
    setGoals(updated); queueSave({ fp_goals: JSON.stringify(updated) });
  };

  // ── Period totals dismiss ───────────────────────────────
  const dismissPeriod = () => {
    setPeriodDismissed(true); queueSave({ fp_periodDismissed: '1' });
  };
  const restorePeriod = () => {
    setPeriodDismissed(false); queueSave({ fp_periodDismissed: '0' });
  };

  // ── Date picker ─────────────────────────────────────────
  const onDateChange = (event, selected) => {
    if (Platform.OS === 'android') setPicker(p=>({...p, show:false}));
    if (!selected || event.type === 'dismissed') return;
    if (picker.target === 'start') {
      setProjStart(selected);
      queueSave({ fp_proj_start: fmtDateKey(selected) });
    } else {
      setProjEnd(selected);
      queueSave({ fp_proj_end: fmtDateKey(selected) });
    }
  };
  const pickerValue = () => (picker.target === 'start' ? projStart : projEnd) || new Date();

  const toggle = key => setOpen(p=>({...p,[key]:!p[key]}));

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor:c.bgBase }]}>
        <ActivityIndicator color={c.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex:1, backgroundColor:c.bgBase }}>
      {saved && (
        <View style={[s.savedBadge, { backgroundColor:c.greenGlow, borderColor:c.green }]}>
          <Text style={[s.savedText, { color:c.green, fontFamily:MONO }]}>✓ Saved</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── 1. Income ─────────────────────────────── */}
        <SecHeader title="Income — Jobs" open={open.income} onToggle={()=>toggle('income')} c={c} />
        {open.income && (
          <>
            {jobs.map(job => (
              <JobCard key={job.id} job={job} c={c} onSave={saveJob} onRemove={()=>removeJob(job.id)} />
            ))}
            <DashedAdd label="+ Add Job" c={c} onPress={addJob} />

            <Text style={[s.subTitle, { color:c.textMuted, fontFamily:MONO }]}>PAY PERIODS</Text>
            <View style={s.metRow}>
              <MetCard label="Weekly Gross"   value={fmt(wkGross)}    c={c} />
              <MetCard label="Weekly Net"     value={fmt(wkNet)}      color={c.green} sub="FICA + PA" c={c} />
              <MetCard label="Biweekly Gross" value={fmt(wkGross*2)}  c={c} />
              <MetCard label="Biweekly Net"   value={fmt(wkNet*2)}    color={c.green} c={c} />
              <MetCard label="Monthly Gross"  value={fmt(moGross)}    c={c} />
              <MetCard label="Monthly Net"    value={fmt(moNet)}      color={c.green} c={c} />
            </View>

            {/* Period totals (dismissable) */}
            {!periodDismissed ? (
              <View style={[s.card, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
                <View style={s.periodHead}>
                  <Text style={[s.subTitle, { color:c.textMuted, fontFamily:MONO, marginTop:0 }]}>PERIOD TOTALS</Text>
                  <TouchableOpacity onPress={dismissPeriod}>
                    <Text style={{ color:c.textMuted, fontSize:16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.metRow}>
                  <MetCard label="Gross Earnings" value={fmt(totGross)}        c={c} />
                  <MetCard label="Taxes (10.72%)" value={fmt(totTax)}          color={c.amber} c={c} />
                  <MetCard label="Take-home"       value={fmt(totNet)}          color={c.green} c={c} />
                  <MetCard label="+ $1,100 saved"  value={fmt(totNet+SAVINGS)} color={c.green} c={c} />
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={restorePeriod} style={{ marginTop:6 }}>
                <Text style={[s.restoreNote, { color:c.textMuted, fontFamily:MONO }]}>Period totals hidden — tap to restore.</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── 2. Fixed Expenses ─────────────────────── */}
        <SecHeader title="Fixed Expenses" open={open.expenses} onToggle={()=>toggle('expenses')} c={c} />
        {open.expenses && (
          <>
            {expenses.map(exp => (
              <ExpenseCard key={exp.id} expense={exp} c={c} onSave={saveExpense} onComplete={completeExpense} />
            ))}
            <DashedAdd label="+ Add Expense" c={c} onPress={addExpense} />

            {/* Completed / paid off */}
            {completedExpenses.length > 0 && (
              <>
                <Text style={[s.subTitle, { color:c.textMuted, fontFamily:MONO }]}>COMPLETED / PAID OFF</Text>
                {completedExpenses.map(exp => (
                  <View key={exp.id} style={[s.completedRow, { backgroundColor:c.bgCard, borderColor:c.borderSubtle, opacity:0.55 }]}>
                    <Text style={[s.completedTxt, { color:c.textMuted, fontFamily:MONO }]}>{exp.name} — {fmt(exp.amount)}</Text>
                    <TouchableOpacity onPress={()=>restoreExpense(exp.id)}>
                      <Text style={[s.restoreBtn, { color:c.green, fontFamily:MONO }]}>↩ restore</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {/* Expense metrics */}
            <View style={s.metRow}>
              <MetCard label="Total Expenses" value={fmt(expTotal)} color={c.amber}   c={c} />
              <MetCard label="Equipment"      value={fmt(expEquip)} color={c.purple}  c={c} />
              <MetCard label="Recurring/misc" value={fmt(expMisc)}                    c={c} />
            </View>

            {/* Category bars */}
            <Text style={[s.subTitle, { color:c.textMuted, fontFamily:MONO }]}>EXPENSE BREAKDOWN</Text>
            <View style={[s.card, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
              {Object.entries(catTotals)
                .filter(([,v])=>v>0)
                .sort((a,b)=>b[1]-a[1])
                .map(([cat,val]) => (
                  <BarRow key={cat} label={cat} value={fmt(val)} pct={expTotal>0?(val/expTotal)*100:0} color={CAT_COLOR[cat]||'#aaa'} c={c} />
                ))}
            </View>
          </>
        )}

        {/* ── 3. Earnings Projection ────────────────── */}
        <SecHeader title="Earnings Projection" open={open.projection} onToggle={()=>toggle('projection')} c={c} />
        {open.projection && (
          <View style={[s.card, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
            <View style={s.projDateRow}>
              <View style={{ flex:1, marginRight:8 }}>
                <FLabel label="From" c={c} />
                <TouchableOpacity style={[s.dtBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]}
                  onPress={()=>setPicker({show:true, target:'start'})}>
                  <Text style={[s.dtTxt, { color:projStart?c.textPrimary:c.textMuted, fontFamily:MONO }]}>{fmtDateDisp(projStart)}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex:1, marginLeft:8 }}>
                <FLabel label="To" c={c} />
                <TouchableOpacity style={[s.dtBtn, { borderColor:c.borderSubtle, backgroundColor:c.bgBase }]}
                  onPress={()=>setPicker({show:true, target:'end'})}>
                  <Text style={[s.dtTxt, { color:projEnd?c.textPrimary:c.textMuted, fontFamily:MONO }]}>{fmtDateDisp(projEnd)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {projData ? (
              <>
                <View style={s.metRow}>
                  <MetCard label="Weeks"          value={projData.weeks.toFixed(1)}         c={c} />
                  <MetCard label="Gross"           value={fmt(projData.pGross)}              c={c} />
                  <MetCard label="Taxes (10.72%)"  value={fmt(projData.pTax)}  color={c.amber} c={c} />
                  <MetCard label="Take-home"        value={fmt(projData.pNet)}  color={c.green} c={c} />
                  <MetCard label="After expenses"   value={fmts(projData.afterEx)} color={projData.afterEx>=0?c.green:c.red} c={c} />
                </View>
                <Text style={[s.projNote, { color:c.textMuted, fontFamily:MONO }]}>
                  {projData.weeks.toFixed(1)} weeks · {fmt(wkGross)}/wk gross · {fmt(expTotal)} in expenses
                </Text>
              </>
            ) : (
              <Text style={[s.projNote, { color:c.textMuted, fontFamily:MONO }]}>
                Set a date range to project earnings from current job cards.
              </Text>
            )}
          </View>
        )}

        {/* Date picker */}
        {picker.show && Platform.OS === 'android' && (
          <DateTimePicker value={pickerValue()} mode="date" display="default" onChange={onDateChange} />
        )}
        {picker.show && Platform.OS === 'ios' && (
          <Modal transparent animationType="slide">
            <View style={s.modalOverlay}>
              <View style={[s.modalSheet, { backgroundColor:c.bgCard, borderColor:c.borderSubtle }]}>
                <TouchableOpacity onPress={()=>setPicker(p=>({...p,show:false}))} style={s.doneBtn}>
                  <Text style={[s.doneTxt, { color:c.blue, fontFamily:MONO }]}>Done</Text>
                </TouchableOpacity>
                <DateTimePicker value={pickerValue()} mode="date" display="spinner" onChange={onDateChange} textColor={c.textPrimary} />
              </View>
            </View>
          </Modal>
        )}

        {/* ── 4. Repayment Schedules ─────────────────── */}
        <SecHeader title="Purchase Repayment Schedules" open={open.repay} onToggle={()=>toggle('repay')} c={c} />
        {open.repay && (
          <>
            {schedules.map(sched => (
              <ScheduleCard key={sched.id} schedule={sched} c={c} onSave={saveSchedule} onRemove={()=>removeSchedule(sched.id)} />
            ))}
            <DashedAdd label="+ Add Purchase Schedule" c={c} onPress={addSchedule} />
          </>
        )}

        {/* ── 5. Goals & Progress ───────────────────── */}
        <SecHeader
          title="Goals & Progress"
          open={open.goals}
          onToggle={()=>toggle('goals')}
          c={c}
          rightEl={
            <TouchableOpacity style={[s.addGoalBtn, { backgroundColor:c.greenGlow, borderColor:c.green }]} onPress={e=>{ e.stopPropagation?.(); addGoal(); }}>
              <Text style={[s.addGoalTxt, { color:c.green, fontFamily:MONO }]}>+ Goal</Text>
            </TouchableOpacity>
          }
        />
        {open.goals && (
          <>
            {goals.map(goal => (
              <GoalCard key={goal.id} goal={goal} c={c} onSave={saveGoal} onRemove={()=>removeGoal(goal.id)} />
            ))}
            {goals.length === 0 && (
              <DashedAdd label="+ Add Goal" c={c} onPress={addGoal} />
            )}
          </>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:     { flex:1, alignItems:'center', justifyContent:'center' },
  scroll:       { padding:14, paddingBottom:60 },
  metRow:       { flexDirection:'row', flexWrap:'wrap', marginVertical:4 },
  card:         { borderWidth:1, borderRadius:10, padding:14, marginBottom:6 },
  subTitle:     { fontSize:9, fontWeight:'600', letterSpacing:1, marginTop:14, marginBottom:6 },
  periodHead:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  restoreNote:  { fontSize:11, textDecorationLine:'underline' },
  completedRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:6, marginBottom:4 },
  completedTxt: { fontSize:12, textDecorationLine:'line-through' },
  restoreBtn:   { fontSize:10, fontWeight:'600' },
  projDateRow:  { flexDirection:'row', alignItems:'flex-end' },
  dtBtn:        { borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:8 },
  dtTxt:        { fontSize:12 },
  projNote:     { fontSize:10, lineHeight:16, marginTop:8 },
  addGoalBtn:   { borderWidth:1, borderRadius:14, paddingHorizontal:10, paddingVertical:3 },
  addGoalTxt:   { fontSize:10, fontWeight:'600' },
  savedBadge:   { position:'absolute', bottom:16, right:16, zIndex:99, borderWidth:1, borderRadius:20, paddingHorizontal:14, paddingVertical:5 },
  savedText:    { fontSize:11, fontWeight:'600' },
  modalOverlay: { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.4)' },
  modalSheet:   { borderTopWidth:1, borderTopLeftRadius:16, borderTopRightRadius:16, paddingBottom:24 },
  doneBtn:      { alignItems:'flex-end', paddingHorizontal:20, paddingTop:14, paddingBottom:4 },
  doneTxt:      { fontSize:15, fontWeight:'600' },
});
