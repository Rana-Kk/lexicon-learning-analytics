import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockHash: vi.fn(),
  mockCompare: vi.fn(),
  mockSign: vi.fn(),
}))

vi.mock('../../src/config/db.js', () => ({
  pool: {
    query: mocks.mockQuery,
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: mocks.mockHash,
    compare: mocks.mockCompare,
  },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: mocks.mockSign,
  },
}))

import {
  register,
  login,
  changePassword,
  me,
} from '../../src/controllers/auth.controller.js'

const mockQuery = mocks.mockQuery
const mockHash = mocks.mockHash
const mockCompare = mocks.mockCompare
const mockSign = mocks.mockSign
// =====================================================
// IMPORT CONTROLLER AFTER MOCKS
// =====================================================

import {
  register,
  login,
  changePassword,
  me,
} from '../../src/controllers/auth.controller.js'

// =====================================================
// HELPERS
// =====================================================

function createReq({
  body = {},
  params = {},
  query = {},
  user = {},
} = {}) {
  return {
    body,
    params,
    query,
    user,
  }
}

function createRes() {
  const res = {}

  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)

  return res
}

function createNext() {
  return vi.fn()
}

// =====================================================
// TESTS
// =====================================================

describe('Auth Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.JWT_SECRET = 'test-secret'
    process.env.JWT_EXPIRES_IN = '8h'

    mockSign.mockReturnValue('mock-jwt-token')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // =====================================================
  // REGISTER
  // =====================================================

  describe('register', () => {
    it('registers a user successfully', async () => {
      const req = createReq({
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
          role: 'student',
        },
      })

      const res = createRes()
      const next = createNext()

      mockHash.mockResolvedValue('hashed-password')

      mockQuery.mockResolvedValueOnce([
        {
          insertId: 10,
        },
      ])

      await register(req, res, next)

      expect(mockHash).toHaveBeenCalledWith(
        'password123',
        10
      )

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'INSERT INTO users'
        ),
        [
          'John Doe',
          'john@example.com',
          'hashed-password',
          'student',
        ]
      )

      expect(mockSign).toHaveBeenCalledWith(
        {
          sub: 10,
          role: 'student',
        },
        'test-secret',
        {
          expiresIn: '8h',
        }
      )

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith({
        user: {
          id: 10,
          name: 'John Doe',
          email: 'john@example.com',
          role: 'student',
        },
        token: 'mock-jwt-token',
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('returns error when required fields are missing', async () => {
      const req = createReq({
        body: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      })

      const res = createRes()
      const next = createNext()

      await register(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)
      expect(error.message).toBe(
        'name, email, password and role are required'
      )

      expect(mockHash).not.toHaveBeenCalled()
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('returns error for invalid role', async () => {
      const req = createReq({
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
          role: 'manager',
        },
      })

      const res = createRes()
      const next = createNext()

      await register(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)
      expect(error.message).toBe(
        'role must be admin, teacher or student'
      )

      expect(mockHash).not.toHaveBeenCalled()
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('allows admin role', async () => {
      const req = createReq({
        body: {
          name: 'Admin User',
          email: 'admin@example.com',
          password: 'password123',
          role: 'admin',
        },
      })

      const res = createRes()
      const next = createNext()

      mockHash.mockResolvedValue('hashed-password')

      mockQuery.mockResolvedValueOnce([
        { insertId: 1 },
      ])

      await register(req, res, next)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            role: 'admin',
          }),
        })
      )
    })

    it('allows teacher role', async () => {
      const req = createReq({
        body: {
          name: 'Teacher User',
          email: 'teacher@example.com',
          password: 'password123',
          role: 'teacher',
        },
      })

      const res = createRes()
      const next = createNext()

      mockHash.mockResolvedValue('hashed-password')

      mockQuery.mockResolvedValueOnce([
        { insertId: 2 },
      ])

      await register(req, res, next)

      expect(res.status).toHaveBeenCalledWith(201)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            role: 'teacher',
          }),
        })
      )
    })
  })

  // =====================================================
  // LOGIN
  // =====================================================

  describe('login', () => {
    it('logs in successfully', async () => {
      const req = createReq({
        body: {
          email: 'john@example.com',
          password: 'password123',
        },
      })

      const res = createRes()
      const next = createNext()

      const dbUser = {
        id: 10,
        name: 'John Doe',
        email: 'john@example.com',
        password_hash: 'hashed-password',
        role: 'student',
        github_username: 'johndoe',
        is_active: true,
        must_change_password: false,
        bio: 'Hello',
        avatar: 'avatar.png',
      }

      mockQuery.mockResolvedValueOnce([
        [dbUser],
      ])

      mockCompare.mockResolvedValue(true)

      await login(req, res, next)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'WHERE email = ?'
        ),
        ['john@example.com']
      )

      expect(mockCompare).toHaveBeenCalledWith(
        'password123',
        'hashed-password'
      )

      expect(mockSign).toHaveBeenCalledWith(
        {
          sub: 10,
          role: 'student',
        },
        'test-secret',
        {
          expiresIn: '8h',
        }
      )

      expect(res.json).toHaveBeenCalledWith({
        user: {
          id: 10,
          name: 'John Doe',
          email: 'john@example.com',
          role: 'student',
          github_username: 'johndoe',
          bio: 'Hello',
          avatar: 'avatar.png',
          must_change_password: false,
        },
        token: 'mock-jwt-token',
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('returns error when email is missing', async () => {
      const req = createReq({
        body: {
          password: 'password123',
        },
      })

      const res = createRes()
      const next = createNext()

      await login(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)
      expect(error.message).toBe(
        'email and password are required'
      )

      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('returns error when password is missing', async () => {
      const req = createReq({
        body: {
          email: 'john@example.com',
        },
      })

      const res = createRes()
      const next = createNext()

      await login(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)
      expect(error.message).toBe(
        'email and password are required'
      )
    })

    it('returns error when user does not exist', async () => {
      const req = createReq({
        body: {
          email: 'unknown@example.com',
          password: 'password123',
        },
      })

      const res = createRes()
      const next = createNext()

      mockQuery.mockResolvedValueOnce([
        [],
      ])

      await login(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(401)
      expect(error.message).toBe(
        'Invalid email or password'
      )

      expect(mockCompare).not.toHaveBeenCalled()
    })

    it('returns error when user is inactive', async () => {
      const req = createReq({
        body: {
          email: 'inactive@example.com',
          password: 'password123',
        },
      })

      const res = createRes()
      const next = createNext()

      mockQuery.mockResolvedValueOnce([
        [
          {
            id: 10,
            email: 'inactive@example.com',
            is_active: false,
          },
        ],
      ])

      await login(req, res, next)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(401)
      expect(error.message).toBe(
        'Invalid email or password'
      )

      expect(mockCompare).not.toHaveBeenCalled()
    })

    it('returns error when password is incorrect', async () => {
      const req = createReq({
        body: {
          email: 'john@example.com',
          password: 'wrong-password',
        },
      })

      const res = createRes()
      const next = createNext()

      mockQuery.mockResolvedValueOnce([
        [
          {
            id: 10,
            name: 'John Doe',
            email: 'john@example.com',
            password_hash: 'hashed-password',
            role: 'student',
            is_active: true,
          },
        ],
      ])

      mockCompare.mockResolvedValue(false)

      await login(req, res, next)

      expect(mockCompare).toHaveBeenCalledWith(
        'wrong-password',
        'hashed-password'
      )

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(401)
      expect(error.message).toBe(
        'Invalid email or password'
      )

      expect(mockSign).not.toHaveBeenCalled()
    })

    it('converts must_change_password to boolean', async () => {
      const req = createReq({
        body: {
          email: 'john@example.com',
          password: 'password123',
        },
      })

      const res = createRes()
      const next = createNext()

      mockQuery.mockResolvedValueOnce([
        [
          {
            id: 10,
            name: 'John',
            email: 'john@example.com',
            password_hash: 'hash',
            role: 'student',
            is_active: true,
            github_username: null,
            bio: null,
            avatar: null,
            must_change_password: 1,
          },
        ],
      ])

      mockCompare.mockResolvedValue(true)

      await login(req, res, next)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            must_change_password: true,
          }),
        })
      )
    })
  })

  // =====================================================
  // CHANGE PASSWORD
  // =====================================================

  describe('changePassword', () => {
    it('changes password successfully', async () => {
      const req = createReq({
        body: {
          current_password: 'oldpassword',
          new_password: 'newpassword123',
        },
        user: {
          sub: 10,
        },
      })

      const res = createRes()
      const next = createNext()

      mockQuery
        .mockResolvedValueOnce([
          [
            {
              id: 10,
              password_hash: 'old-hash',
            },
          ],
        ])
        .mockResolvedValueOnce([
          {
            affectedRows: 1,
          },
        ])

      mockCompare.mockResolvedValue(true)
      mockHash.mockResolvedValue('new-hash')

      await changePassword(req, res, next)

      expect(mockCompare).toHaveBeenCalledWith(
        'oldpassword',
        'old-hash'
      )

      expect(mockHash).toHaveBeenCalledWith(
        'newpassword123',
        10
      )

      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          'UPDATE users SET password_hash'
        ),
        [
          'new-hash',
          10,
        ]
      )

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully',
      })

      expect(next).not.toHaveBeenCalled()
    })

    it('returns error when current password is missing', async () => {
      const req = createReq({
        body: {
          new_password: 'newpassword123',
        },
        user: {
          sub: 10,
        },
      })

      const res = createRes()
      const next = createNext()

      await changePassword(req, res, next)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)

      expect(error.message).toBe(
        'Current password and a new password of at least 8 characters are required'
      )

      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('returns error when new password is missing', async () => {
      const req = createReq({
        body: {
          current_password: 'oldpassword',
        },
        user: {
          sub: 10,
        },
      })

      const res = createRes()
      const next = createNext()

      await changePassword(req, res, next)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)
    })

    it('returns error when new password is shorter than 8 characters', async () => {
      const req = createReq({
        body: {
          current_password: 'oldpassword',
          new_password: 'short',
        },
        user: {
          sub: 10,
        },
      })

      const res = createRes()
      const next = createNext()

      await changePassword(req, res, next)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(400)

      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('returns error when user is not found', async () => {
      const req = createReq({
        body: {
          current_password: 'oldpassword',
          new_password: 'newpassword123',
        },
        user: {
          sub: 999,
        },
      })

      const res = createRes()
      const next = createNext()

      mockQuery.mockResolvedValueOnce([
        [],
      ])

      await changePassword(req, res, next)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(404)
      expect(error.message).toBe('User not found')

      expect(mockCompare).not.toHaveBeenCalled()
      expect(mockHash).not.toHaveBeenCalled()
    })

    it('returns error when current password is incorrect', async () => {
      const req = createReq({
        body: {
          current_password: 'wrongpassword',
          new_password: 'newpassword123',
        },
        user: {
          sub: 10,
        },
      })

      const res = createRes()
      const next = createNext()

      mockQuery.mockResolvedValueOnce([
        [
          {
            id: 10,
            password_hash: 'old-hash',
          },
        ],
      ])

      mockCompare.mockResolvedValue(false)

      await changePassword(req, res, next)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(401)
      expect(error.message).toBe(
        'Current password is incorrect'
      )

      expect(mockHash).not.toHaveBeenCalled()
    })
  })

  // =====================================================
  // ME
  // =====================================================

  describe('me', () => {
    it('returns current user successfully', async () => {
      const req = createReq({
        user: {
          sub: 10,
        },
      })

      const res = createRes()
      const next = createNext()

      const user = {
        id: 10,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'student',
        github_username: 'johndoe',
        is_active: true,
        bio: 'Hello',
        avatar: 'avatar.png',
        must_change_password: false,
        created_at: '2026-01-01',
      }

      mockQuery.mockResolvedValueOnce([
        [user],
      ])

      await me(req, res, next)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'WHERE id = ?'
        ),
        [10]
      )

      expect(res.json).toHaveBeenCalledWith(user)

      expect(next).not.toHaveBeenCalled()
    })

    it('returns error when current user is not found', async () => {
      const req = createReq({
        user: {
          sub: 999,
        },
      })

      const res = createRes()
      const next = createNext()

      mockQuery.mockResolvedValueOnce([
        [],
      ])

      await me(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(404)
      expect(error.message).toBe('User not found')

      expect(res.json).not.toHaveBeenCalled()
    })
  })
})