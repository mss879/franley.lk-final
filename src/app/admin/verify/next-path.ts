/**
 * Where to go after the code is accepted. Same-site admin paths only, and
 * never back to the sign-in steps themselves.
 */
export function safeAdminNext(next: unknown) {
  return typeof next === "string" &&
    /^\/admin(?:[/?#]|$)/.test(next) &&
    !/^\/admin\/(?:verify|login)(?:[/?#]|$)/.test(next)
    ? next
    : "/admin";
}
