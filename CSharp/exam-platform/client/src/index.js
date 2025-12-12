import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import './config/axios'; // axios 기본 URL 설정

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);



