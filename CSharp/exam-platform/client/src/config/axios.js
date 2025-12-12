// axios 기본 설정
// Render 서버 URL을 기본 URL로 설정

import axios from 'axios';
import API_BASE_URL from './api';

// axios 기본 URL 설정
axios.defaults.baseURL = API_BASE_URL;

// 요청 인터셉터 (선택사항)
axios.interceptors.request.use(
  (config) => {
    // 요청 전 로깅 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.log('API Request:', config.method?.toUpperCase(), config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 (선택사항)
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 에러 처리
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Network Error:', error.request);
    } else {
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default axios;

