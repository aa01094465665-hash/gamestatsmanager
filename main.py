from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
import sqlite3

from fastapi import FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "game_stats.db"
STATIC_DIR = BASE_DIR / "static"


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_name TEXT NOT NULL,
                played_on TEXT NOT NULL,
                result TEXT NOT NULL CHECK (result IN ('win', 'loss')),
                kills INTEGER NOT NULL CHECK (kills >= 0),
                deaths INTEGER NOT NULL CHECK (deaths >= 0),
                assists INTEGER NOT NULL CHECK (assists >= 0),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


class MatchInput(BaseModel):
    game_name: str = Field(min_length=1, max_length=60)
    played_on: date
    result: str = Field(pattern="^(win|loss)$")
    kills: int = Field(ge=0, le=999)
    deaths: int = Field(ge=0, le=999)
    assists: int = Field(ge=0, le=999)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="Game Stats Manager", lifespan=lifespan)


def match_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


@app.get("/api/matches")
def list_matches() -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, game_name, played_on, result, kills, deaths, assists "
            "FROM matches ORDER BY played_on DESC, id DESC"
        ).fetchall()
    return [match_to_dict(row) for row in rows]


@app.post("/api/matches", status_code=201)
def create_match(match: MatchInput) -> dict:
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO matches (game_name, played_on, result, kills, deaths, assists) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                match.game_name.strip(),
                match.played_on.isoformat(),
                match.result,
                match.kills,
                match.deaths,
                match.assists,
            ),
        )
        row = connection.execute(
            "SELECT id, game_name, played_on, result, kills, deaths, assists "
            "FROM matches WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return match_to_dict(row)


@app.put("/api/matches/{match_id}")
def update_match(match_id: int, match: MatchInput) -> dict:
    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE matches SET game_name = ?, played_on = ?, result = ?, "
            "kills = ?, deaths = ?, assists = ? WHERE id = ?",
            (
                match.game_name.strip(),
                match.played_on.isoformat(),
                match.result,
                match.kills,
                match.deaths,
                match.assists,
                match_id,
            ),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="전적을 찾을 수 없습니다.")
        row = connection.execute(
            "SELECT id, game_name, played_on, result, kills, deaths, assists "
            "FROM matches WHERE id = ?",
            (match_id,),
        ).fetchone()
    return match_to_dict(row)


@app.delete("/api/matches/{match_id}", status_code=204)
def delete_match(match_id: int) -> Response:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM matches WHERE id = ?", (match_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="전적을 찾을 수 없습니다.")
    return Response(status_code=204)


@app.get("/api/stats")
def get_stats() -> dict:
    with get_connection() as connection:
        summary = connection.execute(
            "SELECT COUNT(*) AS total, "
            "COALESCE(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END), 0) AS wins, "
            "COALESCE(AVG(kills), 0) AS avg_kills, "
            "COALESCE(AVG(deaths), 0) AS avg_deaths, "
            "COALESCE(AVG(assists), 0) AS avg_assists FROM matches"
        ).fetchone()
        daily = connection.execute(
            "SELECT played_on, COUNT(*) AS matches, "
            "SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins "
            "FROM matches GROUP BY played_on ORDER BY played_on"
        ).fetchall()

    total = summary["total"]
    return {
        "total_matches": total,
        "wins": summary["wins"],
        "win_rate": round(summary["wins"] / total * 100, 1) if total else 0,
        "avg_kills": round(summary["avg_kills"], 1),
        "avg_deaths": round(summary["avg_deaths"], 1),
        "avg_assists": round(summary["avg_assists"], 1),
        "daily": [dict(row) for row in daily],
    }


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")