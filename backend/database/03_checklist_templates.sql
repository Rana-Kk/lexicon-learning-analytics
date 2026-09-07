-- ============================================================================
-- Lexicon Learning Analytics & AI Feedback Platform
-- Migration: Supervisor Checklist Template System
-- ============================================================================
--
-- BU MIGRATION MEVCUT SİSTEMLERE DOKUNMAZ:
--   - assessment_criteria / criterion_scores          (ESKİ, dokunulmuyor)
--   - assignment_evaluation_criteria / assignment_evaluation_results
--                                                      (BUGÜNKÜ İLK İSTEK, dokunulmuyor)
--
-- Bu migration TAMAMEN AYRI, ÜÇÜNCÜ bir sistem ekler:
--   criteria_templates          -> şablon havuzu (Chk-1, Chk-2, Frontend Individual...)
--   criteria_template_items     -> şablonun sabit kriter listesi
--   assessment_checklist_criteria  -> bir assessment'a şablondan kopyalanan,
--                                     sonradan serbestçe düzenlenebilen kriterler
--   assessment_checklist_results   -> AI + teacher sonuçları (bu kriterler için)
--
-- ============================================================================

USE lexicon_learning_analytics;

-- ----------------------------------------------------------------------------
-- 1. Şablon havuzu
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS criteria_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_criteria_templates_name (name)
);

CREATE TABLE IF NOT EXISTS criteria_template_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  criterion_type ENUM('yes_no','score','text') NOT NULL,
  max_score DECIMAL(6,2) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_criteria_template_items_template
    FOREIGN KEY (template_id) REFERENCES criteria_templates(id) ON DELETE CASCADE
);
CREATE INDEX ix_criteria_template_items_template ON criteria_template_items (template_id);

-- ----------------------------------------------------------------------------
-- 2. assessments tablosuna, hangi şablondan başladığını hatırlamak için
--    nullable bir referans (bilgi amaçlı; şablon silinirse assessment bozulmaz)
-- ----------------------------------------------------------------------------

