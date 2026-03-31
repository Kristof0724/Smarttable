import os
from pathlib import Path

import pymysql
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
SQL_PATH = PROJECT_ROOT / 'database' / 'smarttable.sql'

DB_HOST = (os.getenv('MYSQL_HOST') or os.getenv('DB_HOST') or 'localhost').strip() or 'localhost'
DB_PORT = int((os.getenv('MYSQL_PORT') or os.getenv('DB_PORT') or '3306'))
DB_NAME = (os.getenv('MYSQL_DATABASE') or os.getenv('DB_NAME') or 'smarttable').strip() or 'smarttable'
DB_USER = (os.getenv('MYSQL_USER') or os.getenv('DB_USER') or 'user_smarttable').strip() or 'user_smarttable'
DB_PASSWORD = os.getenv('MYSQL_PASSWORD') or os.getenv('DB_PASSWORD') or 'smarttable123'
BOOTSTRAP_HOST = (os.getenv('MYSQL_BOOTSTRAP_HOST') or DB_HOST).strip() or DB_HOST
BOOTSTRAP_PORT = int((os.getenv('MYSQL_BOOTSTRAP_PORT') or str(DB_PORT)))
BOOTSTRAP_USER = (os.getenv('MYSQL_BOOTSTRAP_USER') or 'root').strip() or 'root'
BOOTSTRAP_PASSWORD = os.getenv('MYSQL_BOOTSTRAP_PASSWORD') or ''


def _connect(host, port, user, password, database=None, autocommit=False):
    kwargs = {
        'host': host,
        'port': port,
        'user': user,
        'password': password,
        'cursorclass': pymysql.cursors.DictCursor,
        'autocommit': autocommit,
        'charset': 'utf8mb4',
    }
    if database:
        kwargs['database'] = database
    return pymysql.connect(**kwargs)


def _q_ident(value: str) -> str:
    return f"`{str(value).replace('`', '``')}`"


def _q_str(value: str) -> str:
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"


def get_conn():
    return _connect(DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, autocommit=True)


def _ensure_database_user():
    bootstrap = _connect(BOOTSTRAP_HOST, BOOTSTRAP_PORT, BOOTSTRAP_USER, BOOTSTRAP_PASSWORD, None, autocommit=True)
    try:
        with bootstrap.cursor() as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS {_q_ident(DB_NAME)} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci")
            for host in ('localhost', '127.0.0.1'):
                cur.execute(f"CREATE USER IF NOT EXISTS {_q_str(DB_USER)}@{_q_str(host)} IDENTIFIED BY {_q_str(DB_PASSWORD)}")
                cur.execute(f"ALTER USER {_q_str(DB_USER)}@{_q_str(host)} IDENTIFIED BY {_q_str(DB_PASSWORD)}")
                cur.execute(f"GRANT ALL PRIVILEGES ON {_q_ident(DB_NAME)}.* TO {_q_str(DB_USER)}@{_q_str(host)}")
            cur.execute('FLUSH PRIVILEGES')
    finally:
        bootstrap.close()


def _iter_sql_statements(sql_text: str):
    lines = []
    for raw in sql_text.replace('\ufeff', '').splitlines():
        stripped = raw.strip()
        if not stripped:
            continue
        if stripped.startswith('--'):
            continue
        if stripped.startswith('/*!') and stripped.endswith('*/;'):
            continue
        lines.append(raw)
    joined = '\n'.join(lines)
    for chunk in joined.split(';'):
        stmt = chunk.strip()
        if stmt:
            yield stmt


def _should_skip(stmt: str) -> bool:
    upper = stmt.upper()
    return upper.startswith((
        'START TRANSACTION', 'COMMIT', 'SET SQL_MODE', 'SET TIME_ZONE', 'SET @OLD_', 'SET NAMES',
        'CREATE DATABASE', 'CREATE USER', 'ALTER USER', 'GRANT ', 'FLUSH PRIVILEGES', 'USE '
    ))


def _schema_exists(conn) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema=%s AND table_name=%s',
            (DB_NAME, 'users'),
        )
        row = cur.fetchone() or {'c': 0}
        return int(row.get('c') or 0) > 0


def _execute_sql_dump(conn):
    sql_text = SQL_PATH.read_text(encoding='utf-8', errors='ignore')
    with conn.cursor() as cur:
        for stmt in _iter_sql_statements(sql_text):
            if _should_skip(stmt):
                continue
            cur.execute(stmt)
        conn.commit()


def init_db():
    _ensure_database_user()
    conn = get_conn()
    try:
        if _schema_exists(conn):
            return
        _execute_sql_dump(conn)
    finally:
        conn.close()
