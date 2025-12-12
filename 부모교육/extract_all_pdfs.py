# -*- coding: utf-8 -*-
"""
PDF 텍스트 추출 스크립트
이 스크립트는 부모교육 강의 PDF 파일에서 텍스트를 추출합니다.
"""
import os
import sys

def install_package(package_name, import_name=None):
    """패키지 설치 시도"""
    if import_name is None:
        import_name = package_name
    try:
        __import__(import_name)
        return True
    except ImportError:
        print(f"{package_name} 설치 중...")
        os.system(f"{sys.executable} -m pip install {package_name} -q")
        try:
            __import__(import_name)
            return True
        except:
            return False

def extract_pdf_text(pdf_path):
    """PDF에서 텍스트 추출 (여러 방법 시도)"""
    # 방법 1: pdfplumber 시도
    if install_package("pdfplumber"):
        try:
            import pdfplumber
            text = ""
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            if text.strip():
                return "pdfplumber", text
        except Exception as e:
            print(f"  pdfplumber 오류: {e}")
    
    # 방법 2: PyMuPDF 시도
    if install_package("PyMuPDF", "fitz"):
        try:
            import fitz
            text = ""
            doc = fitz.open(pdf_path)
            for page_num in range(len(doc)):
                page = doc[page_num]
                text += page.get_text() + "\n"
            doc.close()
            if text.strip():
                return "PyMuPDF", text
        except Exception as e:
            print(f"  PyMuPDF 오류: {e}")
    
    # 방법 3: PyPDF2 시도
    if install_package("PyPDF2"):
        try:
            import PyPDF2
            text = ""
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
            if text.strip():
                return "PyPDF2", text
        except Exception as e:
            print(f"  PyPDF2 오류: {e}")
    
    return None, "PDF 추출 실패"

def main():
    # 현재 스크립트 위치 기준으로 경로 설정
    base_dir = os.path.dirname(os.path.abspath(__file__))
    pdf_dir = os.path.join(base_dir, "강의 ppt모음", "pdf")
    output_dir = os.path.join(base_dir, "정리", "pdf_추출본")
    
    # 출력 디렉토리 생성
    os.makedirs(output_dir, exist_ok=True)
    
    # PDF 파일 목록
    pdf_files = [
        "2. 현대사회의변화와특징가족과부모됨.pdf",
        "3. 부모교육의의미.pdf",
        "4. 인간발달의의미와태내기부모교육.pdf",
        "5. 영아기시기부모교육.pdf",
        "6. 부모레시피 작성.pdf",
        "8. 유아기시기의부모교육.pdf",
        "9. 아동기시기부모교육.pdf",
        "10. 청소년시기의부모교육.pdf",
        "11. 부모의양육태도.pdf",
        "12. 부모교육프로그램과 부모자녀의사소통.pdf",
        "13. 다양한가족형태에서의부모교육.pdf"
    ]
    
    print("="*70)
    print("PDF 텍스트 추출 시작")
    print(f"PDF 폴더: {pdf_dir}")
    print(f"출력 폴더: {output_dir}")
    print("="*70)
    
    success_count = 0
    fail_count = 0
    
    for pdf_file in pdf_files:
        pdf_path = os.path.join(pdf_dir, pdf_file)
        
        if not os.path.exists(pdf_path):
            print(f"\n[오류] 파일 없음: {pdf_file}")
            fail_count += 1
            continue
        
        print(f"\n[처리 중] {pdf_file}")
        method, text = extract_pdf_text(pdf_path)
        
        if method:
            output_file = os.path.join(output_dir, pdf_file.replace('.pdf', '_추출.txt'))
            try:
                with open(output_file, 'w', encoding='utf-8') as f:
                    f.write(text)
                print(f"  ✓ 성공 ({method})")
                print(f"  ✓ 저장: {output_file}")
                print(f"  ✓ 텍스트 길이: {len(text):,}자")
                if len(text) > 0:
                    preview = text[:300].replace('\n', ' ')
                    print(f"  ✓ 미리보기: {preview}...")
                success_count += 1
            except Exception as e:
                print(f"  ✗ 저장 실패: {e}")
                fail_count += 1
        else:
            print(f"  ✗ 추출 실패: {text}")
            fail_count += 1
    
    print("\n" + "="*70)
    print(f"완료! 성공: {success_count}개, 실패: {fail_count}개")
    print(f"추출된 파일 위치: {output_dir}")
    print("="*70)

if __name__ == "__main__":
    main()


