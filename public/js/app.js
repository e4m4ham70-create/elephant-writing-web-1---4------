import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { firebaseConfig, FUNCTIONS_REGION } from "./firebase-config.js";

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);
const functions = getFunctions(fb, FUNCTIONS_REGION);

const checkWriting = httpsCallable(functions, "checkWriting");
const generateWritingImage = httpsCallable(functions, "generateWritingImage");

const $ = (id) => document.getElementById(id);
const state = {
  currentStep: 1,
  sessionId: null,
  uid: null,
  student: { class:"", number:"", name:"" },
  ideas: {
    problem:"", event:"", originalSolution:"",
    technology:[], technologyReason:"",
    function:"", elephantHelp:"", villagerHelp:"", peopleRole:""
  },
  firstDraft:"",
  aiReview:[],
  finalDraft:"",
  reflection:"",
  imagePrompt:"",
  imageDataUrl:"",
  completedSteps:[]
};

const steps = [
  ["Understand", "본문의 문제와 해결을 확인합니다."],
  ["Choose", "공존을 돕는 기술을 선택합니다."],
  ["Function", "기술이 무엇을 할 수 있는지 정합니다."],
  ["Help Both", "코끼리와 주민 모두에게 주는 도움을 생각합니다."],
  ["People's Role", "사람들이 해야 할 일을 정합니다."],
  ["Idea Board", "지금까지의 답을 한곳에 모아 확인합니다."],
  ["First Draft", "모은 답을 활용해 1차 글을 직접 씁니다."],
  ["AI Check", "AI에게 영어 표현만 점검받습니다."],
  ["My Choice", "AI 제안을 사용할지 스스로 선택합니다."],
  ["Final Writing", "내가 결정한 표현으로 최종 글을 완성합니다."],
  ["My Picture", "최종 글의 내용을 반영한 그림을 생성합니다."]
];

