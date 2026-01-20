
/**
 * Standardized API response format
 * Ensures all API responses follow the same structure
 */

/**
 * Success response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {string} message - Response message
 * @param {any} data - Response data
 */
const successResponse = (res, statusCode = 200, message, data = null) => {
  return res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Error response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} message - Error message
 * @param {any} error - Error details (optional)
 */
const errorResponse = (res, statusCode = 500, message, error = null) => {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    error: process.env.NODE_ENV === "production" ? null : error,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Pagination response
 * @param {object} res - Express response object
 * @param {array} data - Array of items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items count
 * @param {string} message - Response message
 */
const paginationResponse = (
  res,
  data,
  page = 1,
  limit = 10,
  total = 0,
  message = "Data retrieved successfully"
) => {
  const totalPages = Math.ceil(total / limit);

  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalItems: total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginationResponse,
};