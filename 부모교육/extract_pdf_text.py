import sys
import os

try:
    import PyPDF2
except ImportError:
    print("PyPDF2가 설치되어 있지 않습니다. 설치 중...")
    os.system(f"{sys.executable} -m pip install PyPDF2")
    import PyPDF2

def extract_text_from_pdf(pdf_path):
    """PDF 파일에서 텍스트를 추출합니다."""
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            return text
    except Exception as e:
        return f"오류 발생: {str(e)}"

if __name__ == "__main__":
    import sys
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pdf_folder = os.path.join(script_dir, "강의 ppt모음", "pdf")
    
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
    
    for pdf_file in pdf_files:
        pdf_path = os.path.join(pdf_folder, pdf_file)
        if os.path.exists(pdf_path):
            print(f"\n{'='*60}")
            print(f"파일: {pdf_file}")
            print(f"{'='*60}")
            text = extract_text_from_pdf(pdf_path)
            # 텍스트를 파일로 저장
            output_file = os.path.join(script_dir, "정리", f"{pdf_file.replace('.pdf', '_extracted.txt')}")
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f"추출 완료: {output_file}")
            print(f"처음 500자:\n{text[:500]}")
        else:
            print(f"파일을 찾을 수 없습니다: {pdf_path}")

