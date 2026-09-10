import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// GET /api/criteria-templates
export const getAllCriteriaTemplates = asyncHandler(async (req, res) => {
  const [templates] = await pool.query(
    `SELECT id, name, description, created_at
     FROM criteria_templates
     ORDER BY name ASC`
  );

  if (templates.length === 0) {
    return res.status(200).json({ success: true, data: [] });
  }

  const templateIds = templates.map(t => t.id);
  const [items] = await pool.query(
    `SELECT id, template_id, name, description, criterion_type, max_score, sort_order
     FROM criteria_template_items
     WHERE template_id IN (?)
     ORDER BY sort_order ASC`,
    [templateIds]
  );

  const itemsByTemplate = new Map();
  for (const item of items) {
    if (!itemsByTemplate.has(item.template_id)) itemsByTemplate.set(item.template_id, []);
    itemsByTemplate.get(item.template_id).push(item);
  }

  const data = templates.map(t => ({
    ...t,
    criteria: itemsByTemplate.get(t.id) || [],
  }));

  res.status(200).json({ success: true, data });
});

// GET /api/criteria-templates/:id
export const getCriteriaTemplateById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [template] = await pool.query(
    `SELECT id, name, description, created_at
     FROM criteria_templates
     WHERE id = ?`,
    [id]
  );

  if (template.length === 0) {
    throw new ApiError(404, 'Criteria template not found');
  }

  const [items] = await pool.query(
    `SELECT id, template_id, name, description, criterion_type, max_score, sort_order
     FROM criteria_template_items
     WHERE template_id = ?
     ORDER BY sort_order ASC`,
    [id]
  );

  res.status(200).json({
    success: true,
    data: { ...template[0], criteria: items },
  });
});