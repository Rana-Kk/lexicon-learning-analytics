-- Student-specific checklist evaluation records
USE lexicon_learning_analytics;

CREATE TABLE IF NOT EXISTS student_assessment_checklist_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  checklist_criterion_id BIGINT UNSIGNED NOT NULL,
  yes_no_value BOOLEAN NULL,
  score_value DECIMAL(6,2) NULL,
  text_value TEXT NULL,
  teacher_feedback TEXT NULL,
  evaluated_by BIGINT UNSIGNED NULL,
  evaluated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_checklist_result (assessment_id, student_id, checklist_criterion_id),
  CONSTRAINT fk_student_checklist_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_checklist_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_checklist_criterion FOREIGN KEY (checklist_criterion_id) REFERENCES assessment_checklist_criteria(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_checklist_evaluator FOREIGN KEY (evaluated_by) REFERENCES users(id) ON DELETE SET NULL
);
