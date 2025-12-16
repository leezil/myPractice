import React from 'react';
import { Link } from 'react-router-dom';
import './SubjectList.css';

function SubjectList() {
  const subjects = [
    {
      id: 'csharp',
      name: 'C#',
      description: 'C# 프로그래밍 문제 풀이',
      icon: '💻',
      color: '#667eea'
    },
    {
      id: 'parenting',
      name: '부모교육',
      description: '부모교육 강의 자료 및 정리',
      icon: '👨‍👩‍👧‍👦',
      color: '#f093fb'
    },
    {
      id: 'object-oriented',
      name: '객체지향',
      description: '객체지향 프로그래밍 문제 풀이',
      icon: '🔷',
      color: '#4facfe'
    }
    // 추가 과목은 여기에 추가할 수 있습니다
  ];

  return (
    <div className="subject-list">
      <div className="subject-list-header">
        <h1>과목 선택</h1>
        <p className="subtitle">공부하고 싶은 과목을 선택하세요</p>
      </div>
      
      <div className="subject-grid">
        {subjects.map((subject) => (
          <Link
            key={subject.id}
            to={`/${subject.id}`}
            className="subject-card"
            style={{ '--subject-color': subject.color }}
          >
            <div className="subject-icon">{subject.icon}</div>
            <h2 className="subject-name">{subject.name}</h2>
            <p className="subject-description">{subject.description}</p>
            <div className="subject-link">시작하기 →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default SubjectList;


