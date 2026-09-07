import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database pool
vi.mock('../../src/config/db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}))

import { pool } from '../../src/config/db.js'

import {
  getTeacherGroupIds,
  teacherOwnsGroup,
  teacherHasStudent,
} from '../../src/utils/scope.js'

describe('scope utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // getTeacherGroupIds
  // ============================================================

  describe('getTeacherGroupIds', () => {
    it('should return all group IDs assigned to the teacher', async () => {
      pool.query.mockResolvedValueOnce([
        [
          { group_id: 1 },
          { group_id: 2 },
          { group_id: 3 },
        ],
      ])

      const result = await getTeacherGroupIds(10)

      expect(result).toEqual([1, 2, 3])

      expect(pool.query).toHaveBeenCalledTimes(1)
    })

    it('should return an empty array when the teacher has no groups', async () => {
      pool.query.mockResolvedValueOnce([[]])

      const result = await getTeacherGroupIds(10)

      expect(result).toEqual([])
    })
  })

  // ============================================================
  // teacherOwnsGroup
  // ============================================================

  describe('teacherOwnsGroup', () => {
    it('should return true when the teacher owns the group', async () => {
      pool.query.mockResolvedValueOnce([
        [{ group_id: 1 }],
      ])

      const result = await teacherOwnsGroup(10, 1)

      expect(result).toBe(true)
    })

    it('should return false when the teacher does not own the group', async () => {
      pool.query.mockResolvedValueOnce([[]])

      const result = await teacherOwnsGroup(10, 999)

      expect(result).toBe(false)
    })

    it('should return false immediately when groupId is missing', async () => {
      const result = await teacherOwnsGroup(10, null)

      expect(result).toBe(false)

      expect(pool.query).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // teacherHasStudent
  // ============================================================

  describe('teacherHasStudent', () => {
    it('should return true when the student belongs to one of the teacher groups', async () => {
      pool.query.mockResolvedValueOnce([
        [{ result: 1 }],
      ])

      const result = await teacherHasStudent(10, 25)

      expect(result).toBe(true)

      expect(pool.query).toHaveBeenCalledTimes(1)
    })

    it('should return false when the student is not assigned to the teacher', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const result = await teacherHasStudent(10, 25)

      expect(result).toBe(false)

      expect(pool.query).toHaveBeenCalledTimes(1)
    })

    it('should return false immediately when studentId is missing', async () => {
      const result = await teacherHasStudent(10, null)

      expect(result).toBe(false)

      expect(pool.query).not.toHaveBeenCalled()
    })
  })
})