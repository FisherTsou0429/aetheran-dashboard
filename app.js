/* 艾瑟蘭世界管理中心 — 唯讀介面。正式遊戲內容以聊天和正式存檔為準。 */
"use strict";
const TABS={
 overview:["總覽","最重要的角色、逾期研究、任務與最近事件集中在這裡。"],
 characters:["角色與能力","冒險者階級、特殊能力、同行者與已知人物狀態。"],
 equipment:["裝備與晶片","查看澈持有的武器、夢想二號機的五種模式、晶片與借用裝備。"],
 inventory:["物品與庫存","點選物品名稱，查看數量、保管位置與來源。"],
 prices:["永久商品價格","已成交商品永久標價、實付與歷史條件；不是新交易。"],
 quests:["任務與委託","先看手上的任務與接洽進度，再依公會公告四區查閱紀錄。"],
 "player-commissions":["玩家委託","查閱澈發布的委託、懸賞條件、已付款項及待核實線索。"],
 research:["夢想工坊","研究里程碑、製造日期、實際成果與未結驗收。"],
 logistics:["夢想物流","飛天號、貨車、分行及配車情況。"],
 workforce:["夢想人力","道路工程、人力派遣、款項與待確認進度。"],
 sidelines:["世界支線","白樺莊園、星環、界錨、北境封印及其他支線。"],
 npcs:["NPC永久名冊","重要角色關係、職責、最近確認資訊；非全部歷史名冊。"],
 commitments:["承諾與待辦","尚未兌現的約定、提案與需要玩家決定的事項。"],
 timeline:["事件時間軸","按遊戲日回顧事件。點開任一事件，即可查看經過、人物、結果與來源。"]
};
let DATA=null,page="overview",query="",filter="",questFilter="";
let loadSequence=0,loadedPayload="";
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
function searchText(value){
 return value&&typeof value==="object"?Object.values(value).map(searchText).join(" "):String(value??"");
}
function allMatch(row){
 return (!filter||String(row.status??"")===filter)&&
  (!query||searchText(row).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
}
function questDeadline(row){
 return row.deadlineDay==null ? (row.deadlineTime||"") : "第"+row.deadlineDay+"日"+(row.deadlineTime?" "+row.deadlineTime:"");
}
function card(row){
 const name=row.name||row.title||row.id;
 const details=[];
 if(row.rank)details.push("階級："+row.rank);
 if(row.role)details.push(row.role);
 if(row.place||row.location)details.push("地點："+(row.place||row.location));
 if(row.lead||row.owner)details.push("負責："+(row.lead||row.owner));
 if(row.count)details.push("數量："+row.count);
 if(row.quantity)details.push("成交數量："+row.quantity);
 if(row.category)details.push("類型："+row.category);
 if(row.originalCopper!=null)details.push("原始標價："+fmt(row.originalCopper)+"銅幣");
 if(row.paidCopper!=null)details.push("確認實付："+fmt(row.paidCopper)+"銅幣");
 if(row.rewardCopper!=null)details.push("基礎報酬："+fmt(row.rewardCopper)+"銅幣");
 if(row.bonusCopper!=null)details.push("附加上限／條件："+fmt(row.bonusCopper)+"銅幣");
 if(row.bonusStatus)details.push("附加狀態："+row.bonusStatus);
 if(row.targetDay!=null)details.push("目標：第"+row.targetDay+"日");
 const deadline=questDeadline(row);
 if(deadline)details.push("期限："+deadline);
 if(row.updatedDay!=null)details.push("最近來源：第"+row.updatedDay+"日");
 if(row.goal)details.push("下一步："+row.goal);
 return '<article class="card"><div class="card-head"><div><h3>'+safe(name)+'</h3><div class="sub">'+safe(row.id||"")+'</div></div>'+badge(row.status)+'</div><p class="description">'+safe(row.details||row.note||"")+'</p><div class="card-details">'+details.map(x=>"<span>"+safe(x)+"</span>").join("")+"</div></article>";
}
function section(title,content,count){return '<div class="section-heading"><h2>'+safe(title)+'</h2><span>'+safe(count||"")+'</span></div>'+content;}
function cardGrid(rows,emptyMessage="沒有符合這組搜尋／篩選條件的資料。",renderCard=card){
 return rows.length?'<div class="grid">'+rows.map(renderCard).join("")+'</div>':'<div class="empty">'+safe(emptyMessage)+'</div>';
}

const QUEST_CATEGORIES=[
 ["guild","一般公會委託"],
 ["team","夢想小隊專屬委託"],
 ["air","夢想飛天號專屬急件運輸"],
 ["recruitment","隊伍招募／遠征徵人"]
];

function questCategory(row){
 const category=row.category||"";
 const id=row.id||"";
 // Older snapshots also identify categories through established IDs and titles.
 if(/飛天號.*急件|飛空艇.*急件/.test(category)||/^(?:TMP-)?AIR(?:-|\d)/.test(id))return "air";
 if(/隊伍招募|遠征徵人/.test(category)||/^(?:REC-|TMP-R\d)/.test(id))return "recruitment";
 if(/夢想(?:小)?隊專屬/.test(category)||/夢想(?:小)?隊專屬/.test(row.name||""))return "team";
 return "guild";
}

function isPlayerCommission(row){
 return row.rank==="玩家發布"||row.owner==="澈（委託人）";
}

function timelineRows(){
 const structured=[...entries("timeline"),...entries("events")];
 const latest=latestTimelinePoint(structured);
 const snapshot=timelinePoint(DATA.snapshot.gameDay,DATA.snapshot.gameTime);
 const summaries=entries("latestEvents").flatMap(row=>{
  const point=timelinePoint(row.gameDay,row.time);
  if(!point||typeof row.event!=="string"||!row.event.trim())return [];
  if(snapshot&&point.order>snapshot.order)return [];
  // Older summaries have no ID. Use them only after the last structured event.
  if(!row.id&&latest&&point.order<=latest.order)return [];
  return [{
   id:row.id,day:point.day,time:point.time,title:row.event.trim(),status:"摘要待補",
   details:"GH 同步的近期摘要。正式時間軸的詳情尚待補登。",
   source:"GH 同步近期摘要"
  }];
 });
 const seen=new Set();
 return [...structured,...summaries].filter(row=>{
  const key=[row.day,row.time,row.title].join("|");
  if(seen.has(key)||(row.id&&seen.has(row.id)))return false;
  seen.add(key);
  if(row.id)seen.add(row.id);
  return true;
 });
}
function pageRows(){
 if(page==="timeline")return timelineRows();
 if(page==="player-commissions")return entries("quests").filter(isPlayerCommission);
 const rows=entries(page);
 return page==="quests"&&questFilter?rows.filter(row=>questCategory(row)===questFilter):rows;
}

function refreshPageFilters(){
 const rows=pageRows();
 setStatusOptions(rows);
 if(page==="quests"){
  $("quest-category-filter").querySelectorAll("button").forEach(button=>{
   button.setAttribute("aria-pressed",String(button.dataset.questCategory===questFilter));
  });
  $("quest-priority").innerHTML=renderQuestPriority(rows);
 }
 render();
}

function questFocus(status=""){
 if(/(?:待(?:正式)?驗收|待軍方驗證|待(?:公會)?(?:結算|付款|領款)|(?:待領|未領)(?:款|報酬))$/.test(status))return "followup";
 if(/^(?:已(?:正式)?接取|已簽約)(?:[／、， ]?(?:未完成|未開始|未啟動|未出發|進行中|現場鑑定中|已抵達|已報到|現場報到完成(?:[、，／]尚未交戰)?))?$/.test(status))return "active";
 if(/^(?:提案未簽約|接洽中|洽談中|待(?:對方|委託方)回覆|申請待審核|待接取審核|待簽約|待面談)$/.test(status))return "contact";
 return "";
}

function questFields(fields){
 return fields.map(([label,value])=>'<div><dt>'+safe(label)+'</dt><dd'+
  (value?'':' class="quest-missing"')+'>'+safe(value||"未記載")+'</dd></div>').join("");
}

function questCard(row){
 const task=row.taskDetails||{};
 const publishedByPlayer=isPlayerCommission(row);
 const focus=questFocus(row.status);
 const accepted=task.acceptedAt||
  (/^公告未接取/.test(row.status)||focus==="contact"?"未正式接取":"")||
  (focus==="active"?"已正式接取，時點未記載":"");
 const originalDeadline=questDeadline(row);
 const application=task.applicationDeadline||(/報名|申請|受理/.test(row.deadlineTime||"")?originalDeadline:"");
 const reward=task.reward||(row.rewardCopper!=null?fmt(row.rewardCopper)+" 銅幣":"");
 const fields=[
  ["委託人／發布方",task.client||row.owner],
  ["發布／公告時間",task.publishedAt],
  [publishedByPlayer?"委託方式":"正式接取",accepted],
  [publishedByPlayer?"徵集截止":"報名／接取截止",application],
  ["到期／交付截止",task.deliveryDeadline],
  [focus==="contact"?"提案報酬":"報酬",reward]
 ];
 const details=[
  ["地點",task.place||row.place||row.location],
  ["背景",task.background],
  ["接取資格與限制",task.eligibility],
  ["集合、作業與行程",task.schedule],
  ["完成、交付與驗收",task.completion],
  ["危險與注意事項",task.risk],
  ["加成與條件",[row.bonusCopper!=null?fmt(row.bonusCopper)+" 銅幣":"",row.bonusStatus].filter(Boolean).join(" · ")],
  ["付款與領取",task.payment],
  ["目前進度",task.progress],
  ["下一步",task.next],
  ["接洽與相關人物",task.contacts],
  ["原紀錄期限",!application&&!task.deliveryDeadline?originalDeadline:""],
  ["原看板備註",row.details||row.note]
 ].filter(([,value])=>value);
 const type=publishedByPlayer?"":QUEST_CATEGORIES.find(([key])=>key===questCategory(row))[1];
 const identity=[row.id,row.rank,type].filter(Boolean).join(" · ");
 const commissionLink=publishedByPlayer&&page==="quests"?
  '<button class="inline-link commission-link" type="button" data-goto="player-commissions">查看玩家委託紀錄</button>':"";
 return '<article class="card quest-card"><div class="card-head"><div><h3>'+safe(row.name||row.title||row.id)+'</h3>'+
  '<div class="sub">'+safe(identity)+'</div></div>'+badge(row.status)+'</div>'+
  '<dl class="quest-requirements">'+questFields([["任務需求",task.requirements]])+'</dl>'+
  '<dl class="quest-fields">'+questFields(fields)+'</dl>'+
  (details.length?'<dl class="quest-details">'+questFields(details)+'</dl>':'')+
  (task.source?'<p class="quest-source">資料來源 · '+safe(task.source)+'</p>':'')+commissionLink+'</article>';
}

function commissionSection(title,rows,layout=""){
 if(!Array.isArray(rows)||!rows.length)return "";
 const cards=rows.map(row=>'<article class="card commission-item"><div class="card-head"><div><h3>'+
  safe(row.name)+'</h3><div class="commission-meta">'+safe(row.meta)+'</div></div>'+
  (row.status?badge(row.status):"")+'</div><p class="description">'+safe(row.details)+'</p></article>');
 return section(title,'<div class="commission-list '+layout+'">'+cards.join("")+'</div>',countShown(rows.length));
}

function renderPlayerCommissions(rows){
 if(!rows.length)return cardGrid(rows);
 return rows.map(row=>{
  const {awards,leads,history}=row.commission??{};
  return '<section class="player-commission">'+section("委託公告",questCard(row))+
   commissionSection("懸賞與付款",awards,"commission-awards")+
   commissionSection("礦點與線索",leads)+
   commissionSection("委託歷程",history)+'</section>';
 }).join("");
}

function questFocusPanel(key,title,description,rows){
 const emptyMessage="看板目前未收錄這個狀態的任務。";
 const content=rows.length?'<div class="quest-summary-list">'+rows.map(questCard).join("")+'</div>':
 '<p class="quest-focus-empty">'+emptyMessage+'</p>';
 return '<section class="quest-focus-panel quest-focus-'+key+'" aria-labelledby="quest-'+key+'">'+
 '<div class="section-heading"><h2 id="quest-'+key+'" tabindex="-1">'+title+'</h2><span>'+countShown(rows.length)+'</span></div>'+
 '<p class="quest-focus-description">'+description+'</p>'+content+'</section>';
}

function renderQuestPriority(rows){
 const groups={active:[],contact:[],followup:[]};
 for(const row of rows){
  const key=questFocus(row.status);
  if(key)groups[key].push(row);
 }
 const panels=[
  ["active","正在進行","已正式接取的任務，包含尚未開始的案件。"],
  ["contact","正在接洽","提案、洽談及接取前審核。請以各筆原始狀態為準。"],
  ["followup","待驗收／待領款","依各筆紀錄區分待驗證、待結算與已核准未領。"]
 ].filter(([key])=>groups[key].length||(!questFilter&&key!=="followup"));
 if(!panels.length)return "";
 const jumps=panels.map(([key,title])=>["quest-"+key,title]);
 jumps.push(["search","搜尋與任務紀錄"]);
 const primary=panels.filter(([key])=>key!=="followup")
  .map(([key,title,description])=>questFocusPanel(key,title,description,groups[key])).join("");
 const followup=panels.find(([key])=>key==="followup");
 return '<div class="quest-jumps" role="group" aria-label="跳至任務區塊">'+
  jumps.map(([id,label])=>'<button type="button" data-quest-jump="'+id+'">'+label+'</button>').join("")+'</div>'+
  (primary?'<div class="quest-focus-grid">'+primary+'</div>':"")+
  (followup?questFocusPanel(...followup,groups.followup):"");
}

function renderQuestCategories(rows){
 const groups={guild:[],team:[],air:[],recruitment:[]};
 for(const row of rows)groups[questCategory(row)].push(row);
 const emptyMessage=query||filter?"此區沒有符合搜尋或篩選條件的紀錄。":"目前看板未收錄此區紀錄。";
 const categories=questFilter?QUEST_CATEGORIES.filter(([key])=>key===questFilter):QUEST_CATEGORIES;
 return '<p class="quest-categories-note">日期按看板的遊戲時間顯示。缺少原始資料的欄位標為未記載。</p>'+
 categories.map(([key,title])=>'<section class="quest-category">'+
 section(title,cardGrid(groups[key],emptyMessage,questCard),countShown(groups[key].length))+'</section>').join("");
}
function markActivePage(){
 document.querySelectorAll("#nav button").forEach(btn=>{
  const active=btn.dataset.page===page;
  btn.classList.toggle("active",active);
  btn.setAttribute("aria-current",active?"page":"false");
 });
}

function navigate(next,updateHash=true){
 if(!Object.hasOwn(TABS,next))return;
 document.querySelector(".sidebar").classList.remove("open");
 if(next!==page){
  page=next;query="";questFilter="";$("search").value="";$("status-filter").value="";
  if(updateHash)location.hash=next;
  markActivePage();
  refreshPageFilters();
  window.scrollTo({top:0,behavior:"smooth"});
 }
 load();
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
 const owed=tasks.filter(x=>questFocus(x.status)==="followup");
 const kpis=[
  ["可支配銅幣",fmt(H.cashCopper),"不含他人代管款"],
  ["B→A合格進度",H.advancement.qualified+"/"+H.advancement.qualifiedTarget,"困難 "+H.advancement.hard+"/"+H.advancement.hardTarget],
  ["待驗收／待領款",String(owed.length),"按最新驗收及付款狀態"],
  ["研究／製造關注",String(alerts.length),"含舊案核對，不等於全部逾期"]
 ];
 let html='<div class="kpi-grid">'+kpis.map(k=>'<div class="kpi"><small>'+safe(k[0])+'</small><strong>'+safe(k[1])+'</strong><em>'+safe(k[2])+'</em></div>').join("")+"</div>";
 html+='<div class="info-banner">資料截至遊戲第'+DATA.snapshot.gameDay+'日'+DATA.snapshot.gameTime+'，並非即時世界模擬。公開版只重現已確認的玩家可查資料；未知及未列出項目需回查正式存檔。</div>';
 const risks=r.filter(x=>/逾期|待正式驗收|待結案清查/.test(x.status)).slice(0,6);
 html+='<div class="summary-panels"><section class="panel"><h3>需要你注意的研究／製造</h3><ul class="mini-list">'+risks.map(x=>'<li><span class="dot warn"></span><div><button class="inline-link" data-goto="research">'+safe(x.name)+'</button><small>'+safe(x.status)+'｜'+(x.targetDay?'原定第'+x.targetDay+'日':'無確認期限')+'</small></div></li>').join("")+'</ul></section>';
 const pending=owed.map(x=>'<li><span class="dot"></span><div><button class="inline-link" data-goto="quests">'+
  safe(x.name)+'</button><small>'+safe(x.status)+'</small><small>'+
  safe(Number.isFinite(x.paymentPendingCopper)?"已核准待領 "+fmt(x.paymentPendingCopper)+" 銅幣":x.taskDetails?.payment||x.details||"")+
  '</small></div></li>').join("");
 html+='<section class="panel"><h3>待驗收／待領款</h3><ul class="mini-list">'+
  (pending||'<li>目前無待追蹤紀錄。</li>')+'</ul></section></div>';
 const important=[
  entries("characters").find(x=>x.id==="CHAR-VALEN"),
  r.find(x=>x.id==="R-PURIFY-01"),
  entries("sidelines").find(x=>x.id==="S-ESTATE"),
  tasks.find(x=>questFocus(x.status)==="active")
 ].filter(Boolean);
 html+=section("近期關注",'<div class="grid">'+important.map(card).join("")+"</div>","重點提示");
 const recent=orderedTimeline(timelineRows()).slice(0,4);
 html+=section("最近事件",timelineCoverage()+'<div class="grid">'+recent.map(x=>card({id:"第"+x.day+"日"+(x.time?" "+x.time:""),name:x.title,status:x.status||"歷史紀錄",details:x.summary||x.details})).join("")+
  '</div><button class="inline-link timeline-link" type="button" data-goto="timeline">查看事件時間軸</button>',countShown(recent.length));
 html+='<div class="section-heading"><h2>同步與資料來源</h2></div><section class="panel"><div class="stat-row"><span>看板同步計數器</span><strong>'+DATA.sync.turnsSinceSuccessfulSync+'/'+DATA.sync.intervalTurns+'</strong></div><div class="stat-row"><span>正式增量／完整存檔計數器</span><strong>'+DATA.snapshot.incrementalCounter+'/25・'+DATA.snapshot.fullCounter+'/50</strong></div><div class="stat-row"><span>權威基準</span><strong>'+safe(DATA.snapshot.officialSave)+'</strong></div><p class="panel-note">'+safe(DATA.sync.note)+'</p></section>';
 return html;
}
function renderHero(){
 const h=DATA.hero,adv=h.advancement;
 const verifiedPayments=entries("quests").filter(row=>Number.isFinite(row.paymentPendingCopper));
 const pending=verifiedPayments.length?verifiedPayments.reduce((sum,row)=>
  questFocus(row.status)==="followup"?sum+row.paymentPendingCopper:sum,0):h.uncollectedBaseCopper;
 const pendingLabel=verifiedPayments.length?"已核准但未領報酬":"已核准但未領基本報酬";
 const chips=h.chips.map(x=>'<span>'+safe(x)+'</span>').join("");
 return '<div class="character-feature"><section class="large-stat"><h2>澈 <span class="tag good">B級冒險者</span></h2><p>男性穿越者・非勇者｜主裝備：'+safe(h.equipped)+'</p>'+
 '<div class="stat-row"><span>唯一可支配銅幣</span><strong>'+fmt(h.cashCopper)+'</strong></div>'+
 '<div class="stat-row"><span>奧斯文代管專款</span><strong>'+fmt(h.thirdPartyHeldCopper)+'（不計入現金）</strong></div>'+
 '<div class="stat-row"><span>'+pendingLabel+'</span><strong>'+fmt(pending)+'</strong></div>'+
 '<div class="stat-row"><span>合格任務晉升</span><strong>'+adv.qualified+' / '+adv.qualifiedTarget+'</strong></div>'+
 '<div class="progress"><span style="width:'+Math.min(100,adv.qualified/adv.qualifiedTarget*100)+'%"></span></div>'+
 '<p>困難任務：'+adv.hard+'/'+adv.hardTarget+'｜護甲晶片：'+h.chipsUsed+'/'+h.chipsCapacity+'</p>'+
 '<p>主要能力：'+safe(h.abilities.join("、"))+'</p></section>'+
 '<section class="large-stat"><h2>晶片配置</h2><p>夢想二號機・已裝12／15槽</p><div class="card-details">'+chips+'</div><p>未裝晶片不會被看板自動補上。剩餘3槽。</p><p class="panel-note">'+safe(h.note)+'</p></section></div>';
}
function timelineMinutes(time=""){
 const exact=/^(\d{1,2}):(\d{2})/.exec(time);
 if(exact)return Number(exact[1])*60+Number(exact[2]);
 // Place approximate periods in order while displaying the original wording.
 if(/晚|夜/.test(time))return 18*60;
 if(/午後|下午|中午/.test(time))return 12*60;
 if(/上午|早|晨/.test(time))return 6*60;
 return -1;
}
function timelinePoint(day,time=""){
 const clock=/^(\d{1,2}:\d{2})(?:\s*[–—～-]\s*(\d{1,2}:\d{2}))?$/.exec(time);
 if(!Number.isInteger(day)||!clock)return null;
 const end=clock[2]||clock[1];
 const [hour,minute]=end.split(":").map(Number);
 if(hour>23||minute>59)return null;
 return {day,time:end.padStart(5,"0"),order:day*1440+hour*60+minute};
}
function latestTimelinePoint(rows){
 return rows.reduce((latest,row)=>{
  const point=timelinePoint(row.day,row.time);
  return point&&(!latest||point.order>latest.order)?point:latest;
 },null);
}
function timelineCoverage(){
 const latest=latestTimelinePoint(entries("timeline"));
 const snapshot=timelinePoint(DATA.snapshot.gameDay,DATA.snapshot.gameTime);
 const verified=DATA.sync.timelineVerifiedThrough;
 const reviewed=timelinePoint(verified?.gameDay,verified?.gameTime);
 const needsDetails=timelineRows().some(row=>row.status==="摘要待補");
 const behind=snapshot&&(!latest||latest.order<snapshot.order)&&reviewed?.order!==snapshot.order;
 const label=latest?"時間軸詳情更新至第"+latest.day+"日 "+latest.time:"時間軸尚無可核對的詳情時點";
 const note=needsDetails?"部分同步摘要已暫列於時間軸，詳情待補。":
  behind?"快照時間已更新，時間軸詳情尚未核對到該時點。":"";
 return '<p class="timeline-note">'+safe(label)+'</p>'+
  (note?'<div class="info-banner">'+safe(note)+'</div>':"");
}
function orderedTimeline(rows){
 const endOrder=row=>timelinePoint(row.day,row.time)?.order??row.day*1440+timelineMinutes(row.time);
 return [...rows].sort((a,b)=>endOrder(b)-endOrder(a));
}

function timelineEvent(row){
 const people=Array.isArray(row.people)?row.people.join("、"):row.people;
 const facts=[["地點",row.location],["人物",people]].filter(([,value])=>value);
 const steps=Array.isArray(row.steps)?row.steps:[];
 const metadata=facts.length?'<dl class="timeline-facts">'+facts.map(([label,value])=>
  '<div><dt>'+safe(label)+'</dt><dd>'+safe(value)+'</dd></div>').join("")+'</dl>':"";
 return '<details class="timeline-event"><summary><span class="timeline-preview">'+
  '<span class="timeline-when">'+safe(row.time||"時間未記載")+'</span>'+
  '<span class="timeline-title">'+safe(row.title)+'</span>'+
  (row.summary||row.status==="摘要待補"?'<span class="timeline-summary">'+safe(row.summary||row.status)+'</span>':"")+
  '</span><span class="timeline-action" aria-hidden="true"><span class="timeline-expand">展開</span><span class="timeline-collapse">收合</span></span></summary>'+
  '<div class="timeline-body">'+metadata+
  (row.details?'<p>'+safe(row.details)+'</p>':"")+
  (steps.length?'<ol class="timeline-steps">'+steps.map(step=>'<li>'+safe(step)+'</li>').join("")+'</ol>':"")+
  (row.outcome?'<p class="timeline-outcome"><strong>結果與後續</strong>'+safe(row.outcome)+'</p>':"")+
  (row.source?'<p class="timeline-source">來源 · '+safe(row.source)+'</p>':"")+'</div></details>';
}

function renderTimeline(rows){
 if(!rows.length)return cardGrid(rows);
 const days=new Map();
 for(const row of orderedTimeline(rows)){
  if(!days.has(row.day))days.set(row.day,[]);
  days.get(row.day).push(row);
 }
 return '<p class="timeline-note">事件按確認時點由近到遠排列。頁首的遊戲時間為看板快照。</p>'+
  [...days].map(([day,events])=>'<section class="timeline-day"><h3>第'+safe(day)+'日</h3>'+
   '<div class="timeline-events">'+events.map(timelineEvent).join("")+'</div></section>').join("");
}
const EQUIPMENT_SECTIONS=[
 ["近戰武器","持有武器｜近戰"],
 ["遠程武器","持有武器｜遠程"],
 ["透明武器","持有武器｜透明"],
 ["武器移轉","已轉交的武器"]
];

function renderEquipment(rows){
 if(!rows.length)return cardGrid(rows);
 const armor=rows.find(row=>row.id==="EQ-DREAM2");
 const modes=Array.isArray(armor?.modes)?armor.modes:[];
 const matchingModes=query?modes.filter(mode=>searchText(mode).toLocaleLowerCase().includes(query.toLocaleLowerCase())):[];
 const visibleModes=matchingModes.length?matchingModes:modes;
 const modesPanel=visibleModes.length?section("夢想二號機的五種模式",
  '<ul class="equipment-modes">'+visibleModes.map(mode=>'<li><strong>'+safe(mode.name)+'</strong>'+
   (mode.details?'<span>'+safe(mode.details)+'</span>':"")+'</li>').join("")+'</ul>'+
  '<p class="equipment-modes-note">模式名稱依正式存檔列出。完整測試與驗收狀態待核對。</p>'):"";
 const weaponPanels=EQUIPMENT_SECTIONS.map(([category,title])=>{
  const group=rows.filter(row=>row.category===category);
  return group.length?section(title,cardGrid(group),countShown(group.length)):"";
 }).join("");
 const other=rows.filter(row=>!EQUIPMENT_SECTIONS.some(([category])=>category===row.category));
 const otherPanel=other.length?section("護甲、晶片與其他裝備",cardGrid(other),countShown(other.length)):"";
 return modesPanel+weaponPanels+otherPanel;
}

const INVENTORY_SECTIONS=[
 "完整構裝體","交易後確認保留","第193日日間回收","第193～194日夜間回收"
];
const INVENTORY_ARCHIVE_SECTIONS=[
 ["已出售紀錄","已出售"],["軍方代管","軍方代管"],
 ["成交後待核對","原回收清冊・成交後待核對"],["已移交紀錄","已移交軍方"]
];

function inventoryButton(row,name,index){
 const item=index==null?"":' data-inventory-item="'+index+'"';
 return '<button type="button" class="inventory-name" data-inventory-id="'+safe(row.id)+'"'+item+
  ' aria-haspopup="dialog">'+safe(name)+'</button>';
}

function inventoryList(rows){
 return '<ul class="inventory-list">'+rows.map(row=>{
  const nameButton=inventoryButton(row,row.name||row.title||row.id);
  if(!row.items?.length)return '<li>'+nameButton+'</li>';
  const entries=row.items.map((item,index)=>({item,index}));
  const matches=query?entries.filter(({item})=>searchText(item).toLocaleLowerCase().includes(query.toLocaleLowerCase())):[];
  const visible=matches.length?matches:entries;
  return '<li class="inventory-batch"><h3>'+nameButton+'</h3><ul class="inventory-list">'+
   visible.map(({item:[name],index})=>'<li>'+inventoryButton(row,name,index)+'</li>').join("")+'</ul></li>';
 }).join("")+'</ul>';
}

function renderInventoryLedger(){
 const ledger=DATA.inventoryLedger;
 if(filter||!ledger?.movements?.length)return "";
 const matches=ledger.movements.filter(allMatch);
 if(!matches.length)return "";
 const items=[...matches].reverse().map(row=>'<li><button type="button" class="inventory-name" data-inventory-movement="'+
  safe(row.id)+'" aria-haspopup="dialog">'+safe(row.name)+'</button></li>').join("");
 const notes=ledger.notes?.length?'<details class="inventory-history"><summary>核對備註</summary><ul>'+
  ledger.notes.map(note=>'<li>'+safe(note)+'</li>').join("")+'</ul></details>':"";
 return '<details class="inventory-history"'+(query?' open':'')+'><summary>物品進出明細 <small>'+
  countShown(matches.length)+'</small></summary><p>來源 '+safe(ledger.source)+' '+safe(ledger.version)+
  '，核對至'+safe(ledger.reviewedThrough)+'。數量與去向以各筆異動當時的紀錄為準。</p>'+
  '<ul class="inventory-list">'+items+'</ul>'+notes+'</details>';
}

function renderInventory(rows){
 const review=DATA.inventoryReview;
 const note=review?.gameDay?'<div class="info-banner">新增物資核對至第'+safe(review.gameDay)+'日 '+safe(review.gameTime)+
  '。頁首顯示全站 GH 快照。'+safe(review.scope||"")+'</div>':"";
 const ledger=renderInventoryLedger();
 if(!rows.length)return note+(ledger||cardGrid(rows));
 const groups=INVENTORY_SECTIONS.map(category=>{
  const group=rows.filter(row=>row.category===category);
  return group.length?section(category,inventoryList(group)):"";
 }).join("");
 const other=rows.filter(row=>!INVENTORY_SECTIONS.includes(row.category)&&
  !INVENTORY_ARCHIVE_SECTIONS.some(([category])=>category===row.category));
 const archive=INVENTORY_ARCHIVE_SECTIONS.map(([category,title])=>{
  const group=rows.filter(row=>row.category===category);
  return group.length?'<details class="inventory-history"'+(query||filter?' open':'')+'>'+
   '<summary>'+safe(title)+' <small>'+countShown(group.length)+'</small></summary>'+inventoryList(group)+'</details>':"";
 }).join("");
 return note+ledger+groups+(other.length?section("其他庫存",inventoryList(other)):"")+
  (archive?section("歷史與代管紀錄",archive):"");
}

function inventoryDialogFacts(values){
 return '<dl class="inventory-dialog-facts">'+values.map(([name,value])=>
  '<div><dt>'+safe(name)+'</dt><dd>'+safe(value)+'</dd></div>').join("")+'</dl>';
}

function openInventoryDialog(title,body){
 $("inventory-dialog-title").textContent=title;
 $("inventory-dialog-body").innerHTML=body;
 $("inventory-dialog").showModal();
}

function showInventoryMovement(id){
 const row=DATA.inventoryLedger?.movements.find(entry=>entry.id===id);
 if(!row)return;
 openInventoryDialog(row.name,inventoryDialogFacts([
  ["遊戲時間",row.time],["異動",row.movement],["異動後狀態及去向",row.result],
  ["異動 ID",row.id],["來源",row.source]
 ]));
}

function showInventoryDetail(button){
 const {inventoryId,inventoryItem}=button.dataset;
 const row=entries("inventory").find(entry=>entry.id===inventoryId);
 if(!row)return;
 const item=inventoryItem==null?null:row.items?.[Number(inventoryItem)];
 if(inventoryItem!=null&&!item)return;
 const quote=item?row.itemQuoteCopper?.[item[0]]:null;
 const quantityLabel=Number.isSafeInteger(quote)?"報價記載數量":row.category==="成交後待核對"?"原紀錄數量":"數量";
 const facts=[
  ["狀態",row.status],[quantityLabel,item?.[1]??row.count],["保管位置",row.place],
  ["所屬批次",item?row.name:""],
  ["原報價",Number.isSafeInteger(quote)?fmt(quote)+" 銅幣":""],
  ["批次成交",!item&&Number.isSafeInteger(row.soldForCopper)?fmt(row.soldForCopper)+" 銅幣":""],["紀錄 ID",row.id],
  ["最近核對",row.updatedDay!=null?"第"+row.updatedDay+"日":""],["來源",row.source]
 ].filter(([,value])=>value!=null&&value!=="");
 openInventoryDialog(item?.[0]??row.name??row.title??row.id,inventoryDialogFacts(facts)+
  (row.details?'<p>'+safe(row.details)+'</p>':"")+
  (!item&&row.items?.length?'<h3>批次品項</h3>'+inventoryDialogFacts(row.items.map(([name,count])=>{
    const quote=row.itemQuoteCopper?.[name];
    return [name,count+(Number.isSafeInteger(quote)?" · 原報價 "+fmt(quote)+" 銅幣":"")];
   })):""));
}

function render(){
 if(!DATA)return;
 const cfg=TABS[page],p=$("content");
 $("page-title").textContent=cfg[0];
 $("page-description").textContent=cfg[1];
 $("quest-category-filter").hidden=page!=="quests";
 $("quest-priority").hidden=page!=="quests";
 const rows=pageRows();
 const showToolbar=page!=="overview";
 const placeholder=page==="timeline"?"搜尋事件、人物、地點或任務 ID…":"搜尋名稱、任務ID、物品位置、NPC或研究…";
 $("search").placeholder=page==="overview"?"選擇左側分類後搜尋資料…":placeholder;
 $("search").disabled=!showToolbar;$("status-filter").disabled=!showToolbar;
 $("clear-filters").disabled=!showToolbar;
 if(page==="overview"){p.innerHTML=renderOverview();return;}
 if(page==="characters"){
   const result=rows.filter(allMatch);
   p.innerHTML=renderHero()+section("人物狀態",cardGrid(result),countShown(result.length));
   return;
 }
 const result=rows.filter(allMatch);
 if(page==="equipment"){p.innerHTML=renderEquipment(result);return;}
 if(page==="inventory"){p.innerHTML=renderInventory(result);return;}
 if(page==="quests"){p.innerHTML=renderQuestCategories(result);return;}
 if(page==="player-commissions"){p.innerHTML=renderPlayerCommissions(result);return;}
 if(page==="timeline"){p.innerHTML=section("事件時間軸",timelineCoverage()+renderTimeline(result),countShown(result.length));return;}
 let heading=cfg[0]; 
 let pre="";
 if(page==="research")pre='<div class="info-banner">「目標第N日」不等於完成日；「舊案待清查」也不等於製造失敗。系統只按正式來源明確紀錄顯示狀態。</div>';
 if(page==="prices")pre='<div class="info-banner">此處是已確認成交的永久價格索引，不會產生購物、扣款或庫存變動。第一版仍在補齊完整歷史價格目錄。</div>';
 if(page==="sidelines"||page==="workforce")pre='<div class="info-banner">部分支線的最近專題來源早於第191日。標記「第97日」代表最後核對來源，不應當作第191日的最新實際營運結果。</div>';
 p.innerHTML=pre+section(heading,cardGrid(result),countShown(result.length));
}
function init(){
 document.querySelectorAll("#nav button").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
 $("menu-toggle").addEventListener("click",()=>document.querySelector(".sidebar").classList.toggle("open"));
 $("content").addEventListener("click",event=>{
  const movement=event.target.closest("[data-inventory-movement]");
  if(movement){
   showInventoryMovement(movement.dataset.inventoryMovement);
   return;
  }
  const button=event.target.closest("[data-inventory-id]");
  if(button)showInventoryDetail(button);
 });
 document.addEventListener("click",e=>{const b=e.target.closest("[data-goto]");if(b)navigate(b.dataset.goto)});
 $("quest-category-filter").addEventListener("click",e=>{
  const button=e.target.closest("[data-quest-category]");
  if(!button||button.dataset.questCategory===questFilter)return;
  questFilter=button.dataset.questCategory;
  refreshPageFilters();
 });
 $("quest-priority").addEventListener("click",e=>{
  const jump=e.target.closest("[data-quest-jump]");
  if(jump)$(jump.dataset.questJump).focus();
 });
 $("search").addEventListener("input",e=>{query=e.target.value.trim();render()});
 $("status-filter").addEventListener("change",e=>{filter=e.target.value;render()});
 $("clear-filters").addEventListener("click",()=>{
  query="";questFilter="";$("search").value="";$("status-filter").value="";
  refreshPageFilters();
 });
 window.addEventListener("hashchange",()=>{
  const wanted=location.hash.slice(1)||"overview";
  if(wanted!==page&&Object.hasOwn(TABS,wanted))navigate(wanted,false);
 });
 const wanted=location.hash.slice(1);
 page=Object.hasOwn(TABS,wanted)?wanted:"overview";
 markActivePage();
 $("quest-category-filter").innerHTML=[["","全部"],...QUEST_CATEGORIES].map(([key,title])=>
  '<button type="button" data-quest-category="'+safe(key)+'">'+safe(title)+'</button>').join("");
}
async function load(){
 const request=++loadSequence;
 $("top-status").textContent=DATA?"更新資料中…":"載入中";
 try{
  const response=await fetch("./data/latest.json?refresh="+Date.now()+"-"+request,{cache:"no-store"});
  if(!response.ok)throw new Error("HTTP "+response.status);
  const payload=await response.text();
  if(request!==loadSequence)return;
  if(payload!==loadedPayload){
   const d=JSON.parse(payload);
   if(d.schemaVersion!=="1.0"||!d.snapshot||!d.sync||!d.hero?.advancement||
      !Array.isArray(d.hero.chips)||!Array.isArray(d.hero.abilities)||
      !Array.isArray(d.quests)||!Array.isArray(d.research))throw new Error("資料格式不符");
   DATA=d;
   $("snapshot-label").textContent="遊戲時間：第"+d.snapshot.gameDay+"日 "+d.snapshot.gameTime;
   $("location-label").textContent="目前位置："+d.snapshot.location;
   $("save-label").textContent="正式來源："+d.snapshot.officialSave;
   $("side-sync").textContent=currentCounters();
   const n=$("notice");
   n.hidden=false;n.textContent="玩家查詢專用看板｜"+d.snapshot.scope;
   refreshPageFilters();
   loadedPayload=payload;
  }
  $("top-status").textContent="資料截至第"+DATA.snapshot.gameDay+"日"+(DATA.snapshot.gameTime?" "+DATA.snapshot.gameTime:"");
 }catch(err){
  if(request!==loadSequence)return;
  if(DATA){
   $("top-status").textContent="更新失敗 · 顯示上次資料";
   return;
  }
  $("top-status").textContent="資料讀取失敗";
  $("content").innerHTML='<div class="empty">無法載入資料檔。請再點左側選單重試，或檢查 <a href="./data/latest.json">latest.json</a> 是否已部署。<p>'+safe(err.message)+'</p></div>';
 }
}
document.addEventListener("DOMContentLoaded",()=>{init();load()});
