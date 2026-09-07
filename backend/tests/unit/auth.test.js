import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest'

// ============================================================
// MOCK JWT
// ============================================================

const verifyMock = vi.fn()

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: verifyMock,
  },
}))

// ============================================================
// IMPORT AFTER MOCK
// ============================================================

const {
  authenticate,
  authorize,
} = await import('../../src/middleware/auth.js')

// ============================================================
// TESTS
// ============================================================

describe('auth middleware', () => {
  let req
  let res
  let next

  beforeEach(() => {
    req = {
      headers: {},
    }

    res = {}

    next = vi.fn()

    verifyMock.mockReset()
  })

  // ==========================================================
  // AUTHENTICATE
  // ==========================================================

  describe('authenticate', () => {
    it('should return 401 when no authorization header is provided', () => {
      authenticate(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(401)
      expect(error.message).toBe(
        'Authentication required. No token provided.'
      )

      expect(verifyMock).not.toHaveBeenCalled()
    })

    it('should return 401 when authorization header is not Bearer format', () => {
      req.headers.authorization = 'invalid-token'

      authenticate(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(401)

      expect(verifyMock).not.toHaveBeenCalled()
    })

    it('should attach decoded user and call next when token is valid', () => {
      req.headers.authorization = 'Bearer valid-token'

      const decodedUser = {
        sub: 5,
        role: 'teacher',
      }

      verifyMock.mockReturnValue(decodedUser)

      authenticate(req, res, next)

      expect(verifyMock).toHaveBeenCalledWith(
        'valid-token',
        expect.any(String)
      )

      expect(req.user).toEqual(decodedUser)

      expect(next).toHaveBeenCalledTimes(1)
      expect(next).toHaveBeenCalledWith()
    })

    it('should return 401 when token is invalid or expired', () => {
      req.headers.authorization = 'Bearer invalid-token'

      verifyMock.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      authenticate(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(401)
      expect(error.message).toBe(
        'Invalid or expired token.'
      )
    })
  })

  // ==========================================================
  // AUTHORIZE
  // ==========================================================

  describe('authorize', () => {
    it('should allow a user with an authorized role', () => {
      req.user = {
        sub: 5,
        role: 'teacher',
      }

      const middleware = authorize('teacher', 'admin')

      middleware(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)
      expect(next).toHaveBeenCalledWith()
    })

    it('should return 403 when user role is not authorized', () => {
      req.user = {
        sub: 5,
        role: 'student',
      }

      const middleware = authorize('teacher', 'admin')

      middleware(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(403)
      expect(error.message).toBe(
        'Access denied: You do not have permission for this action.'
      )
    })

    it('should return 403 when req.user does not exist', () => {
      const middleware = authorize('teacher')

      middleware(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)

      const error = next.mock.calls[0][0]

      expect(error.statusCode).toBe(403)
    })
  })
})