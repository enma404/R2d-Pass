import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert, KeyboardAvoidingView, Linking, Platform,
  Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Switch,
  Text, TextInput, View
} from 'react-native';
import {NativeModules} from 'react-native';

const {R2dSecurity} = NativeModules;
const SUPPORT_URL = 'https://www.instagram.com/r2d.rabbit?stkn=ZDIyZjg2OXI1YmUx';
const RED = '#E50914';
const APPS = [
  ['Instagram','◎'],['Facebook','f'],['TikTok','♪'],['Telegram','➤'],['Discord','◉'],
  ['Steam','S'],['WhatsApp','◔'],['LinkedIn','in'],['GitHub','◆'],['Other','＋']
];
const emptyVault = () => ({apps: [], emails: []});
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

function t(lang, en, ar) { return lang === 'ar' ? ar : en; }

export default function App() {
  const [lang,setLang] = useState('en');
  const [theme,setTheme] = useState('dark');
  const [screen,setScreen] = useState('auth');
  const [hasVault,setHasVault] = useState(false);
  const [master,setMaster] = useState('');
  const [confirm,setConfirm] = useState('');
  const [vault,setVault] = useState(emptyVault());
  const [authMode,setAuthMode] = useState('create');
  const [selectedApp,setSelectedApp] = useState('Instagram');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [showPassword,setShowPassword] = useState(false);
  const [emailToAdd,setEmailToAdd] = useState('');
  const [upper,setUpper] = useState(true), [lower,setLower] = useState(true);
  const [numbers,setNumbers] = useState(true), [symbols,setSymbols] = useState(true);
  const [length,setLength] = useState(16), [generated,setGenerated] = useState('');
  const [search,setSearch] = useState('');
  const dark = theme === 'dark';
  const rtl = lang === 'ar';
  const C = useMemo(() => ({
    bg: dark ? '#08090B' : '#F5F5F7', card: dark ? '#141518' : '#FFFFFF',
    border: dark ? '#292B30' : '#E4E4E8', text: dark ? '#F7F7F8' : '#17181B',
    muted: dark ? '#A3A5AD' : '#666870', input: dark ? '#101114' : '#FFFFFF'
  }), [dark]);

  useEffect(() => {
    let mounted = true;
    if (!R2dSecurity || typeof R2dSecurity.hasVault !== 'function') {
      setHasVault(false);
      setAuthMode('create');
      return () => { mounted = false; };
    }
    Promise.resolve()
      .then(() => R2dSecurity.hasVault())
      .then(x => {
        if (!mounted) return;
        const exists = Boolean(x);
        setHasVault(exists);
        setAuthMode(exists ? 'unlock' : 'create');
      })
      .catch(() => {
        if (!mounted) return;
        setHasVault(false);
        setAuthMode('create');
      });
    return () => { mounted = false; };
  }, []);

  const saveVault = async next => {
    if (!R2dSecurity || typeof R2dSecurity.saveVault !== 'function') {
      throw new Error('Security module unavailable');
    }
    const safeNext = {
      apps: Array.isArray(next?.apps) ? next.apps : [],
      emails: Array.isArray(next?.emails) ? next.emails : []
    };
    await R2dSecurity.saveVault(JSON.stringify(safeNext));
    setVault(safeNext);
  };

  const createAccount = async () => {
    if (!R2dSecurity || typeof R2dSecurity.createVault !== 'function') {
      return Alert.alert(t(lang,'Error','خطأ'), t(lang,'Security module is unavailable. Rebuild the Android app.','وحدة الحماية غير متاحة. أعد بناء تطبيق Android.'));
    }
    if (master.length < 8) return Alert.alert(t(lang,'Error','خطأ'), t(lang,'Use at least 8 characters.','استخدم 8 أحرف على الأقل.'));
    if (master !== confirm) return Alert.alert(t(lang,'Error','خطأ'), t(lang,'Passwords do not match.','كلمتا السر غير متطابقتين.'));
    try {
      const initial = emptyVault();
      await R2dSecurity.createVault(master, JSON.stringify(initial));
      setVault(initial); setHasVault(true); setScreen('home'); setAuthMode('unlock'); setMaster(''); setConfirm('');
    } catch {
      Alert.alert(t(lang,'Error','خطأ'), t(lang,'Could not create the vault.','تعذر إنشاء الخزنة.'));
    }
  };

  const unlock = async () => {
    if (!R2dSecurity || typeof R2dSecurity.unlockVault !== 'function') {
      return Alert.alert(t(lang,'Error','خطأ'), t(lang,'Security module is unavailable. Rebuild the Android app.','وحدة الحماية غير متاحة. أعد بناء تطبيق Android.'));
    }
    if (!master) return Alert.alert(t(lang,'Access denied','تم رفض الدخول'), t(lang,'Enter your master password.','أدخل كلمة السر الرئيسية.'));
    try {
      const raw = await R2dSecurity.unlockVault(master);
      if (typeof raw !== 'string' || !raw.trim()) throw new Error('Empty vault');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.apps) || !Array.isArray(parsed.emails)) {
        throw new Error('Invalid vault format');
      }
      setVault({apps: parsed.apps, emails: parsed.emails});
      setScreen('home'); setMaster('');
    } catch {
      Alert.alert(t(lang,'Access denied','تم رفض الدخول'), t(lang,'Incorrect master password or corrupted vault data.','كلمة السر غير صحيحة أو بيانات الخزنة تالفة.'));
    }
  };

  const generate = async () => {
    try {
      if (!R2dSecurity || typeof R2dSecurity.randomPassword !== 'function') throw new Error('Security module unavailable');
      const out = await R2dSecurity.randomPassword(length, upper, lower, numbers, symbols);
      setGenerated(out); setPassword(out);
    } catch {
      Alert.alert(t(lang,'Error','خطأ'), t(lang,'Select at least one character type.','حدد نوعًا واحدًا على الأقل من الأحرف.'));
    }
  };

  const addApp = async () => {
    if (!email.trim() || !password) return Alert.alert(t(lang,'Missing data','بيانات ناقصة'), t(lang,'Enter an email and password.','أدخل البريد الإلكتروني وكلمة السر.'));
    try {
      const next = {...vault, apps:[...(Array.isArray(vault.apps) ? vault.apps : []),{id:uid(),app:selectedApp,email:email.trim(),password}]};
      await saveVault(next); setEmail(''); setPassword(''); setGenerated(''); setScreen('home');
    } catch {
      Alert.alert(t(lang,'Error','خطأ'), t(lang,'Could not save the password.','تعذر حفظ كلمة السر.'));
    }
  };
  const addEmail = async () => {
    if (!emailToAdd.trim()) return;
    try {
      await saveVault({...vault,emails:[...(Array.isArray(vault.emails) ? vault.emails : []),{id:uid(),email:emailToAdd.trim()}]});
      setEmailToAdd('');
    } catch {
      Alert.alert(t(lang,'Error','خطأ'), t(lang,'Could not save the email.','تعذر حفظ البريد الإلكتروني.'));
    }
  };

  const common = {C,rtl,lang,setLang,dark,theme,setTheme,go:setScreen};
  if (screen === 'auth') return <Auth {...common} hasVault={hasVault} mode={authMode} setMode={setAuthMode} master={master} setMaster={setMaster} confirm={confirm} setConfirm={setConfirm} create={createAccount} unlock={unlock}/>;
  if (screen === 'add') return <AddPassword {...common} selectedApp={selectedApp} setSelectedApp={setSelectedApp} email={email} setEmail={setEmail} password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} upper={upper} setUpper={setUpper} lower={lower} setLower={setLower} numbers={numbers} setNumbers={setNumbers} symbols={symbols} setSymbols={setSymbols} length={length} setLength={setLength} generated={generated} generate={generate} save={addApp}/>;
  if (screen === 'settings') return <Settings {...common}/>;
  return <Home {...common} vault={vault} search={search} setSearch={setSearch} emailToAdd={emailToAdd} setEmailToAdd={setEmailToAdd} addEmail={addEmail}/>;
}

