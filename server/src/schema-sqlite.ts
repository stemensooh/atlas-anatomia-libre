// Migraciones del esquema en SQLite (v1–v4). Para PostgreSQL ver schema-postgres.ts (D-016).
// Nunca se edita una migración ya publicada: los cambios van en una nueva, en los dos motores.

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

// En orden; PRAGMA user_version guarda cuántas se han aplicado.
export const SQLITE_MIGRATIONS: string[] = [
  // v1: cuestionarios, preguntas e intentos
  `
    CREATE TABLE IF NOT EXISTS quizzes (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      subtitle    TEXT NOT NULL DEFAULT '',
      source      TEXT NOT NULL CHECK (source IN ('seed', 'manual', 'generated')),
      created_at  TEXT NOT NULL DEFAULT ${NOW},
      updated_at  TEXT NOT NULL DEFAULT ${NOW}
    );

    CREATE TABLE IF NOT EXISTS questions (
      id                   TEXT NOT NULL,
      quiz_id              TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      position             INTEGER NOT NULL,
      type                 TEXT NOT NULL CHECK (type IN ('find3d', 'multipleChoice')),
      prompt               TEXT NOT NULL,
      hint                 TEXT NOT NULL DEFAULT '',
      body_sex             TEXT NOT NULL CHECK (body_sex IN ('male', 'female')),
      enabled_systems      TEXT NOT NULL,  -- JSON: SystemId[]
      target_structure_id  TEXT NOT NULL,
      target_name_es       TEXT NOT NULL,
      options              TEXT,           -- JSON: string[] (solo multipleChoice)
      explanation          TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (quiz_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id, position);

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id      TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      score        INTEGER NOT NULL,
      total        INTEGER NOT NULL,
      answers      TEXT NOT NULL,          -- JSON: QuizAnswer[]
      finished_at  TEXT NOT NULL DEFAULT ${NOW}
    );
    CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON quiz_attempts(quiz_id, finished_at);
  `,
  // v2: propietario de cada cuestionario e intento, preparado para la autenticación.
  `
    ALTER TABLE quizzes ADD COLUMN user_id INTEGER;
    ALTER TABLE quiz_attempts ADD COLUMN user_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_quizzes_user ON quizzes(user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_user ON quiz_attempts(user_id, finished_at);
  `,
  // v3: cuentas y sesiones. user_id pasa a ser clave foránea (borrar una cuenta borra sus
  // cuestionarios e intentos) y los cuestionarios tienen visibilidad. SQLite no permite añadir
  // una clave foránea a una tabla existente: se reconstruyen quizzes y quiz_attempts.
  // Lo que existía antes de las cuentas no tiene dueño y queda público.
  `
    CREATE TABLE users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash  TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'estudiante' CHECK (role IN ('estudiante', 'docente', 'admin')),
      is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at     TEXT NOT NULL DEFAULT ${NOW},
      last_login_at  TEXT
    );

    -- Solo se guarda el hash SHA-256 del token: una copia de la BD no permite suplantar sesiones.
    CREATE TABLE sessions (
      token_hash  TEXT PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TEXT NOT NULL DEFAULT ${NOW},
      expires_at  TEXT NOT NULL
    );
    CREATE INDEX idx_sessions_user ON sessions(user_id);

    CREATE TABLE quizzes_v3 (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      subtitle    TEXT NOT NULL DEFAULT '',
      source      TEXT NOT NULL CHECK (source IN ('seed', 'manual', 'generated')),
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      is_public   INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
      created_at  TEXT NOT NULL DEFAULT ${NOW},
      updated_at  TEXT NOT NULL DEFAULT ${NOW}
    );
    INSERT INTO quizzes_v3 (id, title, subtitle, source, user_id, is_public, created_at, updated_at)
      SELECT id, title, subtitle, source, NULL, 1, created_at, updated_at FROM quizzes;
    DROP TABLE quizzes;
    ALTER TABLE quizzes_v3 RENAME TO quizzes;
    CREATE INDEX idx_quizzes_user ON quizzes(user_id);

    CREATE TABLE quiz_attempts_v3 (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id      TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      score        INTEGER NOT NULL,
      total        INTEGER NOT NULL,
      answers      TEXT NOT NULL,
      finished_at  TEXT NOT NULL DEFAULT ${NOW}
    );
    INSERT INTO quiz_attempts_v3 (id, quiz_id, user_id, score, total, answers, finished_at)
      SELECT id, quiz_id, NULL, score, total, answers, finished_at FROM quiz_attempts;
    DROP TABLE quiz_attempts;
    ALTER TABLE quiz_attempts_v3 RENAME TO quiz_attempts;
    CREATE INDEX idx_attempts_quiz ON quiz_attempts(quiz_id, finished_at);
    CREATE INDEX idx_attempts_user ON quiz_attempts(user_id, finished_at);
  `,
  // v4: vistas guardadas y notas por estructura, privadas de cada usuario.
  `
    CREATE TABLE saved_views (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      state       TEXT NOT NULL,          -- JSON: cámara, modelo, capas, cortes, selección…
      created_at  TEXT NOT NULL DEFAULT ${NOW},
      updated_at  TEXT NOT NULL DEFAULT ${NOW}
    );
    CREATE INDEX idx_views_user ON saved_views(user_id, updated_at);

    -- Los ids de estructura son únicos entre modelos (FMA… masculino, VH_F_… femenino).
    CREATE TABLE structure_notes (
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      structure_id  TEXT NOT NULL,
      note          TEXT NOT NULL,
      updated_at    TEXT NOT NULL DEFAULT ${NOW},
      PRIMARY KEY (user_id, structure_id)
    );
  `,
];
