import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// MOCK DATABASE
// ============================================================

vi.mock('../../src/config/db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}))

import { pool } from '../../src/config/db.js'

import {
  getAllCriteriaTemplates,
  getCriteriaTemplateById,
} from '../../src/controllers/criteriaTemplates.controller.js'

// ============================================================
// TESTS
// ============================================================

describe('criteria templates controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // getAllCriteriaTemplates
  // ============================================================

  describe('getAllCriteriaTemplates', () => {
    it('should return all criteria templates with their criteria', async () => {
      const templates = [
        {
          id: 1,
          name: 'Web Development',
          description: 'Criteria for web development',
          created_at: '2026-09-01',
        },
        {
          id: 2,
          name: 'Java Programming',
          description: 'Criteria for Java',
          created_at: '2026-09-02',
        },
      ]

      const items = [
        {
          id: 1,
          template_id: 1,
          name: 'Code Quality',
          description: 'Clean and readable code',
          criterion_type: 'manual',
          max_score: 10,
          sort_order: 1,
        },
        {
          id: 2,
          template_id: 1,
          name: 'Functionality',
          description: 'Application works correctly',
          criterion_type: 'manual',
          max_score: 20,
          sort_order: 2,
        },
        {
          id: 3,
          template_id: 2,
          name: 'OOP',
          description: 'Correct use of OOP',
          criterion_type: 'manual',
          max_score: 15,
          sort_order: 1,
        },
      ]

      pool.query.mockResolvedValueOnce([
        templates,
      ])

      pool.query.mockResolvedValueOnce([
        items,
      ])

      const req = {}

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await getAllCriteriaTemplates(req, res)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            ...templates[0],
            criteria: [
              items[0],
              items[1],
            ],
          },
          {
            ...templates[1],
            criteria: [
              items[2],
            ],
          },
        ],
      })
    })

    it('should return an empty array when there are no criteria templates', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {}

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await getAllCriteriaTemplates(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      })
    })

    it('should return templates with empty criteria arrays when they have no criteria', async () => {
      const templates = [
        {
          id: 1,
          name: 'Empty Template',
          description: null,
          created_at: '2026-09-01',
        },
      ]

      pool.query.mockResolvedValueOnce([
        templates,
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {}

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await getAllCriteriaTemplates(req, res)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            ...templates[0],
            criteria: [],
          },
        ],
      })
    })

    it('should correctly group criteria by template_id', async () => {
      const templates = [
        {
          id: 1,
          name: 'Template One',
        },
        {
          id: 2,
          name: 'Template Two',
        },
      ]

      const items = [
        {
          id: 1,
          template_id: 2,
          name: 'Criterion for Template Two',
          sort_order: 1,
        },
        {
          id: 2,
          template_id: 1,
          name: 'Criterion for Template One',
          sort_order: 1,
        },
      ]

      pool.query.mockResolvedValueOnce([
        templates,
      ])

      pool.query.mockResolvedValueOnce([
        items,
      ])

      const req = {}

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await getAllCriteriaTemplates(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            ...templates[0],
            criteria: [
              items[1],
            ],
          },
          {
            ...templates[1],
            criteria: [
              items[0],
            ],
          },
        ],
      })
    })
  })

  // ============================================================
  // getCriteriaTemplateById
  // ============================================================

  describe('getCriteriaTemplateById', () => {
    it('should return a criteria template with its criteria', async () => {
      const template = {
        id: 1,
        name: 'Web Development',
        description: 'Web development assessment criteria',
        created_at: '2026-09-01',
      }

      const items = [
        {
          id: 1,
          template_id: 1,
          name: 'Code Quality',
          description: 'Clean code',
          criterion_type: 'manual',
          max_score: 10,
          sort_order: 1,
        },
        {
          id: 2,
          template_id: 1,
          name: 'Functionality',
          description: 'Correct functionality',
          criterion_type: 'manual',
          max_score: 20,
          sort_order: 2,
        },
      ]

      pool.query.mockResolvedValueOnce([
        [template],
      ])

      pool.query.mockResolvedValueOnce([
        items,
      ])

      const req = {
        params: {
          id: '1',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await getCriteriaTemplateById(req, res)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          ...template,
          criteria: items,
        },
      })
    })

    it('should return 404 when criteria template does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        params: {
          id: '999',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await getCriteriaTemplateById(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalled()

      expect(next.mock.calls[0][0].statusCode).toBe(404)

      expect(next.mock.calls[0][0].message).toBe(
        'Criteria template not found'
      )

      expect(res.json).not.toHaveBeenCalled()
    })

    it('should return the template with an empty criteria array when it has no criteria', async () => {
      const template = {
        id: 1,
        name: 'Empty Template',
        description: null,
        created_at: '2026-09-01',
      }

      pool.query.mockResolvedValueOnce([
        [template],
      ])

      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        params: {
          id: '1',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await getCriteriaTemplateById(req, res)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(res.status).toHaveBeenCalledWith(200)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          ...template,
          criteria: [],
        },
      })
    })
  })
})