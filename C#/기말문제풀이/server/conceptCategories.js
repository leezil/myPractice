// C# 프로그래밍 개념 카테고리 정의
// 코드 파일들을 분석하여 추출한 개념들

const conceptCategories = {
  basic: {
    name: '기본 문법',
    concepts: [
      { id: 'tostring', name: 'ToString()', description: 'ToString 메소드 사용' },
      { id: 'tryparse', name: 'TryParse', description: 'TryParse를 이용한 안전한 형변환' },
      { id: 'parse', name: 'Parse', description: 'Parse를 이용한 형변환' },
      { id: 'ref', name: 'ref 매개변수', description: 'ref 키워드를 사용한 참조 전달' },
      { id: 'out', name: 'out 매개변수', description: 'out 키워드를 사용한 출력 매개변수' },
      { id: 'default', name: '기본값 매개변수', description: '매개변수 기본값 설정' }
    ]
  },
  collections: {
    name: '컬렉션',
    concepts: [
      { id: 'arraylist', name: 'ArrayList', description: '비제네릭 동적 배열' },
      { id: 'list', name: 'List<T>', description: '제네릭 리스트' },
      { id: 'dictionary', name: 'Dictionary<TKey, TValue>', description: '키-값 쌍 컬렉션' },
      { id: 'linkedlist', name: 'LinkedList<T>', description: '연결 리스트' },
      { id: 'array', name: '배열', description: '기본 배열 사용' }
    ]
  },
  generic: {
    name: '제네릭',
    concepts: [
      { id: 'generic-class', name: '제네릭 클래스', description: '제네릭 타입 매개변수를 가진 클래스' },
      { id: 'generic-method', name: '제네릭 메소드', description: '제네릭 타입 매개변수를 가진 메소드' },
      { id: 'generic-constraint', name: '제네릭 제약', description: 'where 절을 사용한 제네릭 제약' }
    ]
  },
  interfaces: {
    name: '인터페이스',
    concepts: [
      { id: 'icloneable', name: 'ICloneable', description: '객체 복사 인터페이스' },
      { id: 'icomparable', name: 'IComparable', description: '비교 가능 인터페이스' },
      { id: 'ienumerable', name: 'IEnumerable', description: '열거 가능 인터페이스' },
      { id: 'ienumerator', name: 'IEnumerator', description: '열거자 인터페이스' },
      { id: 'interface-impl', name: '인터페이스 구현', description: '인터페이스 구현 (암묵적/명시적)' }
    ]
  },
  delegate: {
    name: '델리게이트와 이벤트',
    concepts: [
      { id: 'delegate', name: '델리게이트', description: '델리게이트 선언 및 사용' },
      { id: 'action', name: 'Action', description: 'Action 델리게이트' },
      { id: 'func', name: 'Func', description: 'Func 델리게이트' },
      { id: 'lambda', name: '람다 표현식', description: '람다 식 사용' },
      { id: 'event', name: '이벤트', description: '이벤트 선언 및 사용' }
    ]
  },
  linq: {
    name: 'LINQ',
    concepts: [
      { id: 'select', name: 'Select', description: 'LINQ Select 메소드' },
      { id: 'where', name: 'Where', description: 'LINQ Where 메소드' },
      { id: 'orderby', name: 'OrderBy/OrderByDescending', description: 'LINQ 정렬 메소드' },
      { id: 'anonymous', name: '익명 타입', description: '익명 타입 사용' },
      { id: 'extension', name: '확장 메소드', description: '확장 메소드 정의 및 사용' },
      { id: 'var', name: 'var 키워드', description: 'var를 사용한 타입 추론' }
    ]
  },
  async: {
    name: '비동기 프로그래밍',
    concepts: [
      { id: 'async', name: 'async/await', description: '비동기 메소드 및 await 사용' },
      { id: 'task', name: 'Task', description: 'Task 클래스 사용' },
      { id: 'task-delay', name: 'Task.Delay', description: '비동기 지연' },
      { id: 'task-run', name: 'Task.Run', description: '백그라운드 작업 실행' }
    ]
  },
  thread: {
    name: '스레드',
    concepts: [
      { id: 'thread', name: 'Thread', description: 'Thread 클래스 사용' },
      { id: 'threadstart', name: 'ThreadStart', description: 'ThreadStart 델리게이트' },
      { id: 'parameterized', name: 'ParameterizedThreadStart', description: '매개변수 전달 스레드' },
      { id: 'lock', name: 'lock', description: 'lock을 사용한 동기화' },
      { id: 'join', name: 'Thread.Join', description: '스레드 대기' }
    ]
  },
  exception: {
    name: '예외 처리',
    concepts: [
      { id: 'try-catch', name: 'try-catch', description: '예외 처리 구문' },
      { id: 'finally', name: 'finally', description: 'finally 블록' },
      { id: 'custom-exception', name: '사용자 정의 예외', description: '커스텀 예외 클래스' }
    ]
  },
  oop: {
    name: '객체지향',
    concepts: [
      { id: 'property', name: '속성 (Property)', description: 'get/set 속성' },
      { id: 'override', name: '메소드 오버라이드', description: 'override 키워드' },
      { id: 'abstract', name: '추상 클래스', description: 'abstract 클래스 및 메소드' },
      { id: 'polymorphism', name: '다형성', description: '다형성 활용' }
    ]
  }
};

// 모든 개념을 평탄화하여 배열로 반환
function getAllConcepts() {
  const allConcepts = [];
  Object.values(conceptCategories).forEach(category => {
    category.concepts.forEach(concept => {
      allConcepts.push({
        ...concept,
        category: category.name,
        categoryId: Object.keys(conceptCategories).find(
          key => conceptCategories[key] === category
        )
      });
    });
  });
  return allConcepts;
}

// 카테고리별로 그룹화된 개념 반환
function getConceptsByCategory() {
  return conceptCategories;
}

module.exports = {
  conceptCategories,
  getAllConcepts,
  getConceptsByCategory
};


