// API 설정 파일
// 프로덕션 환경에서는 Render 서버 URL 사용
// 개발 환경에서는 로컬 서버 사용

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://mypractice-t7rx.onrender.com'  // Render 서버 URL
    : 'http://localhost:5000');

export default API_BASE_URL;

