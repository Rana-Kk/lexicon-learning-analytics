import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// MOCK DATABASE
// ============================================================

vi.mock('../../src/config/db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}))

// ============================================================
// MOCK SCOPE FUNCTIONS
// ============================================================

vi.mock('../../src/utils/scope.js', () => ({
  teacherHasStudent: vi.fn(),
  getTeacherGroupIds: vi.fn(),
}))

import { pool } from '../../src/config/db.js'

import {
  teacherHasStudent,
  getTeacherGroupIds,
} from '../../src/utils/scope.js'

import {
  getCertificates,
  createCertificate,
  updateCertificate,
  deleteCertificate,
} from '../../src/controllers/certificates.controller.js'

// ============================================================
// TESTS
// ============================================================

describe('certificates controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // getCertificates
  // ============================================================

  describe('getCertificates', () => {
    it('should return all certificates for admin', async () => {
      const certificates = [
        {
          id: 1,
          student_id: 10,
          name: 'Web Development Certificate',
          student_name: 'John Doe',
          student_email: 'john@example.com',
        },
        {
          id: 2,
          student_id: 11,
          name: 'Java Certificate',
          student_name: 'Jane Doe',
          student_email: 'jane@example.com',
        },
      ]

      pool.query.mockResolvedValueOnce([
        certificates,
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        query: {},
      }

      const res = {
        json: vi.fn(),
      }

      await getCertificates(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: certificates,
      })
    })

    it('should return only the logged-in student certificates', async () => {
      const certificates = [
        {
          id: 1,
          student_id: 10,
          name: 'Web Development Certificate',
        },
      ]

      pool.query.mockResolvedValueOnce([
        certificates,
      ])

      const req = {
        user: {
          sub: 10,
          role: 'student',
        },
        query: {},
      }

      const res = {
        json: vi.fn(),
      }

      await getCertificates(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: certificates,
      })
    })

    it('should allow teacher to get certificates of their own student', async () => {
      teacherHasStudent.mockResolvedValueOnce(true)

      const certificates = [
        {
          id: 1,
          student_id: 10,
          name: 'Web Development Certificate',
        },
      ]

      pool.query.mockResolvedValueOnce([
        certificates,
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        query: {
          student_id: '10',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await getCertificates(req, res)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        '10'
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: certificates,
      })
    })

    it('should return 403 when teacher tries to access another student certificates', async () => {
      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        query: {
          student_id: '999',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await getCertificates(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        '999'
      )

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'You do not have access to this student',
        })
      )

      expect(res.json).not.toHaveBeenCalled()
    })

    it('should return empty array when teacher has no groups', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        query: {},
      }

      const res = {
        json: vi.fn(),
      }

      await getCertificates(req, res)

      expect(getTeacherGroupIds).toHaveBeenCalledWith(5)

      expect(pool.query).not.toHaveBeenCalled()

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      })
    })

    it('should return certificates from teacher groups when no student_id is provided', async () => {
      getTeacherGroupIds.mockResolvedValueOnce([
        1,
        2,
      ])

      const certificates = [
        {
          id: 1,
          student_id: 10,
          name: 'React Certificate',
        },
      ]

      pool.query.mockResolvedValueOnce([
        certificates,
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        query: {},
      }

      const res = {
        json: vi.fn(),
      }

      await getCertificates(req, res)

      expect(getTeacherGroupIds).toHaveBeenCalledWith(5)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: certificates,
      })
    })
  })

  // ============================================================
  // createCertificate
  // ============================================================

  describe('createCertificate', () => {
    it('should create a certificate successfully', async () => {
      const createdCertificate = {
        id: 1,
        student_id: 10,
        name: 'Web Development Certificate',
        issuing_organization: 'Lexicon',
        issue_date: '2026-09-01',
        student_name: 'John Doe',
        student_email: 'john@example.com',
      }

      pool.query.mockResolvedValueOnce([
        [{ id: 10 }],
      ])

      pool.query.mockResolvedValueOnce([
        {
          insertId: 1,
        },
      ])

      pool.query.mockResolvedValueOnce([
        [createdCertificate],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          student_id: 10,
          name: 'Web Development Certificate',
          issuing_organization: 'Lexicon',
          issue_date: '2026-09-01',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await createCertificate(req, res)

      expect(pool.query).toHaveBeenCalledTimes(3)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdCertificate,
      })
    })

    it('should return an error when student_id is missing', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          name: 'Web Development Certificate',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createCertificate(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'student_id and name are required',
        })
      )
    })

    it('should return an error when name is missing', async () => {
      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          student_id: 10,
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createCertificate(req, res, next)

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'student_id and name are required',
        })
      )
    })

    it('should return 403 when teacher tries to create certificate for another student', async () => {
      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        body: {
          student_id: 999,
          name: 'Java Certificate',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createCertificate(req, res, next)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        999
      )

      expect(pool.query).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'You do not have access to this student',
        })
      )
    })

    it('should allow teacher to create certificate for their own student', async () => {
      teacherHasStudent.mockResolvedValueOnce(true)

      const certificate = {
        id: 1,
        student_id: 10,
        name: 'Java Certificate',
      }

      pool.query.mockResolvedValueOnce([
        [{ id: 10 }],
      ])

      pool.query.mockResolvedValueOnce([
        { insertId: 1 },
      ])

      pool.query.mockResolvedValueOnce([
        [certificate],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        body: {
          student_id: 10,
          name: 'Java Certificate',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      await createCertificate(req, res)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        10
      )

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: certificate,
      })
    })

    it('should return an error when student does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        body: {
          student_id: 999,
          name: 'Unknown Student Certificate',
        },
      }

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      }

      const next = vi.fn()

      await createCertificate(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Student not found',
        })
      )
    })
  })

  // ============================================================
  // updateCertificate
  // ============================================================

  describe('updateCertificate', () => {
    it('should update a certificate successfully as admin', async () => {
      const updatedCertificate = {
        id: 1,
        student_id: 10,
        name: 'Advanced Web Development Certificate',
      }

      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      pool.query.mockResolvedValueOnce([
        [updatedCertificate],
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '1',
        },
        body: {
          name: 'Advanced Web Development Certificate',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await updateCertificate(req, res)

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedCertificate,
      })
    })

    it('should return an error when certificate does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 0,
        },
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '999',
        },
        body: {
          name: 'Updated Certificate',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await updateCertificate(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Certificate not found',
        })
      )
    })

    it('should allow teacher to update certificate of their own student', async () => {
      pool.query.mockResolvedValueOnce([
        [{ student_id: 10 }],
      ])

      teacherHasStudent.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      const certificate = {
        id: 1,
        student_id: 10,
        name: 'Updated Certificate',
      }

      pool.query.mockResolvedValueOnce([
        [certificate],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '1',
        },
        body: {
          name: 'Updated Certificate',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await updateCertificate(req, res)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        10
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: certificate,
      })
    })

    it('should return an error when teacher tries to update certificate of another student', async () => {
      pool.query.mockResolvedValueOnce([
        [{ student_id: 999 }],
      ])

      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '1',
        },
        body: {
          name: 'Updated Certificate',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await updateCertificate(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        999
      )

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'You do not have access to this student',
        })
      )
    })

    it('should return an error when teacher tries to update non-existing certificate', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '999',
        },
        body: {
          name: 'Updated Certificate',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await updateCertificate(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(teacherHasStudent).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Certificate not found',
        })
      )
    })
  })

  // ============================================================
  // deleteCertificate
  // ============================================================

  describe('deleteCertificate', () => {
    it('should delete certificate successfully as admin', async () => {
      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '1',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await deleteCertificate(req, res)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Certificate deleted',
      })
    })

    it('should return an error when certificate does not exist', async () => {
      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 0,
        },
      ])

      const req = {
        user: {
          sub: 1,
          role: 'admin',
        },
        params: {
          id: '999',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await deleteCertificate(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Certificate not found',
        })
      )
    })

    it('should allow teacher to delete certificate of their own student', async () => {
      pool.query.mockResolvedValueOnce([
        [{ student_id: 10 }],
      ])

      teacherHasStudent.mockResolvedValueOnce(true)

      pool.query.mockResolvedValueOnce([
        {
          affectedRows: 1,
        },
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '1',
        },
      }

      const res = {
        json: vi.fn(),
      }

      await deleteCertificate(req, res)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        10
      )

      expect(pool.query).toHaveBeenCalledTimes(2)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Certificate deleted',
      })
    })

    it('should return an error when teacher tries to delete certificate of another student', async () => {
      pool.query.mockResolvedValueOnce([
        [{ student_id: 999 }],
      ])

      teacherHasStudent.mockResolvedValueOnce(false)

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '1',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await deleteCertificate(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(teacherHasStudent).toHaveBeenCalledWith(
        5,
        999
      )

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'You do not have access to this student',
        })
      )
    })

    it('should return an error when teacher tries to delete a non-existing certificate', async () => {
      pool.query.mockResolvedValueOnce([
        [],
      ])

      const req = {
        user: {
          sub: 5,
          role: 'teacher',
        },
        params: {
          id: '999',
        },
      }

      const res = {
        json: vi.fn(),
      }

      const next = vi.fn()

      await deleteCertificate(req, res, next)

      expect(pool.query).toHaveBeenCalledTimes(1)

      expect(teacherHasStudent).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Certificate not found',
        })
      )
    })
  })
})