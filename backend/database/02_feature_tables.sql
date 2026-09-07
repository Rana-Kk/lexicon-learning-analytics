USE lexicon_learning_analytics;

CREATE TABLE IF NOT EXISTS import_batches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  import_type ENUM('student','quiz') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  imported_by BIGINT UNSIGNED NULL,
  status ENUM('uploaded','validated','confirmed','rejected') NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_import_batches_imported_by
    FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS import_rows (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  row_no INT UNSIGNED NOT NULL,
  raw_data JSON NOT NULL,
  status ENUM('valid','invalid','duplicate','missing_reference') NOT NULL,
  error_message TEXT NULL,
  matched_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_import_rows_batch
    FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_import_rows_matched_user
    FOREIGN KEY (matched_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assessment_scores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  submission_id BIGINT UNSIGNED NULL,
  score DECIMAL(6,2) NOT NULL,
  feedback TEXT NULL,
  evaluated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assessment_student (assessment_id, student_id),
  CONSTRAINT fk_assessment_scores_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_scores_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_scores_submission FOREIGN KEY (submission_id) REFERENCES assessment_submissions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS quizzes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  topic VARCHAR(150) NULL,
  quiz_date DATE NULL,
  max_score DECIMAL(6,2) NOT NULL,
  source ENUM('manual','imported') NOT NULL DEFAULT 'imported',
  import_batch_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_quizzes_group FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_quizzes_import_batch FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL,
  CONSTRAINT fk_quizzes_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  score DECIMAL(6,2) NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_quiz_student (quiz_id, student_id),
  CONSTRAINT fk_quiz_results_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_results_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competencies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NULL
);

CREATE TABLE IF NOT EXISTS student_competencies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  competency_id BIGINT UNSIGNED NOT NULL,
  score DECIMAL(5,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_competency (student_id, competency_id),
  CONSTRAINT fk_student_competencies_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_competencies_competency FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_competency_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  competency_id BIGINT UNSIGNED NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_competency_history_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_competency_history_competency FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_feedback_templates_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS teacher_feedback (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED NOT NULL,
  assessment_id BIGINT UNSIGNED NULL,
  template_id BIGINT UNSIGNED NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teacher_feedback_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_teacher_feedback_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_teacher_feedback_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE SET NULL,
  CONSTRAINT fk_teacher_feedback_template FOREIGN KEY (template_id) REFERENCES feedback_templates(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS certificates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  added_by BIGINT UNSIGNED NULL,
  name VARCHAR(200) NOT NULL,
  issuing_organization VARCHAR(200) NULL,
  issue_date DATE NULL,
  expiry_date DATE NULL,
  certificate_code VARCHAR(150) NULL,
  file_url TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_certificates_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_certificates_added_by FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_team_name_per_group UNIQUE (group_id, name),
  CONSTRAINT fk_teams_group FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  joined_at DATE NOT NULL,
  PRIMARY KEY (team_id, student_id),
  CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_members_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS ai_competency_suggestions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  ai_evaluation_id BIGINT UNSIGNED NOT NULL,
  competency_id BIGINT UNSIGNED NOT NULL,

  current_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  suggested_score DECIMAL(5,2) NOT NULL DEFAULT 0,

  reason TEXT NULL,

  UNIQUE KEY uq_evaluation_competency (
    ai_evaluation_id,
    competency_id
  ),

  CONSTRAINT fk_ai_comp_sugg_evaluation
    FOREIGN KEY (ai_evaluation_id)
    REFERENCES ai_evaluations(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_ai_comp_sugg_competency
    FOREIGN KEY (competency_id)
    REFERENCES competencies(id)
    ON DELETE CASCADE
);



CREATE TABLE IF NOT EXISTS attendance_appeals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  attendance_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,

  status ENUM(
    'pending',
    'accepted',
    'rejected'
  ) NOT NULL DEFAULT 'pending',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  reviewed_by BIGINT UNSIGNED NULL,

  UNIQUE KEY uq_attendance_appeal (
    attendance_id
  ),

  KEY idx_attendance_appeals_student (
    student_id
  ),

  KEY idx_attendance_appeals_status (
    status
  ),

  CONSTRAINT fk_attendance_appeal_attendance
    FOREIGN KEY (attendance_id)
    REFERENCES attendance(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_attendance_appeal_student
    FOREIGN KEY (student_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_attendance_appeal_reviewer
    FOREIGN KEY (reviewed_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);