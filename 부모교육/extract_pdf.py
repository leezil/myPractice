# -*- coding: utf-8 -*-
import sys
import os

# 현재 스크립트의 디렉토리
try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
except:
    # __file__이 없는 경우 현재 작업 디렉토리 사용
    script_dir = os.getcwd()

# 작업 디렉토리 변경
try:
    os.chdir(script_dir)
except:
    pass

print(f"작업 디렉토리: {script_dir}")

def try_pdfplumber():
    """pdfplumber를 사용하여 PDF 추출 시도"""
    try:
        import pdfplumber
        return True, pdfplumber
    except ImportError:
        print("pdfplumber 설치 중...")
        os.system(f"{sys.executable} -m pip install pdfplumber -q")
        try:
            import pdfplumber
            return True, pdfplumber
        except:
            return False, None

def try_pymupdf():
    """PyMuPDF (fitz)를 사용하여 PDF 추출 시도"""
    try:
        import fitz  # PyMuPDF
        return True, fitz
    except ImportError:
        print("PyMuPDF 설치 중...")
        os.system(f"{sys.executable} -m pip install PyMuPDF -q")
        try:
            import fitz
            return True, fitz
        except:
            return False, None

def try_pypdf2():
    """PyPDF2를 사용하여 PDF 추출 시도"""
    try:
        import PyPDF2
        return True, PyPDF2
    except ImportError:
        print("PyPDF2 설치 중...")
        os.system(f"{sys.executable} -m pip install PyPDF2 -q")
        try:
            import PyPDF2
            return True, PyPDF2
        except:
            return False, None

def extract_with_pdfplumber(pdf_path):
    """pdfplumber로 텍스트 추출"""
    import pdfplumber
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        return f"오류: {str(e)}"
    return text

def extract_with_pymupdf(pdf_path):
    """PyMuPDF로 텍스트 추출"""
    import fitz
    text = ""
    try:
        doc = fitz.open(pdf_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            text += page.get_text() + "\n"
        doc.close()
    except Exception as e:
        return f"오류: {str(e)}"
    return text

def extract_with_pypdf2(pdf_path):
    """PyPDF2로 텍스트 추출"""
    import PyPDF2
    text = ""
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
    except Exception as e:
        return f"오류: {str(e)}"
    return text

def extract_pdf(pdf_path):
    """가장 좋은 방법으로 PDF 추출 시도"""
    # 1순위: pdfplumber (한글 지원 좋음)
    success, lib = try_pdfplumber()
    if success:
        print(f"pdfplumber 사용하여 추출 중: {os.path.basename(pdf_path)}")
        return extract_with_pdfplumber(pdf_path)
    
    # 2순위: PyMuPDF
    success, lib = try_pymupdf()
    if success:
        print(f"PyMuPDF 사용하여 추출 중: {os.path.basename(pdf_path)}")
        return extract_with_pymupdf(pdf_path)
    
    # 3순위: PyPDF2
    success, lib = try_pypdf2()
    if success:
        print(f"PyPDF2 사용하여 추출 중: {os.path.basename(pdf_path)}")
        return extract_with_pypdf2(pdf_path)
    
    return "PDF 추출 라이브러리를 설치할 수 없습니다."

if __name__ == "__main__":
    pdf_folder = os.path.join(script_dir, "강의 ppt모음", "pdf")
    output_folder = os.path.join(script_dir, "정리", "pdf_추출본")
    
    # 출력 폴더 생성
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
    
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
    
    print("="*60)
    print("PDF 텍스트 추출 시작")
    print("="*60)
    
    for pdf_file in pdf_files:
        pdf_path = os.path.join(pdf_folder, pdf_file)
        if os.path.exists(pdf_path):
            print(f"\n처리 중: {pdf_file}")
            text = extract_pdf(pdf_path)
            
            # 텍스트를 파일로 저장
            output_file = os.path.join(output_folder, pdf_file.replace('.pdf', '_추출.txt'))
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(text)
            
            print(f"✓ 저장 완료: {output_file}")
            print(f"  추출된 텍스트 길이: {len(text)}자")
            if len(text) > 0:
                print(f"  처음 200자:\n{text[:200]}...")
        else:
            print(f"✗ 파일을 찾을 수 없습니다: {pdf_path}")
    
    print("\n" + "="*60)
    print("모든 PDF 추출 완료!")
    print(f"추출된 파일 위치: {output_folder}")
    print("="*60)

