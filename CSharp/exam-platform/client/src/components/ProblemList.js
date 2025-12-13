import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import './ProblemList.css';

function ProblemList() {
  const { subject } = useParams();
  const [allProblems, setAllProblems] = useState([]);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedConcepts, setSelectedConcepts] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [filterMode, setFilterMode] = useState('OR'); // 'OR' 또는 'AND'
  const [selectedWeeks, setSelectedWeeks] = useState([]); // 부모교육 주차 필터
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // C# 문제 유형
  const csharpProblemTypes = [
    { value: 'all', label: '전체', icon: '📚' },
    { value: 'fill', label: '빈칸 채우기', icon: '✏️' },
    { value: 'method', label: '메소드 만들기', icon: '⚙️' },
    { value: 'class', label: '클래스 만들기', icon: '🏗️' },
    { value: 'full', label: '전체 코드 작성', icon: '💻' },
    { value: 'full2', label: '전체 코드 작성2', icon: '💻' }
  ];

  // 부모교육 문제 유형
  const parentingProblemTypes = [
    { value: 'all', label: '전체', icon: '📚' },
    { value: 'multiple_choice', label: '객관식', icon: '🔘' },
    { value: 'short_answer', label: '단답형', icon: '✍️' },
    { value: 'essay', label: '서술형', icon: '📝' }
  ];

  // 과목에 따른 문제 유형 선택
  const problemTypes = subject === 'parenting' ? parentingProblemTypes : csharpProblemTypes;

  // 문제에서 개념 추출 함수 (JSON에 concepts 필드가 있으면 사용, 없으면 코드에서 추출)
  const extractConcepts = (problem) => {
    // JSON에 concepts 필드가 있으면 우선 사용
    if (problem.concepts && Array.isArray(problem.concepts)) {
      return problem.concepts;
    }
    
    // 없으면 기존 방식으로 추출
    const concepts = [];
    const code = (problem.template || '') + (problem.answer || '') + (problem.exampleCode || '');
    
    // 각 개념별 패턴 체크
    if (code.includes('Thread') || code.includes('ThreadStart') || code.includes('ParameterizedThreadStart') || code.includes('Thread.Sleep') || code.includes('Thread.Join')) {
      concepts.push('Thread');
    }
    if (code.includes('async') || code.includes('await') || code.includes('Task.Run') || code.includes('Task.Delay') || code.includes('Task.WaitAll')) {
      concepts.push('async-await');
    }
    if (code.includes('<T>') || code.includes('<TT>') || code.includes('<D>') || code.includes('<K>') || code.includes('MyStack<') || code.includes('List<') || code.includes('Dictionary<')) {
      concepts.push('제네릭');
    }
    if (code.includes('ref ') || code.includes('out ')) {
      concepts.push('ref-out');
    }
    if (code.includes('ICloneable') || code.includes('MemberwiseClone')) {
      concepts.push('ICloneable');
    }
    if (code.includes('IComparable') || code.includes('CompareTo')) {
      concepts.push('IComparable');
    }
    if (code.includes('IEnumerable') || code.includes('IEnumerator') || code.includes('GetEnumerator')) {
      concepts.push('IEnumerable');
    }
    if (code.includes('delegate') || code.includes('Action<') || code.includes('Func<')) {
      concepts.push('델리게이트');
    }
    if (code.includes('event ') || code.includes('EventHandler') || code.includes('EventArgs')) {
      concepts.push('이벤트');
    }
    if (code.includes('.Select') || code.includes('.Where') || code.includes('.OrderBy') || code.includes('System.Linq')) {
      concepts.push('LINQ');
    }
    if (code.includes('this ') && code.includes('static') && code.includes('IEnumerable')) {
      concepts.push('확장메소드');
    }
    if (code.includes('try') || code.includes('catch') || code.includes('throw') || code.includes('Exception')) {
      concepts.push('예외처리');
    }
    if (code.includes('lock') || code.includes('Monitor')) {
      concepts.push('lock');
    }
    if (code.includes('abstract') || code.includes('override') || code.includes('virtual')) {
      concepts.push('다형성');
    }
    if (code.includes('interface ') || code.includes('IPointy') || code.includes('IComparer')) {
      concepts.push('인터페이스');
    }
    if (code.includes('ArrayList') || code.includes('List<') || code.includes('Dictionary<') || code.includes('LinkedList<')) {
      concepts.push('컬렉션');
    }
    
    return concepts;
  };

  // 모든 문제에서 사용 가능한 개념 목록 추출
  const availableConcepts = useMemo(() => {
    const conceptSet = new Set();
    allProblems.forEach(problem => {
      const concepts = extractConcepts(problem);
      concepts.forEach(concept => conceptSet.add(concept));
    });
    const result = Array.from(conceptSet).sort();
    console.log('Available concepts:', result, 'Total problems:', allProblems.length);
    return result;
  }, [allProblems]);

  // 카테고리별로 사용 가능한 개념 필터링
  const getAvailableConceptsInCategory = (categoryKey) => {
    const category = conceptCategories[categoryKey];
    if (!category) return [];
    return category.concepts.filter(concept => availableConcepts.includes(concept));
  };

  // 카테고리 선택 핸들러
  const handleCategoryToggle = (categoryKey) => {
    const category = conceptCategories[categoryKey];
    const categoryConcepts = getAvailableConceptsInCategory(categoryKey);
    
    setSelectedCategories(prev => {
      if (prev.includes(categoryKey)) {
        // 카테고리 해제 시 해당 카테고리의 모든 개념도 해제
        setSelectedConcepts(prevConcepts => 
          prevConcepts.filter(c => !categoryConcepts.includes(c))
        );
        return prev.filter(c => c !== categoryKey);
      } else {
        // 카테고리 선택 시 해당 카테고리의 모든 개념도 선택
        setSelectedConcepts(prevConcepts => {
          const newConcepts = [...prevConcepts];
          categoryConcepts.forEach(concept => {
            if (!newConcepts.includes(concept)) {
              newConcepts.push(concept);
            }
          });
          return newConcepts;
        });
        return [...prev, categoryKey];
      }
    });
  };

  // 카테고리 확장/축소 핸들러
  const handleCategoryExpand = (categoryKey) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  // 사용 가능한 주차 목록 추출 (부모교육용)
  const availableWeeks = useMemo(() => {
    if (subject !== 'parenting') return [];
    const weekSet = new Set();
    allProblems.forEach(problem => {
      if (problem.week !== null && problem.week !== undefined) {
        weekSet.add(problem.week);
      }
    });
    const weeks = Array.from(weekSet).sort((a, b) => a - b);
    console.log('Available weeks:', weeks, 'Total problems:', allProblems.length, 'Problems with week:', allProblems.filter(p => p.week).length);
    return weeks;
  }, [allProblems, subject]);

  // 필터링된 문제 목록
  const problems = useMemo(() => {
    let filtered = allProblems;

    // 부모교육 주차 필터
    if (subject === 'parenting' && selectedWeeks.length > 0) {
      filtered = filtered.filter(p => selectedWeeks.includes(p.week));
    }

    // 타입 필터
    if (selectedType !== 'all') {
      filtered = filtered.filter(p => p.type === selectedType);
    }

    // 개념 필터 (필터 모드에 따라 OR 또는 AND) - C# 문제용
    if (subject === 'csharp' && selectedConcepts.length > 0) {
      const beforeFilterCount = filtered.length;
      
      filtered = filtered.filter(problem => {
        const problemConcepts = extractConcepts(problem);
        
        if (filterMode === 'AND') {
          // 선택된 모든 개념이 포함되어야 함
          return selectedConcepts.every(selected => 
            problemConcepts.includes(selected)
          );
        } else {
          // OR 모드: 선택된 개념 중 하나라도 포함되면 표시
          return selectedConcepts.some(selected => 
            problemConcepts.includes(selected)
          );
        }
      });
      
      // 디버깅 로그 (개발 모드에서만)
      if (process.env.NODE_ENV === 'development') {
        console.log('필터링 결과:', {
          filterMode,
          selectedConcepts,
          beforeFilter: beforeFilterCount,
          afterFilter: filtered.length,
          totalProblems: allProblems.length,
          selectedType
        });
      }
    }
    
    // 필터링된 문제 ID 목록을 세션 스토리지에 저장
    const filteredIds = filtered.map(p => p.id).sort((a, b) => a - b);
    sessionStorage.setItem('filteredProblemIds', JSON.stringify(filteredIds));
    
    return filtered;
  }, [allProblems, selectedType, selectedConcepts, filterMode, selectedWeeks, subject]);

  useEffect(() => {
    fetchProblems();
    // 과목이 변경되면 필터 초기화
    setSelectedWeeks([]);
    setSelectedConcepts([]);
    setSelectedCategories([]);
    setSelectedType('all');
  }, [subject]);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/${subject}/problems`);
      console.log('Fetched problems:', response.data.length, 'First problem:', response.data[0]);
      setAllProblems(response.data);
      setError(null);
    } catch (err) {
      setError('문제 목록을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>문제 목록을 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={fetchProblems}>다시 시도</button>
      </div>
    );
  }

  const handleTypeSelect = (typeValue) => {
    setSelectedType(typeValue);
  };

  const handleConceptToggle = (concept) => {
    setSelectedConcepts(prev => 
      prev.includes(concept)
        ? prev.filter(c => c !== concept)
        : [...prev, concept]
    );
  };

  // 주차 필터 토글 (부모교육용)
  const handleWeekToggle = (week) => {
    setSelectedWeeks(prev => 
      prev.includes(week)
        ? prev.filter(w => w !== week)
        : [...prev, week].sort((a, b) => a - b)
    );
  };

  // 주차별 주제/소제목 매핑 (부모교육용)
  const weekTopics = {
    2: '현대사회의 변화와 가족과 부모됨',
    3: '부모교육의 의미',
    4: '인간발달의 의미와 태내기 부모교육',
    5: '영아기 시기 부모교육',
    8: '유아기 시기의 부모교육',
    9: '아동기 시기 부모교육',
    10: '청소년시기의 부모교육',
    11: '부모의 양육태도',
    12: '부모교육프로그램과 의사소통',
    13: '다양한 가족형태에서의 부모교육'
  };

  // 개념 카테고리 정의
  const conceptCategories = {
    '기본문법': {
      label: '기본 문법',
      concepts: ['Property', 'override', 'abstract', 'virtual', '다형성', 'this']
    },
    '인터페이스': {
      label: '인터페이스',
      concepts: ['ICloneable', 'IComparable', 'IComparer', 'IEnumerable', '인터페이스']
    },
    '제네릭': {
      label: '제네릭',
      concepts: ['제네릭']
    },
    '파라미터': {
      label: '파라미터',
      concepts: ['ref-out']
    },
    '컬렉션': {
      label: '컬렉션',
      concepts: ['ArrayList', 'List', 'Dictionary', 'LinkedList', '컬렉션', 'Array']
    },
    '델리게이트이벤트': {
      label: '델리게이트/이벤트',
      concepts: ['delegate', 'Action-Func', '델리게이트', '이벤트']
    },
    'LINQ': {
      label: 'LINQ',
      concepts: ['LINQ', 'var', '확장메소드']
    },
    '예외처리': {
      label: '예외 처리',
      concepts: ['예외처리']
    },
    '멀티스레딩': {
      label: '멀티스레딩',
      concepts: ['Thread', 'lock', 'Task', 'async-await']
    },
    '기타': {
      label: '기타',
      concepts: ['Random', 'Console', 'DateTime']
    }
  };

  const conceptLabels = {
    'Thread': 'Thread',
    'async-await': 'async/await',
    '제네릭': '제네릭',
    'ref-out': 'ref/out',
    'ICloneable': 'ICloneable',
    'IComparable': 'IComparable',
    'IComparer': 'IComparer',
    'IEnumerable': 'IEnumerable',
    'delegate': 'delegate',
    'Action-Func': 'Action/Func',
    '델리게이트': '델리게이트',
    '이벤트': '이벤트',
    'LINQ': 'LINQ',
    'var': 'var',
    '확장메소드': '확장 메소드',
    '예외처리': '예외 처리',
    'lock': 'lock',
    'Task': 'Task',
    '다형성': '다형성',
    '인터페이스': '인터페이스',
    '컬렉션': '컬렉션',
    'ArrayList': 'ArrayList',
    'List': 'List<T>',
    'Dictionary': 'Dictionary',
    'LinkedList': 'LinkedList',
    'Array': 'Array',
    'Property': 'Property',
    'override': 'override',
    'abstract': 'abstract',
    'virtual': 'virtual',
    'this': 'this',
    'Random': 'Random',
    'Console': 'Console',
    'DateTime': 'DateTime'
  };

  return (
    <div className="problem-list">
      <div className="problem-list-header">
        <div className="header-content">
          <div>
            <h2>문제 목록</h2>
            <p className="subtitle">
              {subject === 'csharp' ? 'C# 프로그래밍 문제를 풀어보세요' : 
               subject === 'parenting' ? '부모교육 강의 자료를 확인하세요' : 
               '문제를 풀어보세요'}
            </p>
          </div>
        </div>
      </div>

      {/* 주차 필터 (부모교육용) */}
      {subject === 'parenting' && (
        <div className="concept-filter-section">
          <h3 className="filter-section-title">주차별 필터</h3>
          {availableWeeks.length > 0 ? (
            <>
              <div className="week-filter-group">
                {availableWeeks.map((week) => (
                  <button
                    key={week}
                    className={`week-filter-button ${selectedWeeks.includes(week) ? 'active' : ''}`}
                    onClick={() => handleWeekToggle(week)}
                  >
                    <div className="week-button-content">
                      <div className="week-header">
                        <span className="week-icon">📅</span>
                        <span className="week-label">{week}주차</span>
                      </div>
                      {weekTopics[week] && (
                        <div className="week-topic">{weekTopics[week]}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              {selectedWeeks.length > 0 && (
                <button 
                  className="clear-concepts-button"
                  onClick={() => setSelectedWeeks([])}
                >
                  필터 초기화
                </button>
              )}
              
              {selectedWeeks.length > 0 && (
                <div className="filter-result-info" style={{ marginTop: '1rem' }}>
                  {selectedWeeks.length}개 주차 선택됨: {selectedWeeks.join(', ')}주차
                </div>
              )}
            </>
          ) : (
            <div className="concept-loading">
              주차 목록을 불러오는 중...
            </div>
          )}
        </div>
      )}

      {/* 개념 필터 (체크박스) - C# 문제용 */}
      {subject === 'csharp' && (
        <div className="concept-filter-section">
          <h3 className="filter-section-title">개념 필터</h3>
          {availableConcepts.length > 0 ? (
          <>
            {/* 필터 모드 선택 */}
            <div className="filter-mode-selector">
              <label className="filter-mode-label">
                <input
                  type="radio"
                  name="filterMode"
                  value="OR"
                  checked={filterMode === 'OR'}
                  onChange={(e) => setFilterMode(e.target.value)}
                  className="filter-mode-radio"
                />
                <span>하나라도 포함 (OR)</span>
              </label>
              <label className="filter-mode-label">
                <input
                  type="radio"
                  name="filterMode"
                  value="AND"
                  checked={filterMode === 'AND'}
                  onChange={(e) => setFilterMode(e.target.value)}
                  className="filter-mode-radio"
                />
                <span>모두 포함 (AND)</span>
              </label>
            </div>
            
            {/* 카테고리별 개념 필터 */}
            <div className="concept-category-group">
              {Object.entries(conceptCategories).map(([categoryKey, category]) => {
                const categoryConcepts = getAvailableConceptsInCategory(categoryKey);
                if (categoryConcepts.length === 0) return null;
                
                const isExpanded = expandedCategories[categoryKey];
                const isCategorySelected = selectedCategories.includes(categoryKey);
                const selectedCount = categoryConcepts.filter(c => selectedConcepts.includes(c)).length;
                const allSelected = selectedCount === categoryConcepts.length && categoryConcepts.length > 0;
                
                return (
                  <div key={categoryKey} className="concept-category">
                    <div className="concept-category-header" onClick={() => handleCategoryExpand(categoryKey)}>
                      <label 
                        className="concept-category-checkbox-label"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isCategorySelected || allSelected}
                          onChange={() => handleCategoryToggle(categoryKey)}
                          className="concept-category-checkbox"
                        />
                        <span className="concept-category-title">
                          {category.label}
                          {selectedCount > 0 && !allSelected && (
                            <span className="concept-count-badge">{selectedCount}</span>
                          )}
                        </span>
                      </label>
                      <button
                        className="category-expand-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoryExpand(categoryKey);
                        }}
                        aria-label={isExpanded ? '접기' : '펼치기'}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    </div>
                    
                    {isExpanded && (
                      <div className="concept-checkbox-group">
                        {categoryConcepts.map((concept) => (
                          <label key={concept} className="concept-checkbox-label">
                            <input
                              type="checkbox"
                              checked={selectedConcepts.includes(concept)}
                              onChange={() => handleConceptToggle(concept)}
                              className="concept-checkbox"
                            />
                            <span className="concept-checkbox-text">
                              {conceptLabels[concept] || concept}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {selectedConcepts.length > 0 && (
              <button 
                className="clear-concepts-button"
                onClick={() => {
                  setSelectedConcepts([]);
                  setSelectedCategories([]);
                }}
              >
                필터 초기화
              </button>
            )}
          </>
        ) : (
          <div className="concept-loading">
            개념 목록을 불러오는 중...
          </div>
        )}
        </div>
      )}

      {/* 문제 유형 필터 */}
      <div className="problem-type-selector">
        {problemTypes.map((type) => (
          <button
            key={type.value}
            className={`type-button ${selectedType === type.value ? 'active' : ''}`}
            onClick={() => handleTypeSelect(type.value)}
          >
            <span className="type-icon">{type.icon}</span>
            <span className="type-label">{type.label}</span>
          </button>
        ))}
      </div>
      
      <div className="problem-grid">
        {problems.map((problem) => (
          <Link
            key={problem.id}
            to={`/${subject}/problem/${problem.id}`}
            className="problem-card"
          >
            <div className="problem-number">문제 {problem.id}</div>
            <div className="problem-type-badge">
              {subject === 'parenting' ? (
                <>
                  {problem.week ? `📅 ${problem.week}주차 ` : ''}
                  {problemTypes.find(t => t.value === problem.type)?.icon || '📝'}
                  {problemTypes.find(t => t.value === problem.type)?.label || '문제'}
                </>
              ) : (
                <>
                  {problemTypes.find(t => t.value === problem.type)?.icon || '📝'}
                  {problemTypes.find(t => t.value === problem.type)?.label || '문제'}
                </>
              )}
            </div>
            <h3 className="problem-title">{problem.title}</h3>
            <div className="problem-preview">
              {problem.description.substring(0, 100)}...
            </div>
            <div className="problem-link">문제 풀기 →</div>
          </Link>
        ))}
      </div>

      {problems.length === 0 && (
        <div className="empty-state">
          <p>
            {subject === 'parenting' 
              ? (selectedWeeks.length > 0 
                  ? '선택한 주차에 해당하는 문제가 없습니다.'
                  : '등록된 문제가 없습니다.')
              : (selectedConcepts.length > 0 || selectedType !== 'all'
                  ? '선택한 조건에 맞는 문제가 없습니다.'
                  : '등록된 문제가 없습니다.')}
          </p>
        </div>
      )}

      {problems.length > 0 && (
        <div className="filter-result-info">
          총 {problems.length}개의 문제가 표시됩니다.
        </div>
      )}
    </div>
  );
}

export default ProblemList;


