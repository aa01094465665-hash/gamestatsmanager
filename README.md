# Game Stats Manager

게임 전적을 기록하고 승률, 평균 K/D/A, 날짜별 경기 추이를 확인하는 로컬 웹 앱입니다. FastAPI가 화면과 API를 제공하고, 데이터는 프로젝트 폴더의 `game_stats.db`에 SQLite로 저장됩니다.

## 필요한 환경

- Windows 10 또는 11
- Python 3.10 이상
- 인터넷 연결 (그래프 라이브러리와 글꼴을 CDN에서 불러옵니다.)

## 설치 및 실행

VS Code에서 프로젝트 폴더를 연 다음 PowerShell 터미널에서 실행하세요.

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

PowerShell에서 가상 환경 활성화가 정책으로 차단되면 가상 환경의 Python을 직접 실행할 수 있습니다.

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

브라우저에서 <http://127.0.0.1:8000> 을 여세요. API 문서는 <http://127.0.0.1:8000/docs> 에서 확인할 수 있습니다. 서버를 종료하려면 터미널에서 `Ctrl+C`를 누릅니다.

## 사용 방법

1. **전적 기록하기**를 누르고 게임 이름, 날짜, 승패, 킬/데스/어시스트를 입력합니다.
2. 최근 전적 목록에서 **수정** 또는 **삭제**를 선택합니다. 삭제 전에는 확인 창이 표시됩니다.
3. 상단에서 전체 경기, 승률, 평균 K/D/A를 확인하고 날짜별 그래프에서 승리와 패배 추이를 살펴봅니다.
4. 게임 이름 검색창에서 원하는 전적을 찾습니다.

## 데이터와 API

- 데이터베이스: 프로젝트 루트의 `game_stats.db` (서버 첫 실행 시 자동 생성)
- `GET /api/matches`: 전적 목록
- `POST /api/matches`: 전적 추가
- `PUT /api/matches/{id}`: 전적 수정
- `DELETE /api/matches/{id}`: 전적 삭제
- `GET /api/stats`: 전체 통계와 날짜별 통계

전적은 로컬 파일에만 저장됩니다. 데이터베이스 파일을 삭제하면 기록도 함께 삭제되므로 필요하면 파일을 복사해 백업하세요.