function esc(s=""){ return s.replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
function splitSentences(text=""){ return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(x=>x.trim()).filter(Boolean) || []; }
function toast(msg){ $("toast").textContent=msg; $("toast").classList.remove("hidden"); setTimeout(()=>$("toast").classList.add("hidden"),1800); }
function setSaveStatus(msg){ $("saveStatus").textContent=msg; }

function buildNav(){
  $("stepNav").innerHTML = steps.map((s,i)=>`
    <button data-step="${i+1}" class="${state.currentStep===i+1?"active":""} ${state.completedSteps.includes(i+1)?"done":""}">
      ${i+1}<br>${s[0]}
    </button>`).join("");
  [...$("stepNav").querySelectorAll("button")].forEach(b=>b.onclick=()=>goStep(Number(b.dataset.step)));
}

function inputQuestion(title, ko, key, options, {multi=false, placeholder="직접 쓰기"}={}){
  const current = key.includes(".") ? "" : state.ideas[key];
  const type = multi ? "checkbox" : "radio";
  const name = `q_${key}`;
  const selected = Array.isArray(current)? current : [current];
  return `<div class="question">
    <h3>${title}</h3><div class="ko">${ko}</div>
    <div class="choice-grid">
      ${options.map((o,idx)=>`
        <label class="choice"><input type="${type}" name="${name}" value="${esc(o.value)}" ${selected.includes(o.value)?"checked":""}>
          <span><strong>${o.label || o.value}</strong>${o.note?`<small>${o.note}</small>`:""}</span>
        </label>`).join("")}
    </div>
    <input id="${key}_custom" style="margin-top:9px" placeholder="${placeholder}">
  </div>`;
}

function selectedValue(name, multi=false){
  const nodes=[...document.querySelectorAll(`[name="${name}"]:checked`)];
  return multi ? nodes.map(n=>n.value) : (nodes[0]?.value || "");
}
function customOr(name,key,multi=false){
  const picked=selectedValue(name,multi);
  const custom=$(`${key}_custom`)?.value.trim();
  if(multi){ return custom ? [...picked, custom] : picked; }
  return custom || picked;
}

function renderStep(){
  buildNav();
  $("stepBadge").textContent=state.currentStep;
  $("stepTitle").textContent=steps[state.currentStep-1][0];
  $("stepSubtitle").textContent=steps[state.currentStep-1][1];
  $("prevBtn").disabled=state.currentStep===1;
  $("nextBtn").textContent=state.currentStep===11?"완료":"다음 →";

  let html="";
  switch(state.currentStep){
    case 1:
      html = inputQuestion("Why did the elephants come to the village?","코끼리가 마을에 온 이유는 무엇인가요?","problem",[
        {value:"They could not find food in the forest."},
        {value:"They were hungry and came near the village."}
      ]) + inputQuestion("What did the elephants do then?","그 후 코끼리들은 무엇을 했나요?","event",[
        {value:"They came to eat food on the farms."},
        {value:"They ate food on the farms."}
      ]) + inputQuestion("What was the final solution in the story?","본문의 마지막 해결 방법은 무엇이었나요?","originalSolution",[
        {value:"The villagers planted rice and bananas near the forest."}
      ]);
      break;
    case 2:
      html = inputQuestion("Which technology can help?","코끼리와 사람이 안전하게 공존하도록 도와줄 기술을 1~2개 선택하세요.","technology",[
        {value:"motion sensor",label:"Motion sensor",note:"코끼리의 움직임 감지"},
        {value:"thermal camera",label:"Thermal camera",note:"밤에도 코끼리의 위치 확인"},
        {value:"GPS collar",label:"GPS collar",note:"코끼리의 이동 경로 확인"},
        {value:"warning app",label:"Warning app",note:"코끼리가 다가오면 주민에게 경고"},
        {value:"AI system",label:"AI system",note:"이동 자료를 분석해 접근 예측"}
      ],{multi:true}) + inputQuestion("Why did you choose it?","왜 그 기술을 선택했나요?","technologyReason",[
        {value:"It can find elephants quickly."},
        {value:"It can warn the villagers."},
        {value:"It can protect elephants safely."},
        {value:"It can help both elephants and people."}
      ]);
      break;
    case 3:
      html = inputQuestion("What can the technology do?","선택한 기술은 무엇을 할 수 있나요?","function",[
        {value:"find elephants near the village"},
        {value:"send warnings to the villagers"},
        {value:"check the elephants' location"},
        {value:"predict the elephants' movement"}
      ]);
      break;
    case 4:
      html = inputQuestion("How does your idea help elephants?","이 기술은 코끼리에게 어떤 도움을 주나요?","elephantHelp",[
        {value:"guide them to food near the forest"},
        {value:"protect them without hurting them"},
        {value:"keep them away from dangerous places"}
      ]) + inputQuestion("How does your idea help villagers?","이 기술은 주민에게 어떤 도움을 주나요?","villagerHelp",[
        {value:"protect their farms"},
        {value:"help them prepare before elephants come"},
        {value:"keep the villagers safe"}
      ]);
      break;
    case 5:
      html = inputQuestion("What should people do?","기술과 함께 사람들이 해야 할 일은 무엇인가요?","peopleRole",[
        {value:"check the warnings"},
        {value:"share information"},
        {value:"prepare food near the forest"},
        {value:"use technology carefully"}
      ]) + `<div class="help-box"><strong>SMART THINKING</strong><br>Technology helps people, but people must use it carefully.</div>`;
      break;
    case 6:
      html = `<div class="help-box"><strong>You have all the ideas you need!</strong><br>아래 내용을 확인하고, 필요하면 이전 단계로 돌아가 수정하세요.</div>
        ${ideaBoardHtml()}
        <div class="question"><h3>Check My Idea</h3><div class="ko">다음을 확인해 보세요.</div>
          <label class="choice"><input type="checkbox" class="ideaCheck"> 코끼리를 해치지 않고 보호하는가?</label>
          <label class="choice"><input type="checkbox" class="ideaCheck"> 주민과 농장을 안전하게 보호할 수 있는가?</label>
          <label class="choice"><input type="checkbox" class="ideaCheck"> 먹이 부족이라는 원인을 고려했는가?</label>
          <label class="choice"><input type="checkbox" class="ideaCheck"> 기술과 사람의 역할이 모두 포함되어 있는가?</label>
        </div>`;
      break;
    case 7:
      html = `<div class="help-box"><strong>Write it yourself first.</strong><br>앞에서 모은 아이디어를 활용해 1차 글을 직접 작성하세요. 처음부터 완벽할 필요는 없습니다.</div>
        ${ideaBoardHtml()}
        <div class="question">
          <h3>My First Draft</h3><div class="ko">AI를 사용하기 전, 내가 직접 쓴 글입니다.</div>
          <textarea id="firstDraftInput" rows="12" placeholder="In the past, elephants ...">${esc(state.firstDraft)}</textarea>
          <details class="help-box"><summary><strong>HELP ME · 문장틀 보기</strong></summary>
            <p>In the past, elephants ________.</p><p>There is/are ________ near the forest.</p><p>We can use ________.</p>
            <p>It can ________.</p><p>It can protect elephants by ________.</p><p>It can help villagers by ________.</p><p>People should ________.</p>
          </details>
        </div>`;
      break;
    case 8:
      html = `<div class="ai-card">
        <strong>AI는 글을 대신 쓰지 않습니다.</strong>
        <p>내 뜻은 유지하고, 중학교 1학년이 이해할 수 있는 쉬운 영어로 문법·단어·표현만 점검합니다.</p>
      </div>
      <div class="question"><h3>My First Draft</h3><div class="draft-box">${esc(state.firstDraft)||"1차 글을 먼저 작성하세요."}</div></div>
      <button id="aiCheckBtn" class="btn primary" ${state.firstDraft.trim()?"":"disabled"}>✨ Check My English with AI</button>
      <div id="aiLoading" class="tiny hidden">AI가 문장을 확인하고 있습니다...</div>
      <div id="aiReviewPreview">${aiPreviewHtml()}</div>`;
      break;
    case 9:
      html = `<div class="ai-card"><strong>MY CHOICE</strong><br>AI의 제안을 무조건 사용하지 말고, 문장마다 내가 직접 결정하세요.</div>
      <div id="choiceList">${choiceHtml()}</div>
      <div class="question"><h3>What did you learn from AI?</h3><div class="ko">새롭게 알게 된 영어 표현이나 배운 점을 1~2문장으로 쓰세요.</div>
        <textarea id="reflectionInput" placeholder="I learned the expression ...">${esc(state.reflection)}</textarea>
      </div>`;
      break;
    case 10:
      html = `<div class="help-box"><strong>Finalize Your Writing</strong><br>AI 제안에 대한 내 선택을 반영한 글입니다. 마지막으로 직접 읽고 자유롭게 수정하세요.</div>
      <div class="question"><h3>Final Writing</h3>
        <textarea id="finalDraftInput" rows="14">${esc(state.finalDraft || buildFinalFromChoices())}</textarea>
      </div>
      <button id="finishBtn" class="btn primary">✓ FINISH MY WRITING</button>`;
      break;
    case 11:
      html = `<div class="help-box"><strong>Create a Picture for My Writing</strong><br>최종 글의 핵심 내용을 반영한 그림 아이디어를 먼저 확인한 뒤 생성합니다.</div>
      <div class="question">
        <h3>Your Picture Idea</h3>
        <div class="ko">그림에 꼭 담고 싶은 내용을 추가하거나 고칠 수 있습니다.</div>
        <textarea id="imageIdeaInput" rows="6" placeholder="예: 코끼리가 숲 근처 먹이밭으로 이동하고, 센서가 이를 감지해 주민에게 경고하는 장면">${esc(state.imagePrompt)}</textarea>
      </div>
      <button id="imageBtn" class="btn primary" ${state.finalDraft.trim()?"":"disabled"}>🎨 CREATE MY PICTURE</button>
      <div id="imageLoading" class="tiny hidden">그림을 생성하고 있습니다. 잠시 기다려 주세요...</div>`;
      break;
  }
  $("stepBody").innerHTML=html;
  attachStepEvents();
  updatePreview();
}

function ideaBoardHtml(){
  const rows=[
    ["Problem",state.ideas.problem],["What happened",state.ideas.event],["Original solution",state.ideas.originalSolution],
    ["Technology",state.ideas.technology.join(", ")],["Function",state.ideas.function],
    ["Help for elephants",state.ideas.elephantHelp],["Help for villagers",state.ideas.villagerHelp],["People's role",state.ideas.peopleRole]
  ];
  return `<table class="idea-table">${rows.map(([a,b])=>`<tr><th>${a}</th><td>${esc(b||"—")}</td></tr>`).join("")}</table>`;
}
function aiPreviewHtml(){
  if(!state.aiReview.length) return "";
  return state.aiReview.map((x,i)=>`<div class="question">
    <h3>Sentence ${i+1}</h3>
    <div class="ai-compare"><div class="ai-side"><h4>MY SENTENCE</h4>${esc(x.original)}</div>
      <div class="ai-side"><h4>AI'S SUGGESTION</h4>${esc(x.suggestion)}</div></div>
    <div class="tiny">What changed? ${(x.changes||[]).map(c=>`<span class="status-pill">${esc(c)}</span>`).join(" ")}</div>
  </div>`).join("");
}
function choiceHtml(){
  if(!state.aiReview.length) return `<div class="empty-state">먼저 STEP 8에서 AI 점검을 실행하세요.</div>`;
  return state.aiReview.map((x,i)=>`<div class="question" data-choice="${i}">
    <h3>Sentence ${i+1}</h3>
    <div class="ai-compare">
      <div class="ai-side"><h4>MY SENTENCE</h4>${esc(x.original)}</div>
      <div class="ai-side"><h4>AI'S SUGGESTION</h4>${esc(x.suggestion)}</div>
    </div>
    <div class="choice-actions">
      <button class="btn small choiceBtn ${x.choice==="mine"?"selected":""}" data-v="mine">KEEP MINE</button>
      <button class="btn small choiceBtn ${x.choice==="ai"?"selected":""}" data-v="ai">USE AI'S</button>
      <button class="btn small choiceBtn ${x.choice==="edit"?"selected":""}" data-v="edit">EDIT MYSELF</button>
    </div>
    <textarea class="selfEdit ${x.choice==="edit"?"":"hidden"}" placeholder="내가 직접 수정한 문장">${esc(x.edited||"")}</textarea>
  </div>`).join("");
}
function buildFinalFromChoices(){
  if(!state.aiReview.length) return state.firstDraft;
  return state.aiReview.map(x=>{
    if(x.choice==="ai") return x.suggestion;
    if(x.choice==="edit" && x.edited?.trim()) return x.edited.trim();
    return x.original;
  }).join(" ");
}

function attachStepEvents(){
  if(state.currentStep===8){
    $("aiCheckBtn")?.addEventListener("click", async()=>{
      $("aiLoading").classList.remove("hidden"); $("aiCheckBtn").disabled=true;
      try{
        const res=await checkWriting({ draft:state.firstDraft });
        const items=res.data?.sentences || [];
        state.aiReview=items.map(x=>({...x,choice:"mine",edited:""}));
        await saveSession();
        renderStep(); toast("AI 점검이 완료되었습니다.");
      }catch(e){ console.error(e); toast("AI 점검 중 오류가 발생했습니다."); $("aiCheckBtn").disabled=false; }
      finally{$("aiLoading")?.classList.add("hidden");}
    });
  }
  if(state.currentStep===9){
    [...document.querySelectorAll(".choiceBtn")].forEach(btn=>btn.onclick=async(e)=>{
      const wrap=e.target.closest("[data-choice]"); const idx=Number(wrap.dataset.choice);
      state.aiReview[idx].choice=e.target.dataset.v;
      if(e.target.dataset.v!=="edit") state.aiReview[idx].edited="";
      await saveSession(); renderStep();
    });
    [...document.querySelectorAll(".selfEdit")].forEach((ta,idx)=>ta.addEventListener("input",debounce(async()=>{
      state.aiReview[idx].edited=ta.value; await saveSession();
    },500)));
  }
  if(state.currentStep===10){
    $("finishBtn")?.addEventListener("click",async()=>{
      state.finalDraft=$("finalDraftInput").value.trim(); await saveSession(); toast("최종 글이 저장되었습니다."); updatePreview();
    });
  }
  if(state.currentStep===11){
    $("imageBtn")?.addEventListener("click",async()=>{
      const extra=$("imageIdeaInput").value.trim();
      $("imageLoading").classList.remove("hidden"); $("imageBtn").disabled=true;
      try{
        const res=await generateWritingImage({ finalDraft:state.finalDraft, extraIdea:extra });
        state.imagePrompt=res.data.prompt || extra;
        state.imageDataUrl=res.data.imageDataUrl || "";
        await saveSession(); updatePreview(); renderStep(); toast("그림이 완성되었습니다.");
      }catch(e){console.error(e);toast("그림 생성 중 오류가 발생했습니다.");$("imageBtn").disabled=false;}
      finally{$("imageLoading")?.classList.add("hidden");}
    });
  }
}

function collectCurrent(){
  switch(state.currentStep){
    case 1:
      state.ideas.problem=customOr("q_problem","problem");
      state.ideas.event=customOr("q_event","event");
      state.ideas.originalSolution=customOr("q_originalSolution","originalSolution"); break;
    case 2:
      state.ideas.technology=customOr("q_technology","technology",true);
      state.ideas.technologyReason=customOr("q_technologyReason","technologyReason"); break;
    case 3: state.ideas.function=customOr("q_function","function"); break;
    case 4:
      state.ideas.elephantHelp=customOr("q_elephantHelp","elephantHelp");
      state.ideas.villagerHelp=customOr("q_villagerHelp","villagerHelp"); break;
    case 5: state.ideas.peopleRole=customOr("q_peopleRole","peopleRole"); break;
    case 7: state.firstDraft=$("firstDraftInput")?.value.trim()||state.firstDraft; break;
    case 9: state.reflection=$("reflectionInput")?.value.trim()||state.reflection; break;
    case 10: state.finalDraft=$("finalDraftInput")?.value.trim()||state.finalDraft; break;
    case 11: state.imagePrompt=$("imageIdeaInput")?.value.trim()||state.imagePrompt; break;
  }
}

function validateCurrent(){
  const i=state.ideas;
  const need=(v,msg)=>{if(!v || (Array.isArray(v)&&!v.length)){toast(msg);return false}return true};
  if(state.currentStep===1) return need(i.problem,"문제의 원인을 선택하세요.")&&need(i.event,"코끼리가 한 행동을 선택하세요.")&&need(i.originalSolution,"본문의 해결 방법을 선택하세요.");
  if(state.currentStep===2) return need(i.technology,"기술을 1개 이상 선택하세요.");
  if(state.currentStep===3) return need(i.function,"기술의 기능을 선택하거나 작성하세요.");
  if(state.currentStep===4) return need(i.elephantHelp,"코끼리에게 주는 도움을 작성하세요.")&&need(i.villagerHelp,"주민에게 주는 도움을 작성하세요.");
  if(state.currentStep===5) return need(i.peopleRole,"사람들의 역할을 작성하세요.");
  if(state.currentStep===6 && [...document.querySelectorAll(".ideaCheck")].some(x=>!x.checked)){toast("4가지 항목을 모두 점검하세요.");return false;}
  if(state.currentStep===7) return need(state.firstDraft,"1차 글을 먼저 작성하세요.");
  if(state.currentStep===8) return need(state.aiReview,"AI 점검을 실행하세요.");
  if(state.currentStep===9) return state.aiReview.every(x=>x.choice!=="edit"||x.edited.trim()) || (toast("EDIT MYSELF를 선택한 문장을 직접 수정하세요."),false);
  if(state.currentStep===10) return need(state.finalDraft,"최종 글을 작성하세요.");
  return true;
}

async function goStep(n){
  collectCurrent();
  if(state.sessionId) await saveSession();
  state.currentStep=Math.min(11,Math.max(1,n)); renderStep();
}

$("prevBtn").onclick=()=>goStep(state.currentStep-1);
$("nextBtn").onclick=async()=>{
  collectCurrent();
  if(!validateCurrent()) return;
  if(!state.completedSteps.includes(state.currentStep)) state.completedSteps.push(state.currentStep);
  await saveSession();
  if(state.currentStep<11){state.currentStep++;renderStep();}
  else toast("모든 과정을 완료했습니다!");
};
$("printBtn").onclick=()=>window.print();

function updatePreview(){
  const ideaComplete=Object.values(state.ideas).some(v=>Array.isArray(v)?v.length:!!v);
  const parts=[];
  if(ideaComplete) parts.push(`<div class="journey-block"><h3>IDEAS</h3><p>${esc([
    state.ideas.problem,state.ideas.technology.join(", "),state.ideas.function,state.ideas.elephantHelp,state.ideas.villagerHelp,state.ideas.peopleRole
  ].filter(Boolean).join(" · "))}</p></div>`);
  if(state.firstDraft) parts.push(`<div class="journey-block"><h3>FIRST DRAFT</h3><div class="draft-box">${esc(state.firstDraft)}</div></div>`);
  if(state.aiReview.length){
    const used=state.aiReview.filter(x=>x.choice==="ai").length;
    const edited=state.aiReview.filter(x=>x.choice==="edit").length;
    parts.push(`<div class="journey-block"><h3>AI & MY CHOICE</h3><p>AI 제안 사용 ${used}문장 · 직접 수정 ${edited}문장 · 내 문장 유지 ${state.aiReview.length-used-edited}문장</p></div>`);
  }
  if(state.finalDraft) parts.push(`<div class="journey-block"><h3>FINAL WRITING</h3><div class="draft-box">${esc(state.finalDraft)}</div></div>`);
  if(state.reflection) parts.push(`<div class="journey-block"><h3>REFLECTION</h3><p>${esc(state.reflection)}</p></div>`);
  $("journeySummary").innerHTML=parts.length?parts.join(""):`<div class="empty-state">왼쪽에서 글쓰기를 시작하면 이곳에 과정이 모입니다.</div>`;
  if(state.imageDataUrl){
    $("finalArtBox").classList.remove("hidden"); $("finalImage").src=state.imageDataUrl; $("imagePromptView").textContent=state.imagePrompt;
  } else $("finalArtBox").classList.add("hidden");
}

async function saveSession(){
  if(!state.sessionId||!state.uid) return;
  setSaveStatus("저장 중...");
  try{
    await setDoc(doc(db,"writingSessions",state.sessionId),{
      ownerUid:state.uid, student:state.student, ideas:state.ideas,
      firstDraft:state.firstDraft, aiReview:state.aiReview,
      finalDraft:state.finalDraft, reflection:state.reflection,
      imagePrompt:state.imagePrompt, imageDataUrl:state.imageDataUrl,
      currentStep:state.currentStep, completedSteps:state.completedSteps,
      updatedAt:serverTimestamp()
    },{merge:true});
    setSaveStatus("저장됨 ✓");
  }catch(e){console.error(e);setSaveStatus("저장 실패");}
}

async function loadSession(){
  if(!state.sessionId) return;
  const snap=await getDoc(doc(db,"writingSessions",state.sessionId));
  if(snap.exists()){
    const d=snap.data();
    Object.assign(state,{
      student:d.student||state.student, ideas:{...state.ideas,...(d.ideas||{})},
      firstDraft:d.firstDraft||"", aiReview:d.aiReview||[], finalDraft:d.finalDraft||"",
      reflection:d.reflection||"", imagePrompt:d.imagePrompt||"", imageDataUrl:d.imageDataUrl||"",
      currentStep:d.currentStep||1, completedSteps:d.completedSteps||[]
    });
  }
}

$("startBtn").onclick=async()=>{
  const c=$("studentClass").value.trim(),n=$("studentNumber").value.trim(),name=$("studentName").value.trim();
  if(!c||!n||!name){toast("학급, 번호, 이름을 모두 입력하세요.");return;}
  state.student={class:c,number:n,name};
  setSaveStatus("로그인 중...");
  if(!auth.currentUser) await signInAnonymously(auth);
  state.uid=auth.currentUser.uid;
  state.sessionId=`${state.uid}`;
  await loadSession();
  // 새 입력값은 기존 저장값보다 우선
  state.student={class:c,number:n,name};
  $("workspace").classList.remove("hidden");
  await saveSession(); renderStep(); updatePreview();
};

onAuthStateChanged(auth,(user)=>{if(user) state.uid=user.uid;});

function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}
