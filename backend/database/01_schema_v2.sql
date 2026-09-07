-- ============================================================================
-- Lexicon Learning Analytics & AI Feedback Platform
-- Master Complete Schema & Seed Script (MySQL 8.0+)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS lexicon_learning_analytics;
USE lexicon_learning_analytics;

-- ============================================================================
-- 1. USERS & AUTH  
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  role ENUM('admin','teacher','student') NOT NULL,
  github_username VARCHAR(100) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_github_username (github_username)
);

-- ============================================================================
-- 2. COURSES, GROUPS, TEAMS  (proposal §4)
-- ============================================================================

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_groups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_student_groups_course
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_groups_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS group_teachers (
  group_id BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (group_id, teacher_id),
  CONSTRAINT fk_group_teachers_group
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_group_teachers_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_group_teachers_teacher ON group_teachers (teacher_id);

CREATE TABLE IF NOT EXISTS group_students (
  group_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  joined_at DATE NOT NULL,
  PRIMARY KEY (group_id, student_id),
  CONSTRAINT fk_group_students_group
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_group_students_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_group_students_student ON group_students (student_id);

CREATE TABLE IF NOT EXISTS teams (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_team_name_per_group UNIQUE (group_id, name),
  CONSTRAINT fk_teams_group
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  joined_at DATE NOT NULL,
  PRIMARY KEY (team_id, student_id),
  CONSTRAINT fk_team_members_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_members_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_team_members_student ON team_members (student_id);

-- ============================================================================
-- 3. STUDENT / QUIZ IMPORT  (proposal §5 student import, §9 quiz import)
-- ============================================================================

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
CREATE INDEX ix_import_rows_batch ON import_rows (batch_id);

-- ============================================================================
-- 4. ATTENDANCE  (proposal §6)
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  group_id BIGINT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  session ENUM('morning','afternoon') NOT NULL,
  status ENUM('present','late','absent','excused') NOT NULL,
  note TEXT NULL,
  recorded_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_student_date_session (student_id, attendance_date, session),
  CONSTRAINT fk_attendance_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_group
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_recorded_by
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX ix_attendance_group_date ON attendance (group_id, attendance_date);

-- ============================================================================
-- 5. ASSESSMENTS & RUBRICS  (proposal §7, §8)
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  type ENUM('project','assignment','presentation','practical','final_project','other') NOT NULL,
  submission_mode ENUM('individual','team') NOT NULL DEFAULT 'individual',
  repo_slug VARCHAR(100) NULL,
  assessment_date DATE NULL,
  due_date DATE NULL,
  max_score DECIMAL(6,2) NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_assessments_group
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessments_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX ix_assessments_group ON assessments (group_id);

CREATE TABLE IF NOT EXISTS assessment_criteria (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  max_score DECIMAL(6,2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_assessment_criteria_assessment
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

-- ============================================================================
-- 6. SUBMISSIONS & AI COLUMNS (GitHub-based; drives automatic AI analysis)
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_submissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NULL,
  team_id BIGINT UNSIGNED NULL,
  github_url TEXT NOT NULL,
  commit_sha VARCHAR(64) NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  analyzed_at TIMESTAMP NULL,
  status ENUM('submitted','analyzing','ai_reviewed','teacher_reviewed','approved','rejected','error')
    NOT NULL DEFAULT 'submitted',
  ai_score DECIMAL(5,2) NULL,
  ai_feedback TEXT NULL,
  CONSTRAINT fk_assessment_submissions_assessment
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_submissions_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_submissions_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT chk_submission_owner
    CHECK (
      (student_id IS NOT NULL AND team_id IS NULL)
      OR
      (student_id IS NULL AND team_id IS NOT NULL)
    )
);
CREATE INDEX ix_submission_assessment ON assessment_submissions (assessment_id);
CREATE INDEX ix_submission_student ON assessment_submissions (student_id);
CREATE INDEX ix_submission_team ON assessment_submissions (team_id);

-- ============================================================================
-- 7. AI EVALUATION & CRITERIA SCORES
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_evaluations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED NOT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  total_ai_score DECIMAL(6,2) NULL,
  total_teacher_score DECIMAL(6,2) NULL,
  strengths TEXT NULL,
  areas_for_improvement TEXT NULL,
  recommendations TEXT NULL,
  suggested_next_steps TEXT NULL,
  raw_ai_response JSON NULL,
  status ENUM('draft','approved','rejected') NOT NULL DEFAULT 'draft',
  teacher_comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  CONSTRAINT fk_ai_evaluations_submission
    FOREIGN KEY (submission_id) REFERENCES assessment_submissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_evaluations_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX ix_ai_evaluations_submission ON ai_evaluations (submission_id);
CREATE INDEX ix_ai_status ON ai_evaluations (status);

CREATE TABLE IF NOT EXISTS criterion_scores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ai_evaluation_id BIGINT UNSIGNED NOT NULL,
  criterion_id BIGINT UNSIGNED NOT NULL,
  ai_recommended_score DECIMAL(6,2) NOT NULL,
  ai_rationale TEXT NULL,
  teacher_final_score DECIMAL(6,2) NULL,
  UNIQUE KEY uq_evaluation_criterion (ai_evaluation_id, criterion_id),
  CONSTRAINT fk_criterion_scores_ai_evaluation
    FOREIGN KEY (ai_evaluation_id) REFERENCES ai_evaluations(id) ON DELETE CASCADE,
  CONSTRAINT fk_criterion_scores_criterion
    FOREIGN KEY (criterion_id) REFERENCES assessment_criteria(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submission_criteria_scores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED NOT NULL,
  criteria_id BIGINT UNSIGNED NOT NULL,
  score DECIMAL(6,2) NOT NULL,
  comment TEXT NULL,
  UNIQUE KEY uq_submission_criteria (submission_id, criteria_id),
  CONSTRAINT fk_sub_crit_scores_sub FOREIGN KEY (submission_id) REFERENCES assessment_submissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_crit_scores_crit FOREIGN KEY (criteria_id) REFERENCES assessment_criteria(id) ON DELETE CASCADE
);

ALTER TABLE assessment_submissions
  ADD COLUMN submitted_by BIGINT UNSIGNED NULL AFTER student_id,
  ADD CONSTRAINT fk_assessment_submissions_submitted_by
    FOREIGN KEY (submitted_by) REFERENCES users(id)
    ON DELETE SET NULL;
UPDATE assessment_submissions
SET submitted_by = student_id
WHERE submitted_by IS NULL;
-- ============================================================================
-- 8. GRADEBOOK (assessment_scores)
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_scores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  submission_id BIGINT UNSIGNED NULL,
  score DECIMAL(6,2) NOT NULL,
  feedback TEXT NULL,
  evaluated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assessment_student (assessment_id, student_id),
  CONSTRAINT fk_assessment_scores_assessment
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_scores_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_scores_submission
    FOREIGN KEY (submission_id) REFERENCES assessment_submissions(id) ON DELETE SET NULL
);
CREATE INDEX ix_assessment_scores_student ON assessment_scores (student_id);

-- ============================================================================
-- 9. QUIZZES
-- ============================================================================

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
  CONSTRAINT fk_quizzes_group
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_quizzes_import_batch
    FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL,
  CONSTRAINT fk_quizzes_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX ix_quizzes_group ON quizzes (group_id);

CREATE TABLE IF NOT EXISTS quiz_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  score DECIMAL(6,2) NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_quiz_student (quiz_id, student_id),
  CONSTRAINT fk_quiz_results_quiz
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_results_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_quiz_results_student ON quiz_results (student_id);
CREATE INDEX ix_quiz_results_quiz ON quiz_results (quiz_id);

-- ============================================================================
-- 10. COMPETENCY MATRIX + HISTORY
-- ============================================================================

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
  CONSTRAINT fk_student_competencies_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_competencies_competency
    FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_competency_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  competency_id BIGINT UNSIGNED NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_competency_history_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_competency_history_competency
    FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE
);
CREATE INDEX ix_competency_history_student ON student_competency_history (student_id, competency_id, recorded_at);

-- ============================================================================
-- 11. TEACHER FEEDBACK
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_feedback_templates_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS teacher_feedback (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED NOT NULL,
  assessment_id BIGINT UNSIGNED NULL,
  template_id BIGINT UNSIGNED NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teacher_feedback_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_teacher_feedback_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_teacher_feedback_assessment
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE SET NULL,
  CONSTRAINT fk_teacher_feedback_template
    FOREIGN KEY (template_id) REFERENCES feedback_templates(id) ON DELETE SET NULL
);

-- ============================================================================
-- 12. CERTIFICATES
-- ============================================================================

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
  CONSTRAINT fk_certificates_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_certificates_added_by
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 13. COURSE TIMELINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS group_timeline_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  week_number INT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  status ENUM('upcoming','in_progress','completed') NOT NULL DEFAULT 'upcoming',
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_group_timeline_group
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE
);
CREATE INDEX ix_group_timeline_group ON group_timeline_items (group_id);

-- ============================================================================
-- 14. OPTIONAL / NICE-TO-HAVE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_risk_indicators (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  group_id BIGINT UNSIGNED NOT NULL,
  level ENUM('on_track','needs_attention','high_attention') NOT NULL,
  reasoning TEXT NULL,
  computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_risk_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_risk_group
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE
);
CREATE INDEX ix_risk_student ON student_risk_indicators (student_id);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_notifications_user_unread ON notifications (user_id, is_read);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_log_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX ix_audit_log_entity ON audit_log (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS generated_reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  generated_by BIGINT UNSIGNED NULL,
  file_url TEXT NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_generated_reports_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_generated_reports_generated_by
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX ix_generated_reports_student ON generated_reports (student_id);


-- ============================================================================
-- 15. INITIAL SEED DATA (Courses, Groups, Students, Assessments, Criteria)
-- ============================================================================

INSERT INTO users (id, name, email, password_hash, role, github_username, is_active)
VALUES (1, 'Ayse Rana', 'student@test.com', '$2b$10$DummyHashedPasswordForTestingPurposesOnlyXyz', 'student', 'Rana-Kk', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2. Kurs ve Grup eklenir
INSERT INTO courses (id, name, description)
VALUES (1, 'Software Engineering', 'Lexicon Software Engineering course')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

INSERT INTO student_groups (id, course_id, name, created_by)
VALUES (1, 1, 'Lexicon Student Group', NULL)
ON DUPLICATE KEY UPDATE course_id = VALUES(course_id), name = VALUES(name);

-- 3. Kullanıcı gruba bağlanır (Artık ID: 1 veritabanında var olduğu için hata vermez)
INSERT INTO group_students (group_id, student_id, joined_at)
VALUES (1, 1, CURRENT_DATE)
ON DUPLICATE KEY UPDATE joined_at = VALUES(joined_at);

-- 4. Ödev ve Kriterler eklenir
INSERT INTO assessments (
    id, group_id, title, description, type, submission_mode, repo_slug, assessment_date, due_date, max_score, created_by
)
VALUES (
    1, 1, 'Python Fundamentals Assignment', 'Introductory assignment', 'assignment', 'individual', NULL, NULL, NULL, 100.00, NULL
)
ON DUPLICATE KEY UPDATE 
    group_id = VALUES(group_id), title = VALUES(title), max_score = VALUES(max_score);

INSERT INTO assessment_criteria (id, assessment_id, name, description, max_score, sort_order)
VALUES 
(1, 1, 'Code Structure & Readability', 'Evaluates clean code practices and organization', 50.00, 1),
(2, 1, 'SQL Query Correctness', 'Evaluates proper usage of joins and constraints', 50.00, 2)
ON DUPLICATE KEY UPDATE name = VALUES(name);



