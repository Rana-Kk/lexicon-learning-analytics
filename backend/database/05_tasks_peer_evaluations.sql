
CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  teacher_note TEXT NULL,
  closed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS task_teams (
  task_id BIGINT UNSIGNED NOT NULL,
  team_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (task_id, team_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS peer_evaluations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  context_type ENUM('task','submission') NOT NULL,
  context_id BIGINT UNSIGNED NOT NULL,
  team_id BIGINT UNSIGNED NOT NULL,
  evaluator_id BIGINT UNSIGNED NOT NULL,
  evaluated_id BIGINT UNSIGNED NOT NULL,
  score TINYINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_eval (context_type, context_id, evaluator_id, evaluated_id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (evaluator_id) REFERENCES users(id),
  FOREIGN KEY (evaluated_id) REFERENCES users(id)
);

