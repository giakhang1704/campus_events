/** Same limits as the backend (AuthService.checkPassword): BCrypt reads at most 72 bytes. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

/** The problem with a new password, or '' when it is acceptable. */
export function passwordProblem(password: string): string {
  const bytes = new TextEncoder().encode(password).length;
  return password.length < PASSWORD_MIN_LENGTH || bytes > PASSWORD_MAX_BYTES
    ? `Mật khẩu cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự và tối đa ${PASSWORD_MAX_BYTES} byte UTF-8.`
    : '';
}
