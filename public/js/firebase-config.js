// 1) Firebase Console > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성에서 값을 복사해 넣으세요.
export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Cloud Functions를 배포한 리전과 같게 맞추세요.
export const FUNCTIONS_REGION = "asia-northeast3";
