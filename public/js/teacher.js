import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const fb=initializeApp(firebaseConfig), auth=getAuth(fb), db=getFirestore(fb);
const $=id=>document.getElementById(id); let all=[];

$("teacherLoginBtn").onclick=async()=>{
  try{ await signInWithEmailAndPassword(auth,$("teacherEmail").value.trim(),$("teacherPassword").value); }
  catch(e){ $("loginMessage").textContent="로그인에 실패했습니다. 교사 계정과 권한을 확인하세요."; }
};
$("logoutBtn").onclick=()=>signOut(auth);
$("refreshBtn").onclick=loadData;
$("classFilter").oninput=render;
$("searchInput").oninput=render;
$("csvBtn").onclick=downloadCSV;

onAuthStateChanged(auth,async(user)=>{
  $("teacherLogin").classList.toggle("hidden",!!user);
  $("teacherDashboard").classList.toggle("hidden",!user);
  $("logoutBtn").classList.toggle("hidden",!user);
  if(user){
    const token=await user.getIdTokenResult(true);
    if(token.claims.teacher!==true){
      $("teacherDashboard").innerHTML=`<div class="card"><h2>권한 없음</h2><p>이 계정에는 <code>teacher: true</code> custom claim이 없습니다.</p></div>`;
      return;
    }
    loadData();
  }
});

async function loadData(){
  try{
    const snap=await getDocs(query(collection(db,"writingSessions"),orderBy("updatedAt","desc")));
    all=snap.docs.map(d=>({id:d.id,...d.data()})); render();
  }catch(e){console.error(e);$("statsText").textContent="데이터를 읽지 못했습니다. Firestore rules와 교사 권한을 확인하세요.";}
}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function filtered(){
  const c=$("classFilter").value.trim().toLowerCase(), s=$("searchInput").value.trim().toLowerCase();
  return all.filter(x=>(!c||(x.student?.class||"").toLowerCase().includes(c))&&
    (!s||`${x.student?.name||""} ${x.student?.number||""}`.toLowerCase().includes(s)));
}
function render(){
  const rows=filtered(); $("statsText").textContent=`전체 ${rows.length}명 · 최종 글 완료 ${rows.filter(x=>x.finalDraft).length}명 · 그림 생성 ${rows.filter(x=>x.imageDataUrl).length}명`;
  $("studentTableBody").innerHTML=rows.map(x=>{
    const total=x.aiReview?.length||0, ai=x.aiReview?.filter(r=>r.choice==="ai").length||0;
    return `<tr><td>${esc(x.student?.class)}</td><td>${esc(x.student?.number)}</td><td>${esc(x.student?.name)}</td>
      <td><span class="status-pill">STEP ${x.currentStep||1}</span></td><td>${x.firstDraft?"✓":"-"}</td><td>${total?"✓":"-"}</td><td>${x.finalDraft?"✓":"-"}</td>
      <td>${total?`${ai}/${total}`:"-"}</td><td><button class="btn small viewBtn" data-id="${x.id}">보기</button></td></tr>`;
  }).join("");
  [...document.querySelectorAll(".viewBtn")].forEach(b=>b.onclick=()=>showDetail(b.dataset.id));
}
function showDetail(id){
  const x=all.find(v=>v.id===id); if(!x)return;
  const ideaRows=Object.entries(x.ideas||{}).map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(Array.isArray(v)?v.join(", "):v)}</td></tr>`).join("");
  const aiRows=(x.aiReview||[]).map((r,i)=>`<div class="question"><h3>Sentence ${i+1}</h3>
    <div class="ai-compare"><div class="ai-side"><h4>MY SENTENCE</h4>${esc(r.original)}</div><div class="ai-side"><h4>AI SUGGESTION</h4>${esc(r.suggestion)}</div></div>
    <p><strong>학생 선택:</strong> ${esc(r.choice||"mine")} ${r.edited?`→ ${esc(r.edited)}`:""}</p></div>`).join("");
  $("studentDetail").innerHTML=`<h2>${esc(x.student?.class)} ${esc(x.student?.number)}번 ${esc(x.student?.name)}</h2>
    <div class="detail-section"><h3>1. Ideas</h3><table class="idea-table">${ideaRows}</table></div>
    <div class="detail-section"><h3>2. First Draft</h3><div class="draft-box">${esc(x.firstDraft||"")}</div></div>
    <div class="detail-section"><h3>3. AI Check & My Choice</h3>${aiRows||"AI 점검 기록 없음"}</div>
    <div class="detail-section"><h3>4. Reflection</h3><div class="draft-box">${esc(x.reflection||"")}</div></div>
    <div class="detail-section"><h3>5. Final Writing</h3><div class="draft-box">${esc(x.finalDraft||"")}</div></div>
    ${x.imageDataUrl?`<div class="detail-section"><h3>6. Generated Picture</h3><img src="${x.imageDataUrl}" style="max-width:520px;width:100%;border-radius:12px"></div>`:""}`;
  $("studentDetail").classList.remove("hidden"); $("studentDetail").scrollIntoView({behavior:"smooth"});
}
function downloadCSV(){
  const rows=filtered(), headers=["class","number","name","currentStep","problem","technology","function","elephantHelp","villagerHelp","peopleRole","firstDraft","aiTotal","aiAccepted","selfEdited","reflection","finalDraft","imagePrompt"];
  const csv=[headers.join(",")].concat(rows.map(x=>{
    const vals=[x.student?.class,x.student?.number,x.student?.name,x.currentStep,x.ideas?.problem,(x.ideas?.technology||[]).join("|"),x.ideas?.function,x.ideas?.elephantHelp,x.ideas?.villagerHelp,x.ideas?.peopleRole,x.firstDraft,
      x.aiReview?.length||0,x.aiReview?.filter(r=>r.choice==="ai").length||0,x.aiReview?.filter(r=>r.choice==="edit").length||0,x.reflection,x.finalDraft,x.imagePrompt];
    return vals.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",");
  })).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}), a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="elephant-writing-data.csv";a.click();URL.revokeObjectURL(a.href);
}
