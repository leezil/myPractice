// C# 프로그래밍 주제 카테고리 정의
// 코드 파일들을 분석하여 추출한 주요 주제들

const topicCategories = {
  basic: {
    name: '기본 문법',
    topics: [
      { id: 'array', name: '배열', description: '배열 사용 및 조작' },
      { id: 'string', name: '문자열', description: '문자열 처리 및 메소드' },
      { id: 'type-conversion', name: '형변환', description: 'ToString, Parse, TryParse' },
      { id: 'parameter', name: '매개변수', description: 'ref, out, 기본값 매개변수' }
    ]
  },
  collections: {
    name: '컬렉션',
    topics: [
      { id: 'list', name: 'List<T>', description: '제네릭 리스트' },
      { id: 'dictionary', name: 'Dictionary', description: '키-값 쌍 컬렉션' },
      { id: 'linkedlist', name: 'LinkedList', description: '연결 리스트' },
      { id: 'arraylist', name: 'ArrayList', description: '비제네릭 동적 배열' }
    ]
  },
  generic: {
    name: '제네릭',
    topics: [
      { id: 'generic-class', name: '제네릭 클래스', description: '제네릭 타입 매개변수' },
      { id: 'generic-method', name: '제네릭 메소드', description: '제네릭 메소드 작성' }
    ]
  },
  interfaces: {
    name: '인터페이스',
    topics: [
      { id: 'icloneable', name: 'ICloneable', description: '객체 복사' },
      { id: 'icomparable', name: 'IComparable', description: '비교 가능' },
      { id: 'ienumerable', name: 'IEnumerable', description: '열거 가능' }
    ]
  },
  delegate: {
    name: '델리게이트와 이벤트',
    topics: [
      { id: 'delegate', name: '델리게이트', description: '델리게이트 선언 및 사용' },
      { id: 'lambda', name: '람다 표현식', description: '람다 식 사용' },
      { id: 'event', name: '이벤트', description: '이벤트 선언 및 사용' },
      { id: 'action-func', name: 'Action/Func', description: '내장 델리게이트 타입' }
    ]
  },
  linq: {
    name: 'LINQ',
    topics: [
      { id: 'linq-select', name: 'LINQ Select', description: 'Select 메소드' },
      { id: 'linq-where', name: 'LINQ Where', description: 'Where 메소드' },
      { id: 'linq-orderby', name: 'LINQ OrderBy', description: '정렬 메소드' },
      { id: 'extension-method', name: '확장 메소드', description: '확장 메소드 정의' }
    ]
  },
  async: {
    name: '비동기 프로그래밍',
    topics: [
      { id: 'async-await', name: 'async/await', description: '비동기 메소드' },
      { id: 'task', name: 'Task', description: 'Task 클래스' }
    ]
  },
  thread: {
    name: '스레드',
    topics: [
      { id: 'thread', name: 'Thread', description: '스레드 생성 및 관리' },
      { id: 'lock', name: 'lock', description: '동기화' }
    ]
  },
  exception: {
    name: '예외 처리',
    topics: [
      { id: 'try-catch', name: 'try-catch', description: '예외 처리 구문' },
      { id: 'custom-exception', name: '사용자 정의 예외', description: '커스텀 예외 클래스' }
    ]
  },
  oop: {
    name: '객체지향',
    topics: [
      { id: 'property', name: '속성', description: 'get/set 속성' },
      { id: 'inheritance', name: '상속', description: '클래스 상속' },
      { id: 'polymorphism', name: '다형성', description: '다형성 활용' }
    ]
  }
};

// 모든 주제를 평탄화하여 배열로 반환
function getAllTopics() {
  const allTopics = [];
  Object.values(topicCategories).forEach(category => {
    category.topics.forEach(topic => {
      allTopics.push({
        ...topic,
        category: category.name,
        categoryId: Object.keys(topicCategories).find(
          key => topicCategories[key] === category
        )
      });
    });
  });
  return allTopics;
}

// 카테고리별로 그룹화된 주제 반환
function getTopicsByCategory() {
  return topicCategories;
}

module.exports = {
  topicCategories,
  getAllTopics,
  getTopicsByCategory
};


