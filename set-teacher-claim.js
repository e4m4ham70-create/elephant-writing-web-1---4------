/**
 * 교사 계정에 teacher:true custom claim을 1회 부여하는 관리자용 스크립트입니다.
 * 서비스 계정 또는 Firebase CLI 인증이 가능한 안전한 로컬 환경에서만 실행하세요.
 *
 * 사용:
 *   npm i firebase-admin
 *   node set-teacher-claim.js teacher@example.com
 */
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
initializeApp();

(async()=>{
  const email=process.argv[2];
  if(!email) throw new Error("이메일을 입력하세요.");
  const user=await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid,{teacher:true});
  console.log(`완료: ${email} -> teacher:true`);
})();