ALTER TABLE assessments
  ADD COLUMN criteria_template_id BIGINT UNSIGNED NULL AFTER type,
  ADD CONSTRAINT fk_assessments_criteria_template
    FOREIGN KEY (criteria_template_id) REFERENCES criteria_templates(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 3. Assessment'a özel, düzenlenebilir checklist kriterleri
--    (oluşturma anında template_items'tan kopyalanır, sonra bağımsızdır)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS assessment_checklist_criteria (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_id BIGINT UNSIGNED NOT NULL,
  source_template_item_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  criterion_type ENUM('yes_no','score','text') NOT NULL,
  max_score DECIMAL(6,2) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_assessment_checklist_criteria_assessment
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_checklist_criteria_template_item
    FOREIGN KEY (source_template_item_id) REFERENCES criteria_template_items(id) ON DELETE SET NULL
);
CREATE INDEX ix_assessment_checklist_criteria_assessment ON assessment_checklist_criteria (assessment_id);

-- ----------------------------------------------------------------------------
-- 4. AI + teacher sonuçları (assignment_evaluation_results ile aynı şekil,
--    ama tamamen ayrı tablo/FK zinciri)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS assessment_checklist_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ai_evaluation_id BIGINT UNSIGNED NOT NULL,
  checklist_criterion_id BIGINT UNSIGNED NOT NULL,

  ai_yes_no_value BOOLEAN NULL,
  ai_score_value DECIMAL(6,2) NULL,
  ai_text_value TEXT NULL,
  ai_feedback TEXT NULL,

  teacher_yes_no_value BOOLEAN NULL,
  teacher_score_value DECIMAL(6,2) NULL,
  teacher_text_value TEXT NULL,
  teacher_feedback TEXT NULL,

  UNIQUE KEY uq_assessment_checklist_result (ai_evaluation_id, checklist_criterion_id),
  CONSTRAINT fk_assessment_checklist_results_ai_evaluation
    FOREIGN KEY (ai_evaluation_id) REFERENCES ai_evaluations(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_checklist_results_criterion
    FOREIGN KEY (checklist_criterion_id) REFERENCES assessment_checklist_criteria(id) ON DELETE CASCADE
);
CREATE INDEX ix_assessment_checklist_results_criterion ON assessment_checklist_results (checklist_criterion_id);

-- ============================================================================
-- SEED: Supervisor'un paylaştığı 5 şablon
-- ============================================================================

INSERT INTO criteria_templates (name, description) VALUES
  ('Chk-1', 'Checkpoint 1 rubric'),
  ('Chk-2', 'Checkpoint 2 rubric'),
  ('Individual', 'Individual project rubric'),
  ('Frontend Individual', 'Frontend individual project rubric'),
  ('Asset Trac-2', 'Asset tracker checkpoint rubric');

-- ---- Chk-1 ----
INSERT INTO criteria_template_items (template_id, name, criterion_type, max_score, sort_order)
SELECT id, x.name, x.criterion_type, x.max_score, x.sort_order
FROM criteria_templates,
(
  SELECT 'Delivered on Time' name, 'yes_no' criterion_type, NULL max_score, 1 sort_order UNION ALL
  SELECT 'Program Runs or Bug', 'yes_no', NULL, 2 UNION ALL
  SELECT 'Level Done', 'text', NULL, 3 UNION ALL
  SELECT 'Colorized Messages / User Friendly Notices', 'yes_no', NULL, 4 UNION ALL
  SELECT 'Sorted', 'yes_no', NULL, 5 UNION ALL
  SELECT 'Used String / Array Methods', 'yes_no', NULL, 6 UNION ALL
  SELECT '"exit" works for all formats', 'yes_no', NULL, 7 UNION ALL
  SELECT 'Code Structure / Code Quality', 'score', 10, 8 UNION ALL
  SELECT 'Code Description or Comments', 'score', 10, 9 UNION ALL
  SELECT 'Code clarity (Name of variables-understandability...)', 'score', 10, 10 UNION ALL
  SELECT 'GitHub Readme.md file structure', 'score', 10, 11 UNION ALL
  SELECT 'Final', 'score', 10, 12
) x
WHERE criteria_templates.name = 'Chk-1';

-- ---- Chk-2 ----
INSERT INTO criteria_template_items (template_id, name, criterion_type, max_score, sort_order)
SELECT id, x.name, x.criterion_type, x.max_score, x.sort_order
FROM criteria_templates,
(
  SELECT 'Delivered on Time' name, 'yes_no' criterion_type, NULL max_score, 1 sort_order UNION ALL
  SELECT 'Program Runs or Bug', 'yes_no', NULL, 2 UNION ALL
  SELECT 'Used List', 'yes_no', NULL, 3 UNION ALL
  SELECT 'Used Linq', 'yes_no', NULL, 4 UNION ALL
  SELECT '2 classes', 'yes_no', NULL, 5 UNION ALL
  SELECT 'Used Build-In Methods', 'yes_no', NULL, 6 UNION ALL
  SELECT 'Used Class Methods or Functions (own method or functions)', 'yes_no', NULL, 7 UNION ALL
  SELECT 'Print Sorted by Price', 'yes_no', NULL, 8 UNION ALL
  SELECT 'Total Price', 'yes_no', NULL, 9 UNION ALL
  SELECT 'Colorized Messages / User Friendly Notices', 'yes_no', NULL, 10 UNION ALL
  SELECT 'Can add more product after list', 'yes_no', NULL, 11 UNION ALL
  SELECT 'Error handling', 'yes_no', NULL, 12 UNION ALL
  SELECT 'Level 4 Extra - Searching', 'yes_no', NULL, 13 UNION ALL
  SELECT 'Level 4 Extra - Highlight the searched item', 'yes_no', NULL, 14 UNION ALL
  SELECT 'Code Structure', 'score', 10, 15 UNION ALL
  SELECT 'Divided into class files', 'yes_no', NULL, 16 UNION ALL
  SELECT 'Code Description/Comments', 'score', 10, 17 UNION ALL
  SELECT 'Code clarity (Name of variables-understandibility...)', 'score', 10, 18 UNION ALL
  SELECT 'GitHub Readme.md file structure', 'score', 10, 19 UNION ALL
  SELECT 'Final', 'score', 10, 20
) x
WHERE criteria_templates.name = 'Chk-2';

-- ---- Individual ----
INSERT INTO criteria_template_items (template_id, name, criterion_type, max_score, sort_order)
SELECT id, x.name, x.criterion_type, x.max_score, x.sort_order
FROM criteria_templates,
(
  SELECT 'Plan' name, 'text' criterion_type, NULL max_score, 1 sort_order UNION ALL
  SELECT 'App', 'yes_no', NULL, 2 UNION ALL
  SELECT 'Demo', 'yes_no', NULL, 3 UNION ALL
  SELECT 'Code', 'score', 10, 4 UNION ALL
  SELECT 'Presentation', 'score', 10, 5 UNION ALL
  SELECT 'Clean Code', 'score', 10, 6 UNION ALL
  SELECT 'Colorized Messages / User Friendly Notices', 'yes_no', NULL, 7 UNION ALL
  SELECT 'Sorted', 'yes_no', NULL, 8 UNION ALL
  SELECT 'Used Build-In Methods', 'yes_no', NULL, 9 UNION ALL
  SELECT 'Using AI', 'text', NULL, 10 UNION ALL
  SELECT 'Code Structure / Code Quality', 'score', 10, 11 UNION ALL
  SELECT 'Code Description or Comments', 'score', 10, 12 UNION ALL
  SELECT 'Code clarity (Name of variables-understandability...)', 'score', 10, 13 UNION ALL
  SELECT 'GitHub Readme.md file structure', 'score', 10, 14 UNION ALL
  SELECT 'Divided into class files', 'yes_no', NULL, 15 UNION ALL
  SELECT 'Working with Files', 'yes_no', NULL, 16 UNION ALL
  SELECT 'Final', 'score', 10, 17
) x
WHERE criteria_templates.name = 'Individual';

-- ---- Frontend Individual ----
INSERT INTO criteria_template_items (template_id, name, criterion_type, max_score, sort_order)
SELECT id, x.name, x.criterion_type, x.max_score, x.sort_order
FROM criteria_templates,
(
  SELECT 'CV' name, 'yes_no' criterion_type, NULL max_score, 1 sort_order UNION ALL
  SELECT 'Cakery', 'yes_no', NULL, 2 UNION ALL
  SELECT 'Personal Portfolio', 'yes_no', NULL, 3 UNION ALL
  SELECT 'Selected', 'yes_no', NULL, 4 UNION ALL
  SELECT 'Delivered on Time', 'yes_no', NULL, 5 UNION ALL
  SELECT 'Program Runs or Bug', 'yes_no', NULL, 6 UNION ALL
  SELECT 'Project Structure & Organization', 'score', 10, 7 UNION ALL
  SELECT 'HTML Structure', 'score', 10, 8 UNION ALL
  SELECT 'CSS Styling', 'score', 10, 9 UNION ALL
  SELECT 'JavaScript Functionality', 'score', 10, 10 UNION ALL
  SELECT 'React Component Usage', 'score', 10, 11 UNION ALL
  SELECT 'Bootstrap/Tailwind Usage', 'score', 10, 12 UNION ALL
  SELECT 'TypeScript Usage (if used)', 'score', 10, 13 UNION ALL
  SELECT 'Responsive Design', 'score', 10, 14 UNION ALL
  SELECT 'UI/UX Quality', 'score', 10, 15 UNION ALL
  SELECT 'Creativity & Problem Solving', 'score', 10, 16 UNION ALL
  SELECT 'Code Structure/Quality & Code Clarity', 'score', 10, 17 UNION ALL
  SELECT 'Presentation Skills', 'score', 10, 18 UNION ALL
  SELECT 'File/Folder Structure', 'score', 10, 19 UNION ALL
  SELECT 'Adapting AI Developing Process', 'text', NULL, 20 UNION ALL
  SELECT 'Performance / Accessibility / SEO', 'score', 10, 21 UNION ALL
  SELECT 'GitHub & Readme file', 'yes_no', NULL, 22 UNION ALL
  SELECT 'Deployed', 'yes_no', NULL, 23 UNION ALL
  SELECT 'Final Score', 'score', 10, 24
) x
WHERE criteria_templates.name = 'Frontend Individual';

-- ---- Asset Trac-2 ----
INSERT INTO criteria_template_items (template_id, name, criterion_type, max_score, sort_order)
SELECT id, x.name, x.criterion_type, x.max_score, x.sort_order
FROM criteria_templates,
(
  SELECT 'Delivered on Time' name, 'yes_no' criterion_type, NULL max_score, 1 sort_order UNION ALL
  SELECT 'Program Runs or Bug', 'yes_no', NULL, 2 UNION ALL
  SELECT 'Level-1', 'yes_no', NULL, 3 UNION ALL
  SELECT 'Level-2', 'yes_no', NULL, 4 UNION ALL
  SELECT 'Level-3', 'yes_no', NULL, 5 UNION ALL
  SELECT 'Sorted list with Class as primary (computers first, then phones)', 'yes_no', NULL, 6 UNION ALL
  SELECT 'Then sorted by purchase date', 'yes_no', NULL, 7 UNION ALL
  SELECT 'Mark any item RED if purchase date is less than 3 months away from 3 years', 'yes_no', NULL, 8 UNION ALL
  SELECT 'Sorted first by office', 'yes_no', NULL, 9 UNION ALL
  SELECT 'Items Yellow if date less than 6 months away from 3 years', 'yes_no', NULL, 10 UNION ALL
  SELECT 'Each item should have currency according to country', 'yes_no', NULL, 11 UNION ALL
  SELECT 'DB', 'yes_no', NULL, 12 UNION ALL
  SELECT 'Entity Framework', 'yes_no', NULL, 13 UNION ALL
  SELECT 'Error Handling', 'yes_no', NULL, 14 UNION ALL
  SELECT 'Code Structure', 'score', 10, 15 UNION ALL
  SELECT 'Code Description/Comments', 'score', 10, 16 UNION ALL
  SELECT 'Code clarity (Name of variables-understandibility..)', 'score', 10, 17 UNION ALL
  SELECT 'Final', 'score', 10, 18
) x
WHERE criteria_templates.name = 'Asset Trac-2';
