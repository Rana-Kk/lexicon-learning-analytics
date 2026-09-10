import { pool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// contextType: 'task' | 'submission'

async function getTeamMembers(contextType, contextId, userId) {
  let teamId;

  if (contextType === 'task') {
    const [rows] = await pool.query(
      `SELECT tt.team_id FROM task_teams tt
       JOIN team_members tm ON tm.team_id=tt.team_id
       WHERE tt.task_id=? AND tm.student_id=? LIMIT 1`,
      [contextId, userId]
    );
    teamId = rows[0]?.team_id;
  } else {
    // Assumes assessment_submissions.team_id — update this if the real column name differs
    const [rows] = await pool.query(
      `SELECT s.team_id FROM assessment_submissions s
       JOIN team_members tm ON tm.team_id=s.team_id
       WHERE s.id=? AND tm.student_id=? LIMIT 1`,
      [contextId, userId]
    );
    teamId = rows[0]?.team_id;
  }

  if (!teamId) return { teamId: null, members: [] };

  const [members] = await pool.query(
    `SELECT u.id, u.name FROM team_members tm
     JOIN users u ON u.id=tm.student_id WHERE tm.team_id=?`,
    [teamId]
  );
  return { teamId, members };
}

// POST .../peer-evaluations
// body: { evaluations: [{ evaluated_id, score, comment }, ...] }
export const submitPeerEvaluations = (contextType) => asyncHandler(async (req, res) => {
  const evaluatorId = req.user.sub;
  const contextId = req.params.id;
  const { evaluations } = req.body;

  if (!Array.isArray(evaluations) || !evaluations.length) {
    throw new ApiError(400, 'evaluations array is required');
  }
  for (const e of evaluations) {
    if (!e.evaluated_id || !Number.isInteger(e.score) || e.score < 1 || e.score > 5) {
      throw new ApiError(400, 'Each evaluation requires evaluated_id and a score between 1 and 5');
    }
  }

  if (contextType === 'task') {
    const [t] = await pool.query('SELECT status FROM tasks WHERE id=?', [contextId]);
    if (!t.length) throw new ApiError(404, 'Task not found');
    if (t[0].status !== 'active') throw new ApiError(400, 'Task is closed, evaluations are no longer accepted');
  }

  const { teamId, members } = await getTeamMembers(contextType, contextId, evaluatorId);
  if (!teamId) throw new ApiError(403, 'You are not a member of the team for this context');

  const memberIds = new Set(members.map((m) => m.id));
  for (const e of evaluations) {
    if (!memberIds.has(e.evaluated_id)) {
      throw new ApiError(400, `evaluated_id ${e.evaluated_id} is not a member of this team`);
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const e of evaluations) {
      await conn.query(
        `INSERT INTO peer_evaluations(context_type, context_id, team_id, evaluator_id, evaluated_id, score, comment)
         VALUES(?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE score=VALUES(score), comment=VALUES(comment)`,
        [contextType, contextId, teamId, evaluatorId, e.evaluated_id, e.score, e.comment || null]
      );
    }
    await conn.commit();
    res.status(201).json({ success: true });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// GET .../peer-evaluations/me
export const getMyPeerEvaluations = (contextType) => asyncHandler(async (req, res) => {
  const evaluatorId = req.user.sub;
  const contextId = req.params.id;

  const [rows] = await pool.query(
    `SELECT evaluated_id, score, comment FROM peer_evaluations
     WHERE context_type=? AND context_id=? AND evaluator_id=?`,
    [contextType, contextId, evaluatorId]
  );
  res.json({ success: true, data: rows });
});

// GET .../peer-evaluations — teacher/admin only, enforced via authorize() in the router
export const getAllPeerEvaluations = (contextType) => asyncHandler(async (req, res) => {
  const contextId = req.params.id;

  const [summary] = await pool.query(
    `SELECT pe.evaluated_id, u.name student_name,
            AVG(pe.score) avg_score, COUNT(*) vote_count
     FROM peer_evaluations pe
     JOIN users u ON u.id=pe.evaluated_id
     WHERE pe.context_type=? AND pe.context_id=?
     GROUP BY pe.evaluated_id, u.name`,
    [contextType, contextId]
  );
  const [details] = await pool.query(
    `SELECT evaluator_id, evaluated_id, score, comment
     FROM peer_evaluations WHERE context_type=? AND context_id=?`,
    [contextType, contextId]
  );
  res.json({ success: true, data: { summary, details } });
});