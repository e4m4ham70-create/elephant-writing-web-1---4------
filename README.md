# Smart Ways to Live with Elephants · Guided Writing Web

학생의 **아이디어 → 1차 글 → AI 영어 표현 점검 → 학생의 선택 → 최종 글 → 그림 생성** 전 과정을 저장하고,
교사가 대시보드/CSV로 확인할 수 있는 시작 프로젝트입니다.

## 파일 구조

- `public/index.html` 학생용
- `public/teacher.html` 교사용
- `public/js/app.js` 학생 글쓰기 로직
- `public/js/teacher.js` 교사 대시보드
- `public/js/firebase-config.js` Firebase 설정
- `functions/index.js` OpenAI 서버 호출
- `firestore.rules` 학생/교사 접근 제어

## 1. Firebase 설정

Firebase Console에서 다음을 켭니다.

1. Authentication
   - Anonymous: 학생용
   - Email/Password: 교사용
2. Firestore Database
3. Cloud Functions / Hosting

`public/js/firebase-config.js`에 본인 Firebase Web App 설정값을 넣습니다.

## 2. OpenAI API 키는 브라우저에 넣지 않습니다

API 키는 Firebase Secret Manager에 저장합니다.

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

그 다음 배포합니다.

```bash
cd functions
npm install
cd ..
firebase deploy --only functions,firestore:rules,hosting
```

OpenAI 호출은 `functions/index.js`에서만 이루어집니다.

- 영어 점검: Responses API
- 그림 생성: Image API

## 3. 교사 계정 권한

Firebase Authentication에서 교사용 Email/Password 계정을 만든 뒤,
`set-teacher-claim.js`를 안전한 관리자 환경에서 실행해 `teacher:true` custom claim을 줍니다.

```bash
node set-teacher-claim.js teacher@example.com
```

로그아웃/재로그인 후 `teacher.html`에서 학생 데이터를 볼 수 있습니다.

## 4. 학생 사용 흐름

1. 학급/번호/이름
2. 문제 이해
3. 기술 선택
4. 기술 기능
5. 코끼리/주민 도움
6. 사람 역할
7. Idea Board
8. First Draft
9. AI Check
10. My Choice
11. Final Writing
12. 최종 글 기반 그림 생성

UI에서는 STEP 1~11로 표시되며, 문제/기술/기능 등의 아이디어 단계가 세분화되어 있습니다.

## 5. 교사가 받는 데이터

Firestore `writingSessions` 문서에 다음이 저장됩니다.

- 학생 정보
- 단계별 아이디어
- `firstDraft`
- 문장별 `aiReview`
  - original
  - suggestion
  - changes
  - choice (`mine`, `ai`, `edit`)
  - edited
- reflection
- finalDraft
- imagePrompt
- imageDataUrl
- currentStep / completedSteps / updatedAt

교사용 화면에서 개인별 전체 과정을 확인하고 CSV로 내려받을 수 있습니다.

## 중요한 운영 메모

현재 샘플은 구현을 단순하게 하기 위해 생성 이미지를 `data:image/png;base64,...` 형태로 Firestore 문서에 넣습니다.
**실제 학급 운영에서는 Firestore 문서 크기 제한 때문에 이미지는 Firebase Storage에 저장하고 URL만 Firestore에 저장하는 방식으로 바꾸는 것이 좋습니다.**
또한 학생 이름을 수집한다면 학교의 개인정보 처리 기준에 맞게 수집 목적, 보관 기간, 삭제 정책을 정해 주세요.

## 다음 개선 추천

- 학급 코드/수업 코드 기반 입장
- 학생 이름 대신 익명 학생 코드 선택 가능
- 그림을 Firebase Storage에 저장
- 교사용 실시간 진행률(onSnapshot)
- 교사가 수업별 과제를 생성하는 `assignments` collection
- 글자 수/문장 수/AI 수용률 자동 분석
- 제출 잠금 및 재제출 기능
