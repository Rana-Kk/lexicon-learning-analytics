// Wraps an async route handler so a thrown/rejected error is forwarded to
// Express's error middleware instead of crashing the process or hanging the request.
//export function asyncHandler(fn) {
  //return (req, res, next) => {
  //  return Promise.resolve(fn(req, res, next)).catch(next)
  //}
// }
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
};