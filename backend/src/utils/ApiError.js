// A lightweight error type carrying an HTTP status, so controllers can just
// `throw new ApiError(404, 'Course not found')` and the error middleware
// knows exactly what to send back.
export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}
