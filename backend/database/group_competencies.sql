-- Run once in lexicon_learning_analytics.
-- A group can have its own competency catalog.

CREATE TABLE IF NOT EXISTS group_competencies (
  group_id BIGINT UNSIGNED NOT NULL,
  competency_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (group_id, competency_id),

  CONSTRAINT fk_group_competencies_group
    FOREIGN KEY (group_id)
    REFERENCES student_groups(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_group_competencies_competency
    FOREIGN KEY (competency_id)
    REFERENCES competencies(id)
    ON DELETE CASCADE
);