function Brand({C,rtl,small=false}) { return <View style={{alignItems:'center',marginBottom:small?14:24}}><View style={[S.logo,{borderColor:RED}]}><Text style={S.logoMark}>r</Text></View><Text style={[S.brand,{color:RED,fontSize:small?23:29}]}>r2dpass</Text></View>; }
function Field({C,rtl,...p}) { return <TextInput {...p} placeholderTextColor={C.muted} style={[S.input,{backgroundColor:C.input,borderColor:C.border,color:C.text,textAlign:rtl?'right':'left'},p.style]}/>; }
function Primary({C,text,onPress}) { return <Pressable onPress={onPress} style={S.primary}><Text style={S.primaryText}>{text}</Text></Pressable>; }
function Top({C,rtl,title,go}) { return <View style={[S.top,{flexDirection:rtl?'row-reverse':'row'}]}><Text style={[S.title,{color:C.text,textAlign:rtl?'right':'left'}]}>{title}</Text><Pressable onPress={()=>go('settings')}><Text style={[S.topIcon,{color:C.muted}]}>⚙</Text></Pressable></View>; }
function Bottom({C,rtl,screen,go}) { return <View style={[S.bottom,{backgroundColor:C.card,borderColor:C.border,flexDirection:rtl?'row-reverse':'row'}]}>{[['home','⌂'],['add','＋'],['settings','⚙']].map(([id,icon])=><Pressable key={id} onPress={()=>go(id)} style={S.bottomItem}><Text style={[S.bottomIcon,{color:screen===id?RED:C.muted}]}>{icon}</Text></Pressable>)}</View>; }
function Auth({C,rtl,lang,setLang,hasVault,mode,setMode,master,setMaster,confirm,setConfirm,create,unlock}) { return <SafeAreaView style={[S.root,{backgroundColor:C.bg}]}><StatusBar barStyle={C.bg==='#08090B'?'light-content':'dark-content'}/><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={S.root}><ScrollView contentContainerStyle={S.auth}><Brand C={C} rtl={rtl}/><Text style={[S.title,{color:C.text,textAlign:'center'}]}>{mode==='create'?t(lang,'Create Admin Account','إنشاء حساب Admin'):t(lang,'Unlock r2dpass','فتح r2dpass')}</Text><Text style={[S.muted,{color:C.muted,textAlign:'center'}]}>{t(lang,'Your vault is encrypted locally.','خزنتك مشفّرة محليًا على جهازك.')}</Text><View style={{height:20}}/><Field C={C} rtl={rtl} value={master} onChangeText={setMaster} placeholder={t(lang,'Master password','كلمة السر الرئيسية')} secureTextEntry/>{mode==='create' && <Field C={C} rtl={rtl} value={confirm} onChangeText={setConfirm} placeholder={t(lang,'Confirm master password','تأكيد كلمة السر')} secureTextEntry/>}{mode==='create'?<Primary C={C} text={t(lang,'Create secure vault','إنشاء خزنة آمنة')} onPress={create}/>:<Primary C={C} text={t(lang,'Unlock vault','فتح الخزنة')} onPress={unlock}/>} {hasVault&&<Pressable onPress={()=>setMode(mode==='create'?'unlock':'create')}><Text style={S.link}>{mode==='create'?t(lang,'I already have an account','لدي حساب بالفعل'):t(lang,'Create a new vault','إنشاء خزنة جديدة')}</Text></Pressable>}<Language lang={lang} setLang={setLang} C={C}/></ScrollView></KeyboardAvoidingView></SafeAreaView>; }
function Language({lang,setLang,C}) { return <View style={S.lang}><Pressable onPress={()=>setLang('en')}><Text style={[S.langText,{color:lang==='en'?RED:C.muted}]}>English</Text></Pressable><Text style={{color:C.muted}}>•</Text><Pressable onPress={()=>setLang('ar')}><Text style={[S.langText,{color:lang==='ar'?RED:C.muted}]}>العربية</Text></Pressable></View>; }
function AddPassword(p) { const {C,rtl,lang,go,selectedApp,setSelectedApp,email,setEmail,password,setPassword,showPassword,setShowPassword,upper,setUpper,lower,setLower,numbers,setNumbers,symbols,setSymbols,length,setLength,generate,save}=p; return <SafeAreaView style={[S.root,{backgroundColor:C.bg}]}><Top C={C} rtl={rtl} title={t(lang,'Add password','إضافة كلمة سر')} go={go}/><ScrollView contentContainerStyle={S.content}><Text style={[S.section,{color:C.text,textAlign:rtl?'right':'left'}]}>{t(lang,'Application','التطبيق')}</Text><View style={S.grid}>{APPS.map(([name,icon])=><Pressable key={name} onPress={()=>setSelectedApp(name)} style={[S.app,{backgroundColor:selectedApp===name?RED:C.card,borderColor:selectedApp===name?RED:C.border}]}><Text style={[S.appIcon,{color:selectedApp===name?'#fff':RED}]}>{icon}</Text><Text style={[S.appName,{color:selectedApp===name?'#fff':C.text}]}>{name}</Text></Pressable>)}</View><Field C={C} rtl={rtl} value={email} onChangeText={setEmail} placeholder={t(lang,'Email address','البريد الإلكتروني')}/><View><Field C={C} rtl={rtl} value={password} onChangeText={setPassword} placeholder={t(lang,'Password','كلمة السر')} secureTextEntry={!showPassword}/><Pressable onPress={()=>setShowPassword(!showPassword)} style={S.eye}><Text style={{color:C.muted}}>{showPassword?'Hide':'Show'}</Text></Pressable></View><Text style={[S.section,{color:C.text,textAlign:rtl?'right':'left',marginTop:14}]}>{t(lang,'Password generator','مولّد كلمة السر')}</Text>{[['Uppercase',upper,setUpper],['Lowercase',lower,setLower],['Numbers',numbers,setNumbers],['Symbols',symbols,setSymbols]].map(([n,v,set])=><View key={n} style={[S.option,{flexDirection:rtl?'row-reverse':'row'}]}><Text style={{color:C.text}}>{t(lang,n,n==='Uppercase'?'حروف كبيرة':n==='Lowercase'?'حروف صغيرة':n==='Numbers'?'أرقام':'رموز')}</Text><Switch value={v} onValueChange={set} trackColor={{true:RED,false:C.border}} thumbColor={v?'#fff':C.muted}/></View>)}<Text style={[S.label,{color:C.muted,textAlign:rtl?'right':'left'}]}>{t(lang,'Password length','طول كلمة السر')}: {length}</Text><CoreSlider value={length} min={8} max={32} onChange={setLength} C={C}/><Pressable style={[S.secondary,{borderColor:RED}]} onPress={generate}><Text style={{fontSize:20,color:RED}}>⟳</Text><Text style={{color:RED,fontWeight:'900'}}>{t(lang,'Generate password','إنشاء كلمة سر')}</Text></Pressable><Primary C={C} text={t(lang,'Save password','حفظ كلمة السر')} onPress={save}/></ScrollView><Bottom {...p} screen="add"/></SafeAreaView>; }
function CoreSlider({value,min,max,onChange,C}) { const widthRef = React.useRef(0); const update = e => { if (widthRef.current <= 0) return; const x=Math.max(0,Math.min(widthRef.current,e.nativeEvent.locationX)); onChange(Math.round(min+(max-min)*(x/widthRef.current))); }; return <View onLayout={e=>{widthRef.current=e.nativeEvent.layout.width}} style={[S.slider,{backgroundColor:C.border}]}><View style={[S.sliderFill,{width:`${((value-min)/(max-min))*100}%`}]} /><Pressable onPress={update} style={S.sliderTouch}><View style={[S.thumb,{left:`${((value-min)/(max-min))*100}%`}]} /></Pressable></View>; }
function Home({C,rtl,lang,go,vault,search,setSearch,emailToAdd,setEmailToAdd,addEmail}) { const filtered=vault.apps.filter(x=>`${x.app} ${x.email}`.toLowerCase().includes(search.toLowerCase())); return <SafeAreaView style={[S.root,{backgroundColor:C.bg}]}><Top C={C} rtl={rtl} title="r2dpass" go={go}/><ScrollView contentContainerStyle={S.content}><View style={[S.hero,{backgroundColor:C.card,borderColor:C.border}]}><View><Text style={[S.heroTitle,{color:C.text,textAlign:rtl?'right':'left'}]}>{t(lang,'Your vault','خزنتك')}</Text><Text style={[S.muted,{color:C.muted,textAlign:rtl?'right':'left'}]}>{vault.apps.length} {t(lang,'passwords saved','كلمة سر محفوظة')}</Text></View><Pressable onPress={()=>go('add')} style={S.addCircle}><Text style={{color:'#fff',fontSize:26}}>＋</Text></Pressable></View><Field C={C} rtl={rtl} value={search} onChangeText={setSearch} placeholder={t(lang,'Search passwords...','ابحث في كلمات السر...')}/><View style={[S.row,{flexDirection:rtl?'row-reverse':'row'}]}><Text style={[S.section,{color:C.text}]}>{t(lang,'Applications','التطبيقات')}</Text><Text style={[S.count,{color:C.muted}]}>{filtered.length}</Text></View>{filtered.length?filtered.map(e=><VaultCard key={e.id} e={e} C={C} rtl={rtl}/>):<Empty C={C} text={t(lang,'No saved passwords yet.','لا توجد كلمات سر محفوظة بعد.')}/>}<View style={[S.row,{flexDirection:rtl?'row-reverse':'row',marginTop:22}]}><Text style={[S.section,{color:C.text}]}>{t(lang,'Emails','البريد الإلكتروني')}</Text><Text style={[S.count,{color:C.muted}]}>{vault.emails.length}</Text></View><View style={[S.emailAdd,{backgroundColor:C.card,borderColor:C.border,flexDirection:rtl?'row-reverse':'row'}]}><Field C={C} rtl={rtl} value={emailToAdd} onChangeText={setEmailToAdd} placeholder={t(lang,'Add email address','أضف عنوان بريد')} style={{flex:1,marginBottom:0,borderWidth:0}}/><Pressable onPress={addEmail} style={S.smallAdd}><Text style={{color:'#fff',fontSize:22}}>＋</Text></Pressable></View>{vault.emails.map(e=><View key={e.id} style={[S.emailCard,{backgroundColor:C.card,borderColor:C.border,flexDirection:rtl?'row-reverse':'row'}]}><Text style={S.emailIcon}>@</Text><Text style={[S.emailText,{color:C.text,textAlign:rtl?'right':'left'}]}>{e.email}</Text></View>)}</ScrollView><Bottom {...{C,rtl,lang,go}} screen="home"/></SafeAreaView>; }
function VaultCard({e,C,rtl}) { const [show,setShow]=useState(false); const icon=APPS.find(x=>x[0]===e.app)?.[1]||'＋'; return <View style={[S.vaultCard,{backgroundColor:C.card,borderColor:C.border,flexDirection:rtl?'row-reverse':'row'}]}><View style={S.appBadge}><Text style={S.appBadgeText}>{icon}</Text></View><View style={{flex:1}}><Text style={[S.cardTitle,{color:C.text,textAlign:rtl?'right':'left'}]}>{e.app}</Text><Text style={[S.cardEmail,{color:C.muted,textAlign:rtl?'right':'left'}]}>{e.email}</Text><Text style={[S.cardPass,{color:C.text,textAlign:rtl?'right':'left'}]}>{show?e.password:'••••••••••'}</Text></View><Pressable onPress={()=>setShow(!show)}><Text style={{color:C.muted,fontSize:19}}>{show?'◉':'◌'}</Text></Pressable></View>; }
function Empty({C,text}) { return <View style={S.empty}><Text style={{fontSize:36,color:C.muted}}>🔒</Text><Text style={[S.muted,{color:C.muted,textAlign:'center',marginTop:8}]}>{text}</Text></View>; }
function Settings({C,rtl,lang,setLang,theme,setTheme,go}) { return <SafeAreaView style={[S.root,{backgroundColor:C.bg}]}><Top C={C} rtl={rtl} title={t(lang,'Settings','الإعدادات')} go={go}/><ScrollView contentContainerStyle={S.content}><View style={[S.setting,{backgroundColor:C.card,borderColor:C.border,flexDirection:rtl?'row-reverse':'row'}]}><Text style={S.settingIcon}>◐</Text><Text style={[S.settingText,{color:C.text,textAlign:rtl?'right':'left'}]}>{t(lang,'Dark mode','الوضع الداكن')}</Text><Switch value={theme==='dark'} onValueChange={v=>setTheme(v?'dark':'light')} trackColor={{true:RED,false:C.border}} thumbColor={theme==='dark'?'#fff':C.muted}/></View><View style={[S.setting,{backgroundColor:C.card,borderColor:C.border,flexDirection:rtl?'row-reverse':'row'}]}><Text style={S.settingIcon}>文</Text><Text style={[S.settingText,{color:C.text,textAlign:rtl?'right':'left'}]}>{t(lang,'Language','اللغة')}</Text><Language lang={lang} setLang={setLang} C={C}/></View><Pressable onPress={()=>Linking.openURL(SUPPORT_URL)} style={[S.setting,{backgroundColor:C.card,borderColor:C.border,flexDirection:rtl?'row-reverse':'row'}]}><Text style={S.settingIcon}>◎</Text><Text style={[S.settingText,{color:C.text,textAlign:rtl?'right':'left'}]}>{t(lang,'Support on Instagram','الدعم عبر Instagram')}</Text><Text style={{color:C.muted}}>›</Text></Pressable><View style={[S.info,{backgroundColor:C.card,borderColor:C.border}]}><Text style={[S.infoTitle,{color:C.text,textAlign:rtl?'right':'left'}]}>r2dpass</Text><Text style={[S.muted,{color:C.muted,textAlign:rtl?'right':'left'}]}>{t(lang,'Local encrypted password manager','مدير كلمات سر محلي ومشفّر')}</Text></View></ScrollView><Bottom {...{C,rtl,lang,go}} screen="settings"/></SafeAreaView>; }

