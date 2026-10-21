export const GROUPS = [
 {name:'自分を好きになりたいとき',short:'自分を好きになりたい',theme:'morning',symbol:'heart',phrases:['私は、今の自分にも優しくできますように。','私は、完璧でなくても自分を大切にできますように。','私は、自分の良いところに気づけますように。']},
 {name:'人と比較して落ち込むとき',short:'人と比べて落ち込む',theme:'forest',symbol:'leaf',phrases:['私は、他人と比べず、自分の歩みを大切にできますように。','私は、誰かの幸せを喜び、自分の幸せも大切にできますように。','私は、自分のペースで成長できますように。']},
 {name:'人の視線や評価が気になるとき',short:'まわりの目が気になる',theme:'mountain',symbol:'spark',phrases:['私は、人の評価にとらわれず、安心して過ごせますように。','私は、緊張している自分にも優しくできますように。','私は、ありのままの自分で人と接することができますように。']},
 {name:'心を穏やかにしたいとき',short:'心を穏やかにしたい',theme:'water',symbol:'moon',phrases:['私は、心穏やかに過ごせますように。','私は、不安や苦しみから少しずつ自由になれますように。','私は、安心と喜びを感じられますように。']}
];
export const THEMES=[['morning','朝のやさしい光'],['mountain','山の絶景'],['flight','飛行機の空の上'],['sunset','ビーチの夕焼け'],['forest','森の木漏れ日'],['water','水辺の静けさ'],['night','夜の月と星空']];
export const KEY='shiawase-switch-v2';
export const LEGACY_KEYS=['shiawase-switch-v1','kokoro-garden-v1'];
export const defaults=()=>({version:2,theme:'morning',category:3,duration:5,auto:false,interval:30,speak:false,rate:0.8,onlyFavorites:false,favorites:[],custom:[]});
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
export const newId=()=>`custom-${globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2)}`;
export function normalize(raw,strict=false){
 if(!object(raw))throw Error('保存データの形式が正しくありません。');
 const d=defaults(),s={...d};
 for(const k of ['auto','speak','onlyFavorites'])if(typeof raw[k]==='boolean')s[k]=raw[k];
 if(THEMES.some(t=>t[0]===raw.theme))s.theme=raw.theme;
 if(Number.isInteger(raw.category)&&raw.category>=0&&raw.category<4)s.category=raw.category;
 if([3,5,10].includes(raw.duration))s.duration=raw.duration;
 if([15,30,45,60].includes(raw.interval))s.interval=raw.interval;
 if(Number.isFinite(raw.rate)&&raw.rate>=0.6&&raw.rate<=1.2)s.rate=Math.round(raw.rate*10)/10;
 const seen=new Set();
 if(raw.custom!==undefined&&!Array.isArray(raw.custom)&&strict)throw Error('マイフレーズの形式が正しくありません。');
 for(const c of Array.isArray(raw.custom)?raw.custom:[]){
  if(!object(c)||typeof c.text!=='string'||!c.text.trim()) {if(strict)throw Error('空のフレーズは取り込めません。');continue;}
  if(strict&&(c.text.trim().length>500||!Number.isInteger(c.category)||c.category<0||c.category>3))throw Error('フレーズは500文字以内、カテゴリーは0〜3で指定してください。');
  let id=typeof c.id==='string'&&c.id&&!c.id.startsWith('base-')?c.id:newId();
  if(seen.has(id))id=newId();
  seen.add(id);
  // Existing long phrases are preserved. Limits apply only to new edits/imports.
  s.custom.push({id,text:c.text.trim(),category:Number.isInteger(c.category)&&c.category>=0&&c.category<4?c.category:3});
 }
 if(strict&&raw.favorites!==undefined&&(!Array.isArray(raw.favorites)||raw.favorites.some(x=>typeof x!=='string')))throw Error('お気に入りの形式が正しくありません。');
 s.favorites=[...new Set((Array.isArray(raw.favorites)?raw.favorites:[]).filter(x=>typeof x==='string'))];
 return s;
}
export function phrases(s){return GROUPS.flatMap((g,c)=>g.phrases.map((text,i)=>({id:`base-${c}-${i}`,category:c,text}))).concat(s.custom);}
export function playlist(s){return phrases(s).filter(p=>s.onlyFavorites?s.favorites.includes(p.id):p.category===s.category);}
export function loadState(storage){
 const warnings=[];let blocked=false;
 try{
  for(const key of [KEY,...LEGACY_KEYS]){
   const raw=storage.getItem(key);if(raw===null)continue;
   try{return {state:normalize(JSON.parse(raw)),warnings,blocked,source:key};}
   catch{warnings.push(`${key} のデータを読み込めませんでした。元データは保持しています。`);if(key===KEY)blocked=true;}
  }
 }catch{blocked=true;warnings.push('端末への保存が利用できません。変更はこの画面内だけに保持されます。');}
 return {state:defaults(),warnings,blocked,source:null};
}
export function saveState(storage,state,blocked=false){
 if(blocked)return {ok:false,message:'元の保存データを保護中です。データを書き出して保管してください。'};
 try{
  const before=storage.getItem(KEY);
  if(before)storage.setItem(KEY+'-backup',before);
  storage.setItem(KEY,JSON.stringify(state));
  return {ok:true};
 }catch{return {ok:false,message:'保存できませんでした。画面内の変更は残っています。「データを書き出す」で保管してください。'};}
}
export function importState(text){
 const parsed=JSON.parse(text);
 const raw=parsed?.app==='shiawase-switch'?parsed.state:parsed;
 if(!object(raw)||!Array.isArray(raw.custom)||!Array.isArray(raw.favorites))throw Error('しあわせスイッチのバックアップを選んでください。');
 return normalize(raw,true);
}
export class MeditationTimer{
 constructor(minutes=5){this.reset(minutes);}
 reset(minutes){this.totalMs=minutes*60000;this.remainingMs=this.totalMs;this.running=false;this.endAt=0;this.lastAt=0;this.autoElapsed=0;}
 start(now){if(this.remainingMs<=0)this.remainingMs=this.totalMs;this.running=true;this.endAt=now+this.remainingMs;this.lastAt=now;}
 pause(now){this.tick(now,false,30);this.running=false;}
 tick(now,auto,seconds){
  if(!this.running)return {steps:0,finished:false};
  const elapsed=Math.max(0,Math.min(now,this.endAt)-this.lastAt);this.lastAt=now;
  this.remainingMs=Math.max(0,this.endAt-now);
  if(this.remainingMs===0){this.running=false;return {steps:0,finished:true};}
  let steps=0;if(auto){this.autoElapsed+=elapsed;steps=Math.floor(this.autoElapsed/(seconds*1000));this.autoElapsed%=seconds*1000;}
  return {steps,finished:false};
 }
 snapshot(){return {totalMs:this.totalMs,remainingMs:this.remainingMs,running:this.running,endAt:this.endAt,lastAt:this.lastAt,autoElapsed:this.autoElapsed};}
 restore(x){
  if(!object(x)||![180000,300000,600000].includes(x.totalMs)||!Number.isFinite(x.remainingMs)||x.remainingMs<0||x.remainingMs>x.totalMs||typeof x.running!=='boolean'||!Number.isFinite(x.endAt)||!Number.isFinite(x.lastAt)||!Number.isFinite(x.autoElapsed)||x.autoElapsed<0)return false;
  if(x.running&&(x.endAt<=0||x.lastAt<=0||x.endAt<x.lastAt||x.endAt-x.lastAt>x.totalMs))return false;
  for(const key of ['totalMs','remainingMs','running','endAt','lastAt','autoElapsed'])this[key]=x[key];return true;
 }
}
export function clock(ms){const n=Math.ceil(Math.max(0,ms)/1000);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
