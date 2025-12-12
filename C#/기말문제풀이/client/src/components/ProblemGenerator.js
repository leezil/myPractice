import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProblemGenerator.css';

function ProblemGenerator({ onProblemGenerated, defaultType = null }) {
  const [formData, setFormData] = useState({
    selectedTypes: defaultType ? [defaultType] : ['method'], // 기본 유형 또는 전달받은 유형
    selectedTopics: [], // 체크박스로 선택한 주제들
    difficulty: 'medium',
    requirements: ''
  });
  const [conceptCategories, setConceptCategories] = useState({});
  const [topicCategories, setTopicCategories] = useState({});
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [expandedTopicCategories, setExpandedTopicCategories] = useState({});

  // 주제 카테고리 로드 (개념은 주제에서 자동 추출)
  useEffect(() => {
    fetchConcepts(); // 개념 매핑을 위해 필요
    fetchTopics();
  }, []);

  // defaultType이 변경되면 formData 업데이트
  useEffect(() => {
    if (defaultType) {
      setFormData(prev => ({
        ...prev,
        selectedTypes: [defaultType]
      }));
    }
  }, [defaultType]);

  const fetchConcepts = async () => {
    try {
      const response = await axios.get('/api/concepts');
      setConceptCategories(response.data);
    } catch (err) {
      console.error('개념 목록 로드 실패:', err);
    }
  };

  const fetchTopics = async () => {
    try {
      const response = await axios.get('/api/topics');
      setTopicCategories(response.data);
      // 모든 카테고리를 기본적으로 접힘 상태로 설정
      const expanded = {};
      Object.keys(response.data).forEach(key => {
        expanded[key] = false;
      });
      setExpandedTopicCategories(expanded);
    } catch (err) {
      console.error('주제 목록 로드 실패:', err);
    } finally {
      setLoadingTopics(false);
    }
  };

  const problemTypes = [
    { value: 'fill', label: '빈칸 채우기', icon: '✏️' },
    { value: 'method', label: '메소드 만들기', icon: '⚙️' },
    { value: 'class', label: '클래스 만들기', icon: '🏗️' },
    { value: 'full', label: '전체 코드 작성', icon: '💻' }
  ];

  const difficulties = [
    { value: 'easy', label: '쉬움' },
    { value: 'medium', label: '보통' },
    { value: 'hard', label: '어려움' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTypeToggle = (typeValue) => {
    setFormData(prev => {
      const selectedTypes = prev.selectedTypes.includes(typeValue)
        ? prev.selectedTypes.filter(t => t !== typeValue)
        : [...prev.selectedTypes, typeValue];
      
      // 최소 하나는 선택되어야 함
      if (selectedTypes.length === 0) {
        return prev;
      }
      
      return {
        ...prev,
        selectedTypes
      };
    });
  };

  // 주제 ID를 개념 ID로 매핑하는 함수
  const getConceptsFromTopic = (topicId) => {
    const topicToConceptMap = {
      // LINQ 주제
      'linq-select': ['select', 'var'],
      'linq-where': ['where', 'var'],
      'linq-orderby': ['orderby', 'var'],
      'extension-method': ['extension'],
      // 인터페이스 주제
      'icloneable': ['icloneable', 'interface-impl'],
      'icomparable': ['icomparable', 'interface-impl'],
      'ienumerable': ['ienumerable', 'ienumerator', 'interface-impl'],
      // 델리게이트 주제
      'delegate': ['delegate'],
      'lambda': ['lambda'],
      'event': ['event'],
      'action-func': ['action', 'func'],
      // 컬렉션 주제
      'list': ['list'],
      'dictionary': ['dictionary'],
      'linkedlist': ['linkedlist'],
      'arraylist': ['arraylist'],
      'array': ['array'],
      // 기본 문법 주제
      'string': ['tostring'],
      'type-conversion': ['tryparse', 'parse'],
      'parameter': ['ref', 'out', 'default'],
      // 비동기 주제
      'async-await': ['async', 'task-delay'],
      'task': ['task', 'task-run'],
      // 스레드 주제
      'thread': ['thread', 'threadstart', 'parameterized', 'join'],
      'lock': ['lock'],
      // 예외 처리 주제
      'try-catch': ['try-catch', 'finally'],
      'custom-exception': ['custom-exception', 'try-catch'],
      // 객체지향 주제
      'property': ['property'],
      'inheritance': ['override', 'abstract'],
      'polymorphism': ['polymorphism', 'override'],
      // 제네릭 주제
      'generic-class': ['generic-class', 'generic-constraint'],
      'generic-method': ['generic-method']
    };
    return topicToConceptMap[topicId] || [];
  };

  const handleTopicToggle = (topicId) => {
    setFormData(prev => {
      const selectedTopics = prev.selectedTopics.includes(topicId)
        ? prev.selectedTopics.filter(id => id !== topicId)
        : [...prev.selectedTopics, topicId];
      return {
        ...prev,
        selectedTopics
      };
    });
  };

  const handleTopicCategoryToggle = (categoryId) => {
    setExpandedTopicCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const handleSelectAllTopicsInCategory = (categoryId) => {
    const category = topicCategories[categoryId];
    if (!category) return;

    const categoryTopicIds = category.topics.map(t => t.id);
    const allSelected = categoryTopicIds.every(id => 
      formData.selectedTopics.includes(id)
    );

    setFormData(prev => {
      if (allSelected) {
        return {
          ...prev,
          selectedTopics: prev.selectedTopics.filter(
            id => !categoryTopicIds.includes(id)
          )
        };
      } else {
        const newTopics = [...prev.selectedTopics];
        categoryTopicIds.forEach(id => {
          if (!newTopics.includes(id)) {
            newTopics.push(id);
          }
        });
        return {
          ...prev,
          selectedTopics: newTopics
        };
      }
    });
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setSuccess(false);

    try {
      // 선택된 주제에서 관련 개념들을 자동으로 추출
      const conceptsArray = [];
      formData.selectedTopics.forEach(topicId => {
        const conceptIds = getConceptsFromTopic(topicId);
        conceptIds.forEach(conceptId => {
          // 개념 ID로 이름 찾기
          for (const category of Object.values(conceptCategories)) {
            const concept = category.concepts.find(c => c.id === conceptId);
            if (concept && !conceptsArray.includes(concept.name)) {
              conceptsArray.push(concept.name);
            }
          }
        });
      });

      // 선택된 유형 중 하나를 랜덤으로 선택
      const selectedType = formData.selectedTypes.length > 0
        ? formData.selectedTypes[Math.floor(Math.random() * formData.selectedTypes.length)]
        : 'method';

      // 선택된 주제 중 하나를 랜덤으로 선택 (또는 모두 포함)
      const topicsArray = formData.selectedTopics.map(topicId => {
        for (const category of Object.values(topicCategories)) {
          const topic = category.topics.find(t => t.id === topicId);
          if (topic) return topic.name;
        }
        return topicId;
      });
      const selectedTopic = topicsArray.length > 0
        ? topicsArray[Math.floor(Math.random() * topicsArray.length)]
        : '';

      const response = await axios.post('/api/problems/generate', {
        type: selectedType,
        topic: selectedTopic,
        difficulty: formData.difficulty,
        concepts: conceptsArray,
        requirements: formData.requirements
      });

      if (response.data.success) {
        setSuccess(true);
        if (onProblemGenerated) {
          onProblemGenerated(response.data.problem);
        }
        // 폼 초기화 (defaultType 유지)
        setTimeout(() => {
          setFormData({
            selectedTypes: defaultType ? [defaultType] : ['method'],
            selectedTopics: [],
            difficulty: 'medium',
            requirements: ''
          });
          setSuccess(false);
        }, 1000); // 리다이렉트가 빠르게 일어나므로 시간 단축
      }
    } catch (err) {
      setError(err.response?.data?.error || '문제 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="problem-generator">
      <div className="generator-header">
        <h2>📝 문제 생성</h2>
        <p className="subtitle">조건을 선택하면 템플릿 기반으로 문제를 생성합니다</p>
      </div>

      <form onSubmit={handleSubmit} className="generator-form">
        <div className="form-group">
          {defaultType ? (
            // defaultType이 있으면 읽기 전용으로 표시
            <div className="selected-type-display">
              <label>문제 유형</label>
              <div className="selected-type-badge">
                <span className="type-icon">{problemTypes.find(t => t.value === defaultType)?.icon || '📝'}</span>
                <span>{problemTypes.find(t => t.value === defaultType)?.label || defaultType}</span>
              </div>
            </div>
          ) : (
            // defaultType이 없으면 기존처럼 선택 가능하게 표시
            <>
              <div className="concepts-header">
                <label htmlFor="type">문제 유형 * (복수 선택 가능)</label>
                <button
                  type="button"
                  className="select-all-button"
                  onClick={() => {
                    const allTypes = problemTypes.map(t => t.value);
                    const allSelected = allTypes.every(t => formData.selectedTypes.includes(t));
                    setFormData(prev => ({
                      ...prev,
                      selectedTypes: allSelected ? [] : allTypes
                    }));
                  }}
                >
                  {problemTypes.length === formData.selectedTypes.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div className="type-options">
                {problemTypes.map(type => (
                  <label key={type.value} className="type-option type-checkbox">
                    <input
                      type="checkbox"
                      value={type.value}
                      checked={formData.selectedTypes.includes(type.value)}
                      onChange={() => handleTypeToggle(type.value)}
                    />
                    <span className="type-icon">{type.icon}</span>
                    <span>{type.label}</span>
                  </label>
                ))}
              </div>
              {formData.selectedTypes.length > 0 && (
                <div className="selected-types-summary">
                  선택된 유형: {formData.selectedTypes.length}개 ({formData.selectedTypes.map(t => problemTypes.find(pt => pt.value === t)?.label).join(', ')})
                </div>
              )}
            </>
          )}
        </div>

        <div className="form-group">
          <div className="concepts-header">
            <label>주제 선택 (복수 선택 가능)</label>
            <button
              type="button"
              className="select-all-button"
              onClick={() => {
                const allTopicIds = [];
                Object.values(topicCategories).forEach(category => {
                  category.topics.forEach(topic => {
                    allTopicIds.push(topic.id);
                  });
                });
                const allSelected = allTopicIds.every(id => 
                  formData.selectedTopics.includes(id)
                );
                setFormData(prev => ({
                  ...prev,
                  selectedTopics: allSelected ? [] : allTopicIds
                }));
              }}
            >
              {Object.values(topicCategories).reduce((sum, cat) => sum + cat.topics.length, 0) === formData.selectedTopics.length
                ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          
          {loadingTopics ? (
            <div className="loading-concepts">주제 목록을 불러오는 중...</div>
          ) : (
            <div className="concepts-container">
              {Object.entries(topicCategories).map(([categoryId, category]) => (
                <div key={categoryId} className="concept-category">
                  <div 
                    className="category-header"
                    onClick={() => handleTopicCategoryToggle(categoryId)}
                  >
                    <span className="category-toggle">
                      {expandedTopicCategories[categoryId] ? '▼' : '▶'}
                    </span>
                    <span className="category-name">{category.name}</span>
                    <span className="category-count">
                      ({category.topics.filter(t => formData.selectedTopics.includes(t.id)).length}/{category.topics.length})
                    </span>
                    <button
                      type="button"
                      className="category-select-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectAllTopicsInCategory(categoryId);
                      }}
                    >
                      {category.topics.every(t => formData.selectedTopics.includes(t.id))
                        ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>
                  
                  {expandedTopicCategories[categoryId] && (
                    <div className="concept-list">
                      {category.topics.map(topic => (
                        <label key={topic.id} className="concept-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.selectedTopics.includes(topic.id)}
                            onChange={() => handleTopicToggle(topic.id)}
                          />
                          <span className="concept-name">{topic.name}</span>
                          <span className="concept-description">{topic.description}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {formData.selectedTopics.length > 0 && (
            <div className="selected-concepts-summary">
              선택된 주제: {formData.selectedTopics.length}개
              <span style={{ fontSize: '0.85rem', color: '#666', marginLeft: '0.5rem' }}>
                (관련 개념이 자동으로 포함됩니다)
              </span>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="difficulty">난이도</label>
          <select
            id="difficulty"
            name="difficulty"
            value={formData.difficulty}
            onChange={handleChange}
          >
            {difficulties.map(diff => (
              <option key={diff.value} value={diff.value}>
                {diff.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="requirements">추가 요구사항</label>
          <textarea
            id="requirements"
            name="requirements"
            value={formData.requirements}
            onChange={handleChange}
            rows="3"
            placeholder="예: 배열을 역순으로 출력, 예외 처리를 포함 등"
          />
        </div>


        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            ✅ 문제가 성공적으로 생성되었습니다!
          </div>
        )}

        <button
          type="submit"
          className="generate-button"
          disabled={generating}
        >
          {generating ? (
            <>
              <span className="spinner-small"></span>
              생성 중...
            </>
          ) : (
            <>
              ✨ 문제 생성하기
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default ProblemGenerator;