const S=StyleSheet.create({root:{flex:1},auth:{flexGrow:1,justifyContent:'center',padding:24},logo:{width:92,height:92,borderRadius:25,borderWidth:2,alignItems:'center',justifyContent:'center'},logoMark:{color:RED,fontSize:54,fontWeight:'900',fontStyle:'italic'},brand:{fontWeight:'900',marginTop:8},title:{fontSize:25,fontWeight:'900'},muted:{fontSize:14,lineHeight:21,marginTop:7},input:{height:54,borderWidth:1,borderRadius:13,paddingHorizontal:15,fontSize:16,marginBottom:11},primary:{height:54,borderRadius:13,backgroundColor:RED,alignItems:'center',justifyContent:'center',marginTop:5,marginBottom:13},primaryText:{color:'#fff',fontSize:16,fontWeight:'900'},link:{color:RED,fontWeight:'800',textAlign:'center',marginTop:3},lang:{flexDirection:'row',gap:10,alignItems:'center',justifyContent:'center',marginTop:22},langText:{fontWeight:'900'},top:{height:66,paddingHorizontal:20,alignItems:'center',justifyContent:'space-between'},topIcon:{fontSize:23},content:{padding:20,paddingBottom:100},section:{fontSize:19,fontWeight:'900',marginBottom:10},grid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:15},app:{width:'31%',minHeight:69,borderRadius:14,borderWidth:1,alignItems:'center',justifyContent:'center'},appIcon:{fontSize:25,fontWeight:'900'},appName:{fontSize:11,fontWeight:'800',marginTop:5},eye:{position:'absolute',right:14,top:16},option:{height:46,alignItems:'center',justifyContent:'space-between'},label:{fontSize:13,fontWeight:'800',marginTop:6},secondary:{height:50,borderWidth:1,borderRadius:13,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,marginVertical:10},slider:{height:5,borderRadius:5,position:'relative',marginVertical:13},sliderFill:{position:'absolute',left:0,top:0,bottom:0,backgroundColor:RED,borderRadius:5},sliderTouch:{position:'absolute',left:0,right:0,top:-15,bottom:-15},thumb:{position:'absolute',top:10,width:20,height:20,marginLeft:-10,borderRadius:10,backgroundColor:RED},bottom:{position:'absolute',left:0,right:0,bottom:0,height:64,borderTopWidth:1,alignItems:'center',justifyContent:'space-around'},bottomItem:{width:'33%',height:'100%',alignItems:'center',justifyContent:'center'},bottomIcon:{fontSize:25},hero:{borderWidth:1,borderRadius:17,padding:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14},heroTitle:{fontSize:21,fontWeight:'900'},addCircle:{width:48,height:48,borderRadius:24,backgroundColor:RED,alignItems:'center',justifyContent:'center'},row:{alignItems:'center',justifyContent:'space-between'},count:{fontWeight:'800',marginBottom:10},vaultCard:{borderWidth:1,borderRadius:16,padding:14,alignItems:'center',marginBottom:9,gap:12},appBadge:{width:48,height:48,borderRadius:14,backgroundColor:'#1D1F24',alignItems:'center',justifyContent:'center'},appBadgeText:{color:RED,fontSize:23,fontWeight:'900'},cardTitle:{fontSize:16,fontWeight:'900'},cardEmail:{fontSize:12,marginTop:2},cardPass:{fontFamily:Platform.OS==='ios'?'Menlo':'monospace',fontSize:13,marginTop:6},empty:{alignItems:'center',paddingVertical:28},emailAdd:{borderWidth:1,borderRadius:14,alignItems:'center',overflow:'hidden'},smallAdd:{height:54,width:52,backgroundColor:RED,alignItems:'center',justifyContent:'center'},emailCard:{borderWidth:1,borderRadius:14,padding:14,alignItems:'center',gap:12,marginTop:8},emailIcon:{width:34,height:34,borderRadius:10,backgroundColor:RED,color:'#fff',textAlign:'center',textAlignVertical:'center',fontWeight:'900',fontSize:20},emailText:{fontSize:14,fontWeight:'800',flex:1},setting:{minHeight:64,borderWidth:1,borderRadius:15,paddingHorizontal:15,alignItems:'center',gap:12,marginBottom:10},settingIcon:{fontSize:23,color:RED,width:30,textAlign:'center'},settingText:{fontSize:16,fontWeight:'800',flex:1},info:{borderWidth:1,borderRadius:15,padding:16,marginTop:8},infoTitle:{fontSize:17,fontWeight:'900'}});
