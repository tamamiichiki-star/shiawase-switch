import {GROUPS,THEMES,KEY,defaults,phrases,playlist,loadState,saveState,importState,newId,MeditationTimer,clock} from './core.js';
const $=id=>document.getElementById(id);
const paths={home:'m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9',list:'M8 6h12M8 12h12M8 18h12M3 6h.1M3 12h.1M3 18h.1',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',pen:'m15 4 5 5M4 20l4-1 13-13-4-4L4 15Z',settings:'M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',leaf:'M20 3C9 2 2 8 5 16c8 8 16-2 15-13ZM5 20 16 8',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',moon:'M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z',clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',volume:'m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',mute:'m11 4-6 5H2v6h3l6 5ZM16 9l6 6m0-6-6 6',play:'m8 4 12 8-12 8Z',pause:'M8 5v14M16 5v14',prev:'M5 5v14m14-14L7 12l12 7Z',next:'M19 5v14M5 5l12 7-12 7Z',back:'m15 5-7 7 7 7',arrow:'m9 5 7 7-7 7',auto:'M3 10a5 5 0 0 1 8-4l2 2m-2 8 2 2a5 5 0 1 0 0-8l-2 4a5 5 0 1 1-8-4',expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',check:'m5 12 4 4L19 6',shield:'m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5ZM8 11l3 3 5-5',reset:'M3 10a9 9 0 1 1 1 7M3 4v6h6',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',image:'M3 3h18v18H3ZM3 17l6-6 5 5 3-3 4 4M16 7h.1',stop:'M6 6h12v12H6Z'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.heart}"/></svg>`;
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storage;try{storage=localStorage;}catch{storage={getItem(){throw Error();},setItem(){throw Error();}};}
const loaded=loadState(storage);let state=loaded.state,blocked=loaded.blocked,view='home',index=0,immersive=false,editing=null,toastTimeout,filter='all',completed=false;
const timer=new MeditationTimer(state.duration);let currentVoice=null,voiceToken=0,audioArmed=false,waitingWorker=null;
const speechSupported='speechSynthesis'in window&&'SpeechSynthesisUtterance'in window;
const current=()=>playlist(state)[index]||playlist(state)[0];
const themeName=()=>THEMES.find(t=>t[0]===state.theme)[1];
const bg=()=>`background-image:url('./backgrounds/${state.theme}.webp')`;
function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').hidden=true,4300);}
function warn(text){$('storage-warning').textContent=text;$('storage-warning').hidden=false;}
function persist(){const r=saveState(storage,state,blocked);if(!r.ok)warn(r.message);saveSession();return r.ok;}
function saveSession(){try{sessionStorage.setItem(KEY+'-session',JSON.stringify({timer:timer.snapshot(),index,view,completed}));}catch{}}
function stopSpeech(){voiceToken++;if(speechSupported)speechSynthesis.cancel();}
function voices(){if(speechSupported)currentVoice=speechSynthesis.getVoices().find(v=>/^ja(?:-|_)/i.test(v.lang))||null;}
function readPhrase(){
 stopSpeech();if(!speechSupported||!state.speak||!audioArmed||!current()||document.hidden)return;
 const utterance=new SpeechSynthesisUtterance(current().text);utterance.lang='ja-JP';utterance.rate=state.rate;if(currentVoice)utterance.voice=currentVoice;
 const token=voiceToken;
 utterance.onerror=e=>{if(token===voiceToken&&!['interrupted','canceled'].includes(e.error))notify('読み上げを開始できません。「再読」を押すか、端末の日本語音声を確認してください。');};
 speechSynthesis.speak(utterance);
}
function toggleVoice(){if(!speechSupported)return;state.speak=!state.speak;audioArmed=true;persist();if(state.speak&&timer.running)readPhrase();else stopSpeech();render();}
function setView(next,focus=true){if(view==='player'&&next!=='player'&&timer.running)pauseTimer();view=next;immersive=false;render();saveSession();if(focus){window.scrollTo(0,0);$('main').focus({preventScroll:true});}}
function chooseCategory(c){pauseTimer();state.category=c;state.onlyFavorites=false;index=0;timer.reset(state.duration);completed=false;persist();render();notify(GROUPS[c].name+' を選びました');}
function startSession(id=null,favorites=false){
 if(id){const p=phrases(state).find(x=>x.id===id);if(!p)return;state.category=p.category;state.onlyFavorites=favorites;}
 else if(favorites)state.onlyFavorites=true;
 const list=playlist(state);if(!list.length){notify('お気に入りに言葉を追加してから始めましょう。');setView('favorites');return;}
 timer.reset(state.duration);index=id?Math.max(0,list.findIndex(p=>p.id===id)):0;completed=false;audioArmed=true;
 view='player';timer.start(Date.now());persist();render();readPhrase();window.scrollTo(0,0);$('main').focus({preventScroll:true});
}
function pauseTimer(){timer.pause(Date.now());stopSpeech();saveSession();}
function toggleTimer(){audioArmed=true;if(timer.running){pauseTimer();}else{if(!current())return;timer.start(Date.now());completed=false;readPhrase();}render();saveSession();}
function move(delta){const list=playlist(state);if(!list.length)return;index=(index+delta%list.length+list.length)%list.length;timer.autoElapsed=0;stopSpeech();renderPlayerPhrase();saveSession();if(timer.running)readPhrase();}
function favorite(id){
 const old=current()?.id;state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];
 if(state.onlyFavorites){const list=playlist(state);index=Math.max(0,list.findIndex(p=>p.id===old));if(!list.length){pauseTimer();view='favorites';}else if(old!==current()?.id){stopSpeech();if(timer.running)readPhrase();}}
 persist();if(view==='player')renderPlayerPhrase();else render();
}
function setDuration(n){pauseTimer();state.duration=n;timer.reset(n);completed=false;persist();render();}
function durationButtons(){return `<div class="segments" aria-label="瞑想時間">${[3,5,10].map(n=>`<button data-duration="${n}" class="${state.duration===n?'active':''}" aria-pressed="${state.duration===n}">${n}分</button>`).join('')}</div>`;}
function favoriteButton(p){const active=state.favorites.includes(p.id);return `<button class="icon-button ${active?'is-favorite':''}" data-favorite="${esc(p.id)}" aria-label="${active?'お気に入りから解除':'お気に入りに登録'}" aria-pressed="${active}">${icon('heart')}</button>`;}
function categoryCards(action){return `<div class="category-grid">${GROUPS.map((g,c)=>`<button class="category-card ${state.category===c&&!state.onlyFavorites?'selected':''}" data-${action}="${c}" aria-label="${g.name}" ${action==='category'?`aria-pressed="${state.category===c&&!state.onlyFavorites}"`:''}><img class="category-image" src="./backgrounds/${g.theme}.webp" alt="" loading="lazy">${state.category===c&&!state.onlyFavorites?'<span class="selected-mark" aria-hidden="true">✓</span>':''}<div class="category-detail"><span class="category-symbol">${icon(g.symbol)}</span><div><strong>${g.short}</strong><small>${phrases(state).filter(p=>p.category===c).length} フレーズ</small></div></div></button>`).join('')}</div>`;}
function home(){return `<div class="home-grid"><section class="hero" data-dark="${['night','forest'].includes(state.theme)}" style="${bg()}"><button class="scene-tag" data-view="settings">${icon('sun')}${themeName()}${icon('arrow')}</button><div class="hero-copy"><p class="tiny">A LITTLE KINDNESS, EVERY DAY</p><h1>こころに、<br>やさしい時間を。</h1><p>1日5分、<br>心にしあわせをチャージ</p></div><div class="hero-bottom"><button class="primary" data-action="start">しあわせをチャージする ♡</button><p class="small">${state.duration}分 · ${state.onlyFavorites?'お気に入りの言葉':GROUPS[state.category].short} · ${state.speak?'音声 ON':'音声 OFF'}</p></div></section><aside class="home-aside"><div class="eyebrow">HOW ARE YOU FEELING?</div><div class="section-heading"><div><h2>いまの気持ちに、寄りそう言葉</h2><p>気になるテーマを、ひとつ選んで。</p></div></div>${categoryCards('category')}<div class="quick-settings"><div class="setting-row"><span class="setting-label">${icon('clock')}今日の瞑想時間</span>${durationButtons()}</div><div class="setting-row"><span class="setting-label">${icon('volume')}やさしい音声で読み上げ</span><button class="pill" data-action="voice" aria-pressed="${state.speak}" ${speechSupported?'':'disabled'}>${state.speak?'ON':'OFF'}</button></div><div class="setting-row"><span class="setting-label">${icon('image')}好きな景色と一緒に</span><button class="text-link" data-view="settings">背景を選ぶ ${icon('arrow')}</button></div><div class="theme-strip">${THEMES.map(([id,label])=>`<button class="theme-dot ${id===state.theme?'active':''}" data-theme="${id}" aria-label="${label}" aria-pressed="${id===state.theme}"><img src="./backgrounds/${id}.webp" alt="" loading="lazy"></button>`).join('')}</div></div></aside></div><div class="home-note"><span>${icon('heart')}うまくできなくても、大丈夫。</span><span>${icon('leaf')}自分のペースで、少しずつ。</span><span>${icon('shield')}あなたの言葉は、この端末だけに。</span></div>`;}
function player(){
 if(completed)return `<section class="player completion" style="${bg()}"><div class="player-header"><button class="icon-button" data-view="home" aria-label="ホームへ">${icon('back')}</button><span>今日の、やさしいひと呼吸</span><span style="width:44px"></span></div><div class="phrase-card" style="margin:auto 0"><div class="complete-mark">${icon('heart')}</div><h1>おつかれさまでした。</h1><p style="font-size:18px">自分に向けたやさしさが、<br>今日のあなたに寄りそいますように。</p><span class="small">${state.duration}分の瞑想が終わりました。</span><button class="primary" data-view="home">ホームに戻る</button><button class="text-link" data-action="start">もう一度、チャージする</button></div></section>`;
 const p=current();if(!p){view='favorites';return favoritesPage();}
 return `<section class="player ${immersive?'immersive':''}" style="${bg()}"><div class="player-header"><button class="icon-button" data-view="home" aria-label="瞑想を一時停止してホームへ">${icon('back')}</button><span>${state.onlyFavorites?'お気に入りの言葉':GROUPS[state.category].name}</span><button class="icon-button" data-action="immersive" aria-label="${immersive?'操作を表示':'没入モード'}" aria-pressed="${immersive}">${icon('expand')}</button></div><div class="phrase-count" id="phrase-count"></div><div class="phrase-card"><p id="player-phrase" aria-live="polite"></p><div id="player-favorite"></div></div><p class="breath-hint">ゆっくり呼吸しながら、心の中で唱えてみましょう</p><div class="timer" role="timer" aria-label="残り時間"><span id="clock"></span><small>/ ${clock(timer.totalMs)}</small></div><progress id="progress" max="1" value="0" aria-label="瞑想の進み具合"></progress><div class="transport"><button class="icon-button" data-action="prev" aria-label="前のフレーズ">${icon('prev')}</button><button class="play" data-action="toggle" aria-label="${timer.running?'一時停止':'再開'}">${icon(timer.running?'pause':'play')}</button><button class="icon-button" data-action="next" aria-label="次のフレーズ">${icon('next')}</button></div><div class="player-options"><button data-action="auto" aria-pressed="${state.auto}">${icon('auto')}自動 ${state.auto?'ON':'OFF'}</button><button data-action="voice" aria-pressed="${state.speak}" ${speechSupported?'':'disabled'}>${icon(state.speak?'volume':'mute')}音声 ${state.speak?'ON':'OFF'}</button><button data-action="reread" ${speechSupported?'':'disabled'}>${icon('volume')}再読</button><button data-action="stopvoice" ${speechSupported?'':'disabled'}>${icon('stop')}音声停止</button></div><div class="player-subactions"><button data-action="reset">タイマーをリセット</button><button data-view="settings">時間・音声の設定</button><button data-view="home">終了する</button></div></section>`;
}
function renderPlayerPhrase(){
 if(view!=='player'||completed)return;const p=current();if(!p)return;
 if(!$('player-phrase')){render();return;}
 const text=$('player-phrase');if(text.textContent!==p.text){text.textContent=p.text;text.classList.remove('phrase-animate');void text.offsetWidth;text.classList.add('phrase-animate');}
 $('phrase-count').textContent=`${index+1} / ${playlist(state).length}`;$('player-favorite').innerHTML=favoriteButton(p);renderClock();
}
function renderClock(){if($('clock'))$('clock').textContent=clock(timer.remainingMs);if($('progress'))$('progress').value=1-timer.remainingMs/timer.totalMs;}
function phraseRow(p,fav=false){return `<div class="phrase-row"><button class="phrase-start" data-phrase="${esc(p.id)}" data-fav-play="${fav}">${fav?`<small>${GROUPS[p.category].name}</small>`:''}${esc(p.text)}</button>${favoriteButton(p)}</div>`;}
function phrasesPage(){const list=phrases(state);return `<section class="content-page"><div class="eyebrow">WORDS FOR YOUR HEART</div><div class="section-heading"><div><h1>こころに届く、言葉を。</h1><p>フレーズをタップすると、その言葉から瞑想を始めます。</p></div></div>${categoryCards('filter')}<div class="button-row" style="margin-top:20px"><button class="pill ${filter==='all'?'active':''}" data-filter="all">すべて</button><button class="pill ${filter==='favorites'?'active':''}" data-filter="favorites">♡ お気に入り</button></div>${filter==='favorites'?list.filter(p=>state.favorites.includes(p.id)).map(p=>phraseRow(p,true)).join('')||empty('まだ、お気に入りはありません','言葉の横の♡を押すと、ここに集まります。'):GROUPS.map((g,c)=>filter!=='all'&&Number(filter)!==c?'':`<section class="phrase-group"><h2><span class="category-symbol">${icon(g.symbol)}</span>${g.name}</h2>${list.filter(p=>p.category===c).map(p=>phraseRow(p)).join('')}</section>`).join('')}</section>`;}
function empty(title,message){return `<div class="empty">${icon('heart')}<h2>${title}</h2><p>${message}</p><button class="secondary" data-view="phrases">フレーズを探す ${icon('arrow')}</button></div>`;}
function favoritesPage(){const list=phrases(state).filter(p=>state.favorites.includes(p.id));return `<section class="content-page"><div class="eyebrow">YOUR FAVORITE WORDS</div><div class="section-heading"><div><h1>お気に入り</h1><p>何度でも帰ってきたい、あなたの言葉。${list.length}フレーズ</p></div></div>${list.length?`<button class="primary" data-action="favorites-start">${icon('play')}お気に入りだけで瞑想</button><div class="phrase-group">${list.map(p=>phraseRow(p,true)).join('')}</div>`:empty('まだ、お気に入りはありません','フレーズや瞑想画面の♡を押して、<br>あなたに寄りそう言葉を集めましょう。')}</section>`;}
function customPage(){return `<section class="content-page"><div class="eyebrow">A LETTER TO YOURSELF</div><h1>自分に贈る、やさしい言葉。</h1><p class="intro">いまのあなたが、聞きたい言葉を。<br>マイフレーズはカテゴリーに加わり、瞑想で使えます。</p><form id="custom-form" class="panel"><h2>${editing?'マイフレーズを編集':'マイフレーズを追加'}</h2><label class="field" for="custom-text">あなたの言葉<textarea id="custom-text" name="text" required maxlength="500" placeholder="私は、今日も自分のペースを大切にできますように。"></textarea></label><div class="small" id="character-count">0 / 500文字</div><label class="field" for="custom-category">カテゴリー<select id="custom-category" name="category">${GROUPS.map((g,c)=>`<option value="${c}">${g.name}</option>`).join('')}</select></label><p id="form-status" class="form-status" role="status"></p><div class="button-row"><button type="submit" class="primary">${editing?'変更を保存する':'この言葉を追加する'}</button>${editing?'<button type="button" class="secondary" data-action="cancel-edit">編集をやめる</button>':''}</div></form><h2 style="font-size:18px">あなたのマイフレーズ <span class="small">${state.custom.length}件</span></h2>${state.custom.length?`<div class="panel">${state.custom.map(p=>`<article class="custom-card"><small>${GROUPS[p.category].name}</small><p>${esc(p.text)}</p><div class="button-row"><button class="secondary" data-phrase="${esc(p.id)}">${icon('play')}この言葉で瞑想</button>${favoriteButton(p)}<button class="secondary" data-edit="${esc(p.id)}">編集</button><button class="secondary" data-delete="${esc(p.id)}">削除</button></div></article>`).join('')}</div>`:'<p class="small">まだマイフレーズはありません。ひとことから、気軽にどうぞ。</p>'}</section>`;}
function settingsPage(){return `<section class="content-page"><div class="eyebrow">MAKE THIS MOMENT YOURS</div><h1>あなたに心地よい、ひとときを。</h1><p class="intro">景色も、時間も、声の速さも。いまの気分に合わせて。</p><section class="panel"><h2>背景テーマ <span class="small">7つの風景</span></h2><div class="theme-grid">${THEMES.map(([id,label])=>`<button class="theme-card ${state.theme===id?'active':''}" data-theme="${id}" aria-pressed="${state.theme===id}"><img src="./backgrounds/${id}.webp" alt="" loading="lazy"><span>${state.theme===id?'✓ ':''}${label}</span></button>`).join('')}</div></section><div class="settings-grid"><section class="panel"><h2>瞑想の時間と切替</h2><div class="setting-row"><span class="setting-label">瞑想時間</span>${durationButtons()}</div><label class="setting-row" for="auto"><span class="setting-label">フレーズを自動で切り替える</span><input id="auto" type="checkbox" ${state.auto?'checked':''}></label><label class="setting-row" for="interval"><span class="setting-label">切替間隔</span><select id="interval">${[15,30,45,60].map(n=>`<option value="${n}" ${state.interval===n?'selected':''}>${n}秒</option>`).join('')}</select></label><p class="small">カテゴリー・瞑想時間を変えるとタイマーは最初に戻ります。前・次への切替では残り時間を保ちます。</p></section><section class="panel"><h2>やさしい声で読み上げ</h2><label class="setting-row" for="speak"><span class="setting-label">日本語の読み上げ</span><input id="speak" type="checkbox" ${state.speak?'checked':''} ${speechSupported?'':'disabled'}></label><label class="setting-row" for="rate"><span class="setting-label">声の速さ <span id="rate-value">${state.rate.toFixed(1)}倍</span></span><input id="rate" type="range" min="0.6" max="1.2" step="0.1" value="${state.rate}" ${speechSupported?'':'disabled'}></label><p class="small">${speechSupported?'画面を表示している間にお使いください。画面ロック中や他のアプリを使用中の読み上げは保証されません。オフラインでの音声利用は端末の日本語音声に依存します。':'このブラウザは読み上げに対応していません。音声なしで瞑想をお楽しみください。'}</p></section></div><section class="panel"><h2>大切な言葉を、手元に。</h2><p class="small">設定とフレーズは、このブラウザ・端末の中に保存されます。別の端末とは同期されません。ブラウザのデータを消す前や端末を変える前に、バックアップしてください。</p><div class="button-row"><button class="secondary" data-action="export">${icon('download')}データを書き出す</button><button class="secondary" data-action="import">バックアップを読み込む</button><button class="secondary" data-action="defaults">設定だけ初期化</button></div><input id="import-file" type="file" accept="application/json,.json" hidden><p class="small" style="margin:14px 0 0">読み込みは確認後に反映します。読み込み直前のデータも端末内に保管します。初期化では、お気に入りとマイフレーズを残します。</p></section><details class="panel"><summary>iPhoneのホーム画面に追加するには</summary><p class="small" style="margin-top:16px">HTTPSで公開したアドレスをSafariで開き、「共有」→「ホーム画面に追加」を選びます。初回は通信が必要です。「オフラインの準備ができました」と表示された後は、主要機能を通信なしで使えます。MacのlocalhostアドレスはiPhoneでは開けません。</p><p class="small">この12フレーズは提供資料のアレンジ文です。特定のサービスの原文からの引用ではありません。個人情報の収集・広告・アクセス解析はありません。</p></details></section>`;}
const navItems=[['home','home','ホーム'],['phrases','list','フレーズ'],['favorites','heart','お気に入り'],['custom','pen','マイフレーズ'],['settings','settings','設定']];
function render(){
 const active=view==='player'?'home':view;$('navigation').innerHTML=navItems.map(([id,ico,label])=>`<button data-view="${id}" class="${active===id?'active':''}" ${active===id?'aria-current="page"':''}>${icon(ico)}<span>${label}</span></button>`).join('');
 document.body.classList.toggle('player-page',view==='player');
 $('main').innerHTML=({home,player,phrases:phrasesPage,favorites:favoritesPage,custom:customPage,settings:settingsPage}[view]||home)();
 if(view==='player')renderPlayerPhrase();
 if(view==='custom'){
  const p=state.custom.find(x=>x.id===editing);$('custom-text').value=p?.text||'';$('custom-category').value=p?.category??state.category;characterCount();
  $('custom-form').addEventListener('submit',saveCustom);$('custom-text').addEventListener('input',characterCount);
 }
 if(view==='settings')bindSettings();
}
function characterCount(){$('character-count').textContent=`${$('custom-text').value.length} / 500文字`;}
function saveCustom(e){e.preventDefault();const text=$('custom-text').value.trim(),category=Number($('custom-category').value);if(!text||text.length>500){$('form-status').textContent='1〜500文字の言葉を入力してください。';return;}
 const p=state.custom.find(x=>x.id===editing);if(p){p.text=text;p.category=category;}else state.custom.push({id:newId(),category,text});
 editing=null;const saved=persist();render();notify(saved?'あなたの言葉を保存しました。':'言葉を画面内に追加しました。保存状況をご確認ください。');
}
function bindSettings(){
 $('auto').onchange=e=>{state.auto=e.target.checked;timer.autoElapsed=0;persist();};$('interval').onchange=e=>{state.interval=Number(e.target.value);timer.autoElapsed=0;persist();};
 $('speak').onchange=e=>{state.speak=e.target.checked;audioArmed=true;if(!state.speak)stopSpeech();persist();};
 $('rate').oninput=e=>{state.rate=Number(e.target.value);$('rate-value').textContent=state.rate.toFixed(1)+'倍';stopSpeech();persist();};
 $('import-file').onchange=importFile;
}
function confirmAction(title,message,yes='続ける'){const d=$('confirm-dialog');$('confirm-title').textContent=title;$('confirm-message').textContent=message;$('confirm-yes').textContent=yes;d.returnValue='cancel';d.showModal();return new Promise(resolve=>d.addEventListener('close',()=>resolve(d.returnValue==='yes'),{once:true}));}
function download(name,content){const blob=new Blob([content],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function exportData(){download(`shiawase-switch-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({app:'shiawase-switch',version:2,exportedAt:new Date().toISOString(),state},null,2));notify('バックアップファイルを書き出しました。');}
async function importFile(e){
 const file=e.target.files[0];if(!file)return;
 try{
  if(file.size>2000000)throw Error('ファイルが大きすぎます。2MB以内のバックアップを選んでください。');
  const next=importState(await file.text());
  if(!await confirmAction('バックアップを読み込みますか？',`マイフレーズ ${next.custom.length}件・お気に入り ${next.favorites.length}件のデータで、現在の設定と登録内容を置き換えます。読み込み前のデータは端末内に保管します。`,'読み込む'))return;
  // Do not replace user data unless the pre-import backup is durable.
  storage.setItem(KEY+'-before-import',JSON.stringify(state));
  const existing=storage.getItem(KEY);if(existing)storage.setItem(KEY+'-before-import-raw',existing);
  const result=saveState(storage,next,false);if(!result.ok)throw Error(result.message);
  pauseTimer();state=next;blocked=false;index=0;timer.reset(state.duration);completed=false;saveSession();$('storage-warning').hidden=true;render();notify('バックアップを読み込みました。');
 }catch(err){notify('読み込めませんでした。'+err.message);}finally{if($('import-file'))$('import-file').value='';}
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b||b.disabled||b.closest('dialog'))return;
 if(b.dataset.view){if(b.dataset.view==='custom')editing=null;setView(b.dataset.view);return;}
 if(b.dataset.category!==undefined){chooseCategory(Number(b.dataset.category));return;}
 if(b.dataset.filter!==undefined){filter=b.dataset.filter;render();return;}
 if(b.dataset.theme){state.theme=b.dataset.theme;persist();render();notify(themeName()+' に切り替えました');return;}
 if(b.dataset.duration){setDuration(Number(b.dataset.duration));return;}
 if(b.dataset.favorite){favorite(b.dataset.favorite);return;}
 if(b.dataset.phrase){startSession(b.dataset.phrase,b.dataset.favPlay==='true');return;}
 if(b.dataset.edit){editing=b.dataset.edit;render();$('custom-text').focus();window.scrollTo(0,0);return;}
 if(b.dataset.delete){const p=state.custom.find(x=>x.id===b.dataset.delete);if(p&&await confirmAction('この言葉を削除しますか？',p.text,'削除する')){state.custom=state.custom.filter(x=>x.id!==p.id);state.favorites=state.favorites.filter(x=>x!==p.id);if(editing===p.id)editing=null;persist();render();notify('マイフレーズを削除しました。');}return;}
 switch(b.dataset.action){
  case'start':startSession();break;case'favorites-start':startSession(null,true);break;
  case'voice':toggleVoice();break;case'toggle':toggleTimer();break;case'prev':move(-1);break;case'next':move(1);break;
  case'auto':state.auto=!state.auto;timer.autoElapsed=0;persist();render();break;
  case'reread':audioArmed=true;if(!state.speak){state.speak=true;persist();render();}readPhrase();break;
  case'stopvoice':state.speak=false;stopSpeech();persist();render();break;
  case'immersive':immersive=!immersive;render();break;
  case'reset':if(await confirmAction('タイマーをリセットしますか？','残り時間を最初に戻し、一時停止します。','リセット')){stopSpeech();timer.reset(state.duration);completed=false;render();saveSession();}break;
  case'cancel-edit':editing=null;render();break;case'export':exportData();break;case'import':$('import-file').click();break;
  case'defaults':if(await confirmAction('設定を初期化しますか？','背景・時間・音声などを初期設定に戻します。お気に入りとマイフレーズは残ります。','初期化する')){pauseTimer();state={...defaults(),favorites:state.favorites,custom:state.custom};timer.reset(5);index=0;completed=false;persist();render();notify('設定を初期化しました。');}break;
 }
});
function tick(){const r=timer.tick(Date.now(),state.auto,state.interval);if(r.finished){completed=true;stopSpeech();saveSession();if(view==='player'){render();notify('瞑想が終わりました。おつかれさまでした。');}}else if(r.steps){const list=playlist(state);if(list.length){index=(index+r.steps)%list.length;renderPlayerPhrase();saveSession();if(view==='player')readPhrase();}}renderClock();}
voices();if(speechSupported)speechSynthesis.addEventListener('voiceschanged',voices);
try{const s=JSON.parse(sessionStorage.getItem(KEY+'-session'));if(s&&timer.restore(s.timer)){index=Number.isInteger(s.index)&&s.index>=0&&s.index<playlist(state).length?s.index:0;view=s.view==='player'?'player':'home';completed=Boolean(s.completed);if(timer.running){view='player';tick();}}}catch{}
if(loaded.warnings.length)warn(loaded.warnings.join(' '));
if(loaded.source&&loaded.source!==KEY&&!blocked)persist();
if(!speechSupported)state.speak=false;
document.querySelector('.brand').onclick=e=>{e.preventDefault();setView('home');};
render();setInterval(tick,250);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopSpeech();saveSession();}else{tick();if(timer.running&&state.speak)notify('読み上げを続けるには「再読」を押してください。');}});
window.addEventListener('pagehide',()=>{stopSpeech();saveSession();});window.addEventListener('pageshow',()=>tick());
async function setupOffline(){
 if(!('serviceWorker'in navigator)){ $('offline-status').textContent='このブラウザはオフライン保存に未対応です';return;}
 try{
  const reg=await navigator.serviceWorker.register('./sw.js');
  const showUpdate=w=>{waitingWorker=w;$('update-banner').hidden=false;};
  if(reg.waiting)showUpdate(reg.waiting);
  reg.addEventListener('updatefound',()=>{const w=reg.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)showUpdate(w);});});
  await navigator.serviceWorker.ready;$('offline-status').textContent='オフラインの準備ができました';
  if(reg.waiting)showUpdate(reg.waiting);
 }catch{$('offline-status').textContent='オフライン保存が未完了です。通信・容量を確認してください。';}
}
$('update-app').onclick=async()=>{if(timer.running&&!await confirmAction('アプリを更新しますか？','瞑想を一時停止して更新します。設定とフレーズは保たれます。','更新する'))return;pauseTimer();saveSession();waitingWorker?.postMessage({type:'SKIP_WAITING'});};
let reloading=false;navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(waitingWorker&&!reloading){reloading=true;location.reload();}});
setupOffline();
