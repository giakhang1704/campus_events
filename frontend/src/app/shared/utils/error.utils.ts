/** Text to show for a failed call: the server's (already Vietnamese) message, else a generic fallback. */
export function errorMessage(error: unknown, fallback = 'Không thực hiện được. Vui lòng thử lại.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
