import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Editor from '@monaco-editor/react';
import './ProblemDetail.css';

function ProblemDetail() {
  const { subject, id } = useParams();
  const [problem, setProblem] = useState(null);
  const [code, setCode] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState(null); // 객관식 문제용
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [problemIds, setProblemIds] = useState([]);
  const [prevProblemId, setPrevProblemId] = useState(null);
  const [nextProblemId, setNextProblemId] = useState(null);

  // 문제 ID 목록 가져오기 (필터링된 목록 우선 사용)
  const fetchProblemIds = useCallback(async () => {
    try {
      // 세션 스토리지에서 필터링된 문제 ID 목록 확인
      const filteredIdsStr = sessionStorage.getItem('filteredProblemIds');
      let ids;
      
      if (filteredIdsStr) {
        // 필터링된 목록이 있으면 사용
        ids = JSON.parse(filteredIdsStr);
      } else {
        // 없으면 전체 문제 목록 가져오기
        const response = await axios.get(`/api/${subject}/problems`);
        ids = response.data.map(p => p.id).sort((a, b) => a - b);
      }
      
      setProblemIds(ids);
      
      // 현재 문제의 이전/다음 문제 찾기
      const currentIndex = ids.indexOf(parseInt(id));
      if (currentIndex > 0) {
        setPrevProblemId(ids[currentIndex - 1]);
      } else {
        setPrevProblemId(null);
      }
      if (currentIndex < ids.length - 1) {
        setNextProblemId(ids[currentIndex + 1]);
      } else {
        setNextProblemId(null);
      }
    } catch (err) {
      console.error('문제 목록을 불러오는데 실패했습니다.', err);
    }
  }, [subject, id]);

  const fetchProblem = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/${subject}/problems/${id}`);
      setProblem(response.data);
      // codeToWrite가 있으면 사용, 없으면 template 사용
      setCode(response.data.codeToWrite || response.data.template || '');
      setError(null);
    } catch (err) {
      setError('문제를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [subject, id]);

  useEffect(() => {
    fetchProblem();
    fetchProblemIds();
  }, [fetchProblem, fetchProblemIds]);

  // 문제 ID가 변경될 때 정답 보기 상태 초기화
  useEffect(() => {
    setShowAnswer(false);
    setResult(null);
    setSelectedAnswer(null);
  }, [id]);

  const handleSubmit = async () => {
    // 객관식 문제 처리
    if (problem?.type === 'multiple_choice') {
      if (!selectedAnswer) {
        setResult({
          success: false,
          message: '답을 선택해주세요.'
        });
        return;
      }

      try {
        setSubmitting(true);
        setResult(null);
        const response = await axios.post(`/api/${subject}/problems/${id}/submit`, {
          selectedAnswer: selectedAnswer
        });
        setResult(response.data);
      } catch (err) {
        setResult({
          success: false,
          message: err.response?.data?.error || '제출 중 오류가 발생했습니다.'
        });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 코드 작성 문제 처리
    if (!code.trim()) {
      setResult({
        success: false,
        message: '코드를 입력해주세요.'
      });
      return;
    }

    try {
      setSubmitting(true);
      setResult(null);
      const response = await axios.post(`/api/${subject}/problems/${id}/submit`, {
        code: code
      });
      setResult(response.data);
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.error || '제출 중 오류가 발생했습니다.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    if (problem) {
      if (problem.type === 'multiple_choice') {
        setSelectedAnswer(null);
      } else {
        setCode(problem.codeToWrite || problem.template || '');
      }
    }
    setResult(null);
    setShowAnswer(false);
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>문제를 불러오는 중...</p>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="error-container">
        <p>{error || '문제를 찾을 수 없습니다.'}</p>
        <Link to="/" className="back-button">목록으로 돌아가기</Link>
      </div>
    );
  }

  return (
    <div className="problem-detail">
      <div className="problem-detail-header">
        <div className="header-top">
          <Link to={`/${subject}`} className="back-link">← 목록으로</Link>
          <div className="problem-navigation">
            {prevProblemId && (
              <Link 
                to={`/${subject}/problem/${prevProblemId}`} 
                className="nav-button prev-button"
                onClick={() => {
                  setResult(null);
                  setCode('');
                  setShowAnswer(false);
                }}
              >
                ← 이전 문제
              </Link>
            )}
            {nextProblemId && (
              <Link 
                to={`/${subject}/problem/${nextProblemId}`} 
                className="nav-button next-button"
                onClick={() => {
                  setResult(null);
                  setCode('');
                  setShowAnswer(false);
                }}
              >
                다음 문제 →
              </Link>
            )}
          </div>
        </div>
        <h2>문제 {problem.id}: {problem.title}</h2>
      </div>

      <div className="problem-detail-content">
        <div className="problem-description">
          <div className="description-header">
            <h3>문제 설명</h3>
          </div>
          <div className="description-box">
            {problem.type === 'multiple_choice' ? (
              <div className="multiple-choice-question">
                <p className="question-text">{problem.question || problem.description}</p>
              </div>
            ) : (
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {problem.requirements || problem.description}
                </ReactMarkdown>
              </div>
            )}
            
            {/* 전체 코드 표시 */}
            {problem.fullCode && (
              <div className="full-code-section">
                <h4>전체 코드</h4>
                <div className="code-preview">
                  <Editor
                    height="400px"
                    defaultLanguage="csharp"
                    value={problem.fullCode}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on'
                    }}
                  />
                </div>
              </div>
            )}
            
            {/* 예제 코드 표시 (전체 코드 작성 문제 또는 Program 클래스 작성 문제인 경우) */}
            {problem.exampleCode && (problem.type === 'full' || problem.type === 'full2' || problem.type === 'class') && (
              <div className="example-section">
                <h4>실행 예제</h4>
                <div className="example-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {problem.exampleCode}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="code-editor-section">
          <div className="editor-header">
            <h3>{problem.type === 'multiple_choice' ? '답 선택' : '코드 작성'}</h3>
            <div className="editor-actions">
              <button
                onClick={handleReset}
                className="reset-button"
                disabled={submitting}
              >
                초기화
              </button>
              <button
                onClick={handleShowAnswer}
                className="answer-button"
                disabled={submitting || showAnswer}
              >
                정답 보기
              </button>
              <button
                onClick={handleSubmit}
                className="submit-button"
                disabled={submitting}
              >
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          </div>
          
          {problem.type === 'multiple_choice' ? (
            <div className="multiple-choice-options">
              {problem.options && problem.options.map((option, index) => {
                const optionNumber = index + 1;
                const isSelected = selectedAnswer === optionNumber;
                const isCorrect = showAnswer && problem.answer === optionNumber;
                const isWrong = result && result.selectedAnswer === optionNumber && !result.isCorrect;
                
                return (
                  <button
                    key={index}
                    className={`option-button ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
                    onClick={() => setSelectedAnswer(optionNumber)}
                    disabled={submitting || showAnswer}
                  >
                    <span className="option-number">{['①', '②', '③', '④'][index]}</span>
                    <span className="option-text">{option}</span>
                    {isCorrect && <span className="answer-badge">정답</span>}
                    {isWrong && <span className="answer-badge wrong-badge">오답</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="editor-container">
              <Editor
                height={problem?.type === 'full' || problem?.type === 'full2' ? "800px" : "500px"}
                defaultLanguage="csharp"
                value={code}
                onChange={setCode}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 4,
                  wordWrap: 'on',
                  padding: { top: 80 }
                }}
              />
            </div>
          )}

          {result && (
            <div className={`result-box ${result.isCorrect ? 'success' : result.compileError ? 'error' : result.success ? 'warning' : 'error'}`}>
              <div className="result-header">
                <strong>
                  {result.isCorrect ? '✓ 정답입니다!' : result.compileError ? '✗ 컴파일 오류' : result.success ? '⚠ 제출 완료' : '✗ 제출 실패'}
                </strong>
              </div>
              <div className="result-message">{result.message}</div>
              {result.compileError && (
                <div className="compile-error-section">
                  <p>코드에 문법 오류가 있습니다. 코드를 수정한 후 다시 제출해주세요.</p>
                </div>
              )}
              {result.note && (
                <div className="result-note">
                  <small>{result.note}</small>
                </div>
              )}
            </div>
          )}

          {showAnswer && problem && (
            <div className="result-box answer-box">
              <div className="result-header">
                <strong>정답:</strong>
              </div>
              <div className="answer-section">
                {problem.type === 'multiple_choice' ? (
                  <div className="answer-text">
                    {['①', '②', '③', '④'][problem.answer - 1]} {problem.options && problem.options[problem.answer - 1]}
                  </div>
                ) : (
                  <pre className="answer-code">
                    <code>{problem.answer || '정답 정보가 없습니다.'}</code>
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <div className="problem-detail-footer">
        <div className="footer-navigation">
          {prevProblemId && (
            <Link 
              to={`/${subject}/problem/${prevProblemId}`} 
              className="nav-button prev-button"
              onClick={() => {
                setResult(null);
                setCode('');
                setShowAnswer(false);
              }}
            >
              ← 이전 문제
            </Link>
          )}
          {nextProblemId && (
            <Link 
              to={`/${subject}/problem/${nextProblemId}`} 
              className="nav-button next-button"
              onClick={() => {
                setResult(null);
                setCode('');
                setShowAnswer(false);
              }}
            >
              다음 문제 →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProblemDetail;


