import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import SubjectList from './components/SubjectList';
import ProblemList from './components/ProblemList';
import ProblemDetail from './components/ProblemDetail';
import NotFound from './components/NotFound';
import './App.css';

// 헤더 컴포넌트 (과목 정보 표시)
function AppHeader() {
  const { subject } = useParams();
  
  const subjectNames = {
    'csharp': 'C# 프로그래밍',
    'parenting': '부모교육'
  };
  
  const subjectName = subject ? subjectNames[subject] || '과목 선택' : '문제풀이 웹페이지';
  
  return (
    <header className="app-header">
      <h1>{subjectName}</h1>
    </header>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={
            <>
              <header className="app-header">
                <h1>문제풀이 웹페이지</h1>
              </header>
              <main className="app-main">
                <SubjectList />
              </main>
            </>
          } />
          <Route path="/:subject" element={
            <>
              <AppHeader />
              <main className="app-main">
                <ProblemList />
              </main>
            </>
          } />
          <Route path="/:subject/problem/:id" element={
            <>
              <AppHeader />
              <main className="app-main">
                <ProblemDetail />
              </main>
            </>
          } />
          <Route path="*" element={
            <>
              <header className="app-header">
                <h1>문제풀이 웹페이지</h1>
              </header>
              <main className="app-main">
                <NotFound />
              </main>
            </>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

