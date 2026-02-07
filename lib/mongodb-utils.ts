/**
 * MongoDB ObjectID validation and utilities
 */

/**
 * Check if a string is a valid MongoDB ObjectID
 * MongoDB ObjectIDs are 24 hexadecimal characters
 * 
 * @param id - The ID to validate
 * @returns true if valid ObjectID format
 */
export function isValidObjectId(id: string | number | unknown): boolean {
  if (!id) return false;
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{24}$/i.test(id);
}

/**
 * Convert any ID to string and validate
 * Logs warning if invalid format
 * 
 * @param id - The ID to convert and validate
 * @param context - Context for logging (e.g., "doctor_id", "user_id")
 * @returns Validated ID string or null if invalid
 */
export function validateAndConvertId(id: string | number | unknown, context: string = 'id'): string | null {
  const strId = String(id).trim();
  
  if (!isValidObjectId(strId)) {
    console.warn(`[ObjectID Validation] Invalid ${context}: "${strId}" is not a valid MongoDB ObjectID`);
    return null;
  }
  
  return strId;
}

/**
 * Validate multiple IDs at once
 * 
 * @param ids - Array of IDs to validate
 * @param context - Context for logging
 * @returns Array of valid IDs only
 */
export function validateAndConvertIds(ids: (string | number)[], context: string = 'ids'): string[] {
  return ids
    .map(id => validateAndConvertId(id, context))
    .filter((id): id is string => id !== null);
}

/**
 * Example usage:
 * 
 * // Single ID
 * const userId = validateAndConvertId(req.body.user_id, 'user_id');
 * if (!userId) return error('Invalid user ID');
 * 
 * // Multiple IDs
 * const userIds = validateAndConvertIds(req.body.user_ids, 'user_ids');
 * 
 * // Direct check
 * if (!isValidObjectId(id)) return error('Invalid ID');
 */
