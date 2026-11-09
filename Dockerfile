# Python 실행 환경
FROM python:3.11-slim

# 작업 디렉터리
WORKDIR /app

# Python 라이브러리 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 프로젝트 파일 복사
COPY main.py .
COPY static/ ./static/

# 웹 서버 포트
EXPOSE 8000

# FastAPI 서버 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]