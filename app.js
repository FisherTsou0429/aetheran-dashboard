/* 艾瑟蘭世界管理中心 — 唯讀介面。正式遊戲內容以聊天和正式存檔為準。 */
"use strict";
const TABS={
 overview:["總覽","最重要的角色、逾期研究、任務與最近事件集中在這裡。"],
 characters:["角色與能力","冒險者階級、特殊能力、同行者與已知人物狀態。"],
 equipment:["裝備與晶片","護甲、載具、晶片槽與借出設備的狀態。"],
 inventory:["物品與庫存","找回忘記的魔核、素材、古代裝置及其保管位置。"],
 quests:["任務與委託","以任務ID查詢接取、驗收、未領報酬與期限。"],
 research:["夢想工坊","研究里程碑、製造日期、實際成果與未結驗收。"],
 logistics:["夢想物流","飛天號、貨車、分行及配車情況。"],
 workforce:["夢想人力","道路工程、人力派遣、款項與待確認進度。"],
 sidelines:["世界支線","白樺莊園、星環、界錨、北境封印及其他支線。"],
 npcs:["NPC永久名冊","重要角色關係、職責、最近確認資訊；非全部歷史名冊。"],
 commitments:["承諾與待辦","尚未兌現的約定、提案與需要玩家決定的事項。"],
 timeline:["歷史紀錄","主要事件時間軸。更早內容仍保留在完整存檔中。"]
};
let DATA=null,page="overview",query="",filter="";
const $=id=>document.getElementById(id);
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>typeof n==="number"?n.toLocaleString("zh-TW"):safe(n);
const entries=k=>Array.isArray(DATA?.[k])?DATA[k]:[];
function classify(status=""){
 if(/逾期|異常|失敗/.test(status))return "alert";
 if(/待驗收|待結算|待軍方|待核對|待清查|待報|待同意|待報價|未履行|未核/.test(status))return "pending";
 if(/已通過|已交付|已登錄|已完成|使用中|保有|已入庫|運作中/.test(status))return "good";
 if(/預定|計畫|構想|設計|研發中|準備|提案/.test(status))return "plan";
 return "";
}
function badge(status){return '<span class="tag '+classify(status)+'">'+safe(status||"未標示")+"</span>";}
function countShown(n){return n+' 筆紀錄';}
function allMatch(row){
 const str=Object.entries(row).map(([k,v])=>Array.isArray(v)?v.join(" "):String(v??"")).join(" ").toLocaleLowerCase();
 return str.includes(query.toLocaleLowerCase())&&(!filter||String(row.status??"")===filter);
}
function card(row){
 const name=row.name||row.title||row.id;
 const details=[];
 if(row.rank)details.push("階級："+row.rank);
 if(row.role)details.push(row.role);
 if(row.place||row.location)details.push("地點："+(row.place||row.location));
 if(row.lead||row.owner)details.push("負責："+(row.lead||row.owner));
 if(row.count)details.push("數量："+row.count);
 if(row.rewardCopper!=null)details.push("基礎報酬："+fmt(row.rewardCopper)+"銅幣");
 if(row.bonusCopper!=null)details.push("附加上限／條件："+fmt(row.bonusCopper)+"銅幣");
 if(row.bonusStatus)details.push("附加狀態："+row.bonusStatus);
 if(row.targetDay!=null)details.push("目標：第"+row.targetDay+"日");
 if(row.deadlineDay!=null)details.push("期限：第"+row.deadlineDay+"日"+(row.deadlineTime?" "+row.deadlineTime:""));
 if(row.updatedDay!=null)details.push("最近來源：第"+row.updatedDay+"日");
 if(row.goal)details.push("下一步："+row.goal);
 return '<article class="card"><div class="card-head"><div><h3>'+safe(name)+'</h3><div class="sub">'+safe(row.id||"")+'</div></div>'+badge(row.status)+'</div><p class="description">'+safe(row.details||row.note||"")+'</p><div class="card-details">'+details.map(x=>"<span>"+safe(x)+"</span>").join("")+"</div></article>";
}
function section(title,content,count){return '<div class="section-heading"><h2>'+safe(title)+'</h2><span>'+safe(count||"")+'</span></div>'+content;}
function cardGrid(rows){return rows.length?'<div class="grid">'+rows.map(card).join("")+'</div>':'<div class="empty">沒有符合這組搜尋／篩選條件的資料。</div>';}
function navigate(next){
 if(!TABS[next])return;
 page=next;query="";filter="";$("search").value="";$("status-filter").value="";
 location.hash=next;
 document.querySelectorAll("#nav button").forEach(btn=>{const active=btn.dataset.page===next;btn.classList.toggle("active",active);btn.setAttribute("aria-current",active?"page":"false");});
 document.querySelector(".sidebar").classList.remove("open");
 setStatusOptions(entries(next));
 render();
 window.scrollTo({top:0,behavior:"smooth"});
}
function setStatusOptions(rows){
 const select=$("status-filter");const v=select.value;
 const values=[...new Set(rows.map(x=>x.status).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"zh-Hant"));
 select.innerHTML='<option value="">所有狀態</option>'+values.map(x=>'<option value="'+safe(x)+'">'+safe(x)+'</option>').join("");
 select.value=values.includes(v)?v:""; filter=select.value;
}
function currentCounters(){
 return '看板同步 '+DATA.sync.turnsSinceSuccessfulSync+'/'+DATA.sync.intervalTurns+
        '｜正式增量 '+DATA.snapshot.incrementalCounter+'/25｜完整 '+DATA.snapshot.fullCounter+'/50';
}
function renderOverview(){
 const H=DATA.hero;const tasks=entries("quests");const r=entries("research");
 const alerts=r.filter(x=>/逾期|待正式驗收|待結案清查/.test(x.status));
 const owed=tasks.filter(x=>/待結算|待軍方驗證|已驗收/.test(x.status));
 const kpis=[
  ["可支配銅幣",fmt(H.cashCopper),"不含他人代管款"],
  ["B→A合格進度",H.advancement.qualified+"/"+H.advancement.qualifiedTarget,"困難 "+H.advancement.hard+"/"+H.advancement.hardTarget],
  ["待結算任務",String(owed.length),"核准金額尚未自動入帳"],
  ["研究／製造關注",String(alerts.length),"含舊案核對，不等於全部逾期"]
 ];
 let html='<div class="kpi-grid">'+kpis.map(k=>'<div class="kpi"><small>'+safe(k[0])+'</small><strong>'+safe(k[1])+'</strong><em>'+safe(k[2])+'</em></div>').join("")+"</div>";
 html+='<div class="info-banner">資料截至遊戲第'+DATA.snapshot.gameDay+'日'+DATA.snapshot.gameTime+'，並非即時世界模擬。公開版只重現已確認的玩家可查資料；未知及未列出項目需回查正式存檔。</div>';
 const risks=r.filter(x=>/逾期|待正式驗收|待結案清查/.test(x.status)).slice(0,6);
 html+='<div class="summary-panels"><section class="panel"><h3>需要你注意的研究／製造</h3><ul class="mini-list">'+risks.map(x=>'<li><span class="dot warn"></span><div><button class="inline-link" data-goto="research">'+safe(x.name)+'</button><small>'+safe(x.status)+'｜'+(x.targetDay?'原定第'+x.targetDay+'日':'無確認期限')+'</small></div></li>').join("")+'</ul></section>';
 html+='<section class="panel"><h3>待領報酬與待軍方確認</h3><ul class="mini-list">'+owed.map(x=>'<li><span class="dot"></span><div><button class="inline-link" data-goto="quests">'+safe(x.name)+'</button><small>'+safe(x.status)+'｜基礎報酬 '+fmt(x.rewardCopper||0)+'銅幣（尚未領取）</small></div></li>').join("")+'</ul><p class="panel-note">只列已確定的報酬狀態，附條件獎金不視為核准。</p></section></div>';
 const important=[
   {id:"OV-VALEN",name:"瓦倫已登錄F級",status:"已登錄",details:"但城鎮自由通行尚未核准；幽藍指揮官甲仍待本人同意及費用報價。"},
   {id:"OV-PURIFY",name:"多相淨化晶片",status:"階段通過／未裝備",details:"六核低功率成功；第192日封裝樣品、第193日短測是目標，不是成品。"},
   {id:"OV-ESTATE",name:"白樺莊園",status:"產權及工程待報",details:"莊園已購；代管400,000銅幣另計。整修與雇用試用期仍需追蹤。"},
   {id:"OV-DRAGON",name:"蒼雷巨翼龍S級任務",status:"已接取未完成",details:"澈尚未出發；第196日18:00交付期限。"}
 ];
 html+=section("近期關注",'<div class="grid">'+important.map(card).join("")+"</div>","重點提示");
 html+=section("最近事件",'<div class="grid">'+entries("timeline").slice(0,4).map(x=>card({id:"第"+x.day+"日 "+x.time,name:x.title,status:"歷史紀錄",details:x.details})).join("")+"</div>","最新4筆");
 html+='<div class="section-heading"><h2>同步與資料來源</h2></div><section class="panel"><div class="stat-row"><span>看板同步計數器</span><strong>'+DATA.sync.turnsSinceSuccessfulSync+'/'+DATA.sync.intervalTurns+'</strong></div><div class="stat-row"><span>正式增量／完整存檔計數器</span><strong>'+DATA.snapshot.incrementalCounter+'/25・'+DATA.snapshot.fullCounter+'/50</strong></div><div class="stat-row"><span>權威基準</span><strong>'+safe(DATA.snapshot.officialSave)+'</strong></div><p class="panel-note">'+safe(DATA.sync.note)+'</p></section>';
 return html;
}
function renderHero(){
 const h=DATA.hero,adv=h.advancement;
 const chips=h.chips.map(x=>'<span>'+safe(x)+'</span>').join("");
 return '<div class="character-feature"><section class="large-stat"><h2>澈 <span class="tag good">B級冒險者</span></h2><p>男性穿越者・非勇者｜主裝備：'+safe(h.equipped)+'</p>'+
 '<div class="stat-row"><span>唯一可支配銅幣</span><strong>'+fmt(h.cashCopper)+'</strong></div>'+
 '<div class="stat-row"><span>奧斯文代管專款</span><strong>'+fmt(h.thirdPartyHeldCopper)+'（不計入現金）</strong></div>'+
 '<div class="stat-row"><span>已核准但未領基本報酬</span><strong>'+fmt(h.uncollectedBaseCopper)+'</strong></div>'+
 '<div class="stat-row"><span>合格任務晉升</span><strong>'+adv.qualified+' / '+adv.qualifiedTarget+'</strong></div>'+
 '<div class="progress"><span style="width:'+Math.min(100,adv.qualified/adv.qualifiedTarget*100)+'%"></span></div>'+
 '<p>困難任務：'+adv.hard+'/'+adv.hardTarget+'｜護甲晶片：'+h.chipsUsed+'/'+h.chipsCapacity+'</p>'+
 '<p>主要能力：'+safe(h.abilities.join("、"))+'</p></section>'+
 '<section class="large-stat"><h2>晶片配置</h2><p>夢想二號機・已裝12／15槽</p><div class="card-details">'+chips+'</div><p>未裝晶片不會被看板自動補上。剩餘3槽。</p><p class="panel-note">'+safe(h.note)+'</p></section></div>';
}
function renderTimeline(rows){
 return '<div class="grid">'+rows.map(x=>card({id:"第"+x.day+"日"+(x.time?" "+x.time:""),name:x.title,status:"已記錄",details:x.details})).join("")+"</div>";
}
function render(){
 if(!DATA)return;
 const cfg=TABS[page],p=$("content");
 $("page-title").textContent=cfg[0];
 $("page-description").textContent=cfg[1];
 const rows=entries(page);
 const showToolbar=page!=="overview";
 $("search").placeholder=page==="overview"?"選擇左側分類後搜尋資料…":"搜尋名稱、任務ID、物品位置、NPC或研究…";
 $("search").disabled=!showToolbar;$("status-filter").disabled=!showToolbar;
 $("clear-filters").disabled=!showToolbar;
 if(page==="overview"){p.innerHTML=renderOverview();return;}
 if(page==="characters"){
   const result=rows.filter(allMatch);
   p.innerHTML=renderHero()+section("人物狀態",cardGrid(result),countShown(result.length));
   return;
 }
 const result=rows.filter(allMatch);
 if(page==="timeline"){p.innerHTML=section("事件時間軸",renderTimeline(result),countShown(result.length));return;}
 let heading=cfg[0]; 
 let pre="";
 if(page==="research")pre='<div class="info-banner">「目標第N日」不等於完成日；「舊案待清查」也不等於製造失敗。系統只按正式來源明確紀錄顯示狀態。</div>';
 if(page==="quests")pre='<div class="info-banner">公告未接取不代表已接受委託；待領獎金及附條件報酬不加入現金。公告細節以原始任務卡為準。</div>';
 if(page==="sidelines"||page==="workforce")pre='<div class="info-banner">部分支線的最近專題來源早於第191日。標記「第97日」代表最後核對來源，不應當作第191日的最新實際營運結果。</div>';
 p.innerHTML=pre+section(heading,cardGrid(result),countShown(result.length));
}
function init(){
 document.querySelectorAll("#nav button").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
 $("menu-toggle").addEventListener("click",()=>document.querySelector(".sidebar").classList.toggle("open"));
 document.addEventListener("click",e=>{const b=e.target.closest("[data-goto]");if(b)navigate(b.dataset.goto)});
 $("search").addEventListener("input",e=>{query=e.target.value.trim();render()});
 $("status-filter").addEventListener("change",e=>{filter=e.target.value;render()});
 $("clear-filters").addEventListener("click",()=>{query="";filter="";$("search").value="";$("status-filter").value="";render()});
 window.addEventListener("hashchange",()=>{const wanted=location.hash.slice(1);if(TABS[wanted]&&wanted!==page)navigate(wanted)});
}
async function load(){
 try{
   const response=await fetch("./data/latest.json?build=1",{cache:"no-store"});
   if(!response.ok)throw new Error("HTTP "+response.status);
   const d=await response.json();
   if(d.schemaVersion!=="1.0"||!d.snapshot||!d.hero||!d.quests||!d.research)throw new Error("資料格式不符");
   DATA=d;
   $("snapshot-label").textContent="遊戲時間：第"+d.snapshot.gameDay+"日 "+d.snapshot.gameTime;
   $("location-label").textContent="目前位置："+d.snapshot.location;
   $("save-label").textContent="正式來源："+d.snapshot.officialSave;
   $("top-status").textContent="資料截至第"+d.snapshot.gameDay+"日";
   $("side-sync").textContent=currentCounters();
   const n=$("notice");
   n.hidden=false;n.textContent="玩家查詢專用看板｜"+d.snapshot.scope;
   const wanted=location.hash.slice(1); page=TABS[wanted]?wanted:"overview";
   document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
   setStatusOptions(entries(page));render();
 }catch(err){
   $("top-status").textContent="資料讀取失敗";
   $("content").innerHTML='<div class="empty">無法載入資料檔。請稍後重新整理，或檢查 <a href="./data/latest.json">latest.json</a> 是否已部署。<p>'+safe(err.message)+'</p></div>';
 }
}
document.addEventListener("DOMContentLoaded",()=>{init();load()});
