import { prisma } from "../lib/prisma";
import { createAppError } from "../errors/appError";
import { Status } from "../errors/httpStatus";
import { MembershipStatus } from "../../generated/prisma/enums";

/**
 * Canonical chamber scope for chamber-owned records.
 *
 * A record belongs to a chamber when `chamberId` is set, and to the personal
 * workspace when it is NULL. The client sends the chamber it is currently
 * operating in (the `x-chamber-id` header); it is NEVER trusted blindly — the
 * chamber must belong to the workspace the caller is already authorized for,
 * so a foreign chamber ID cannot be used to read or write another workspace's
 * data.
 */
export const resolveChamberScope = async (
  workspaceId: string,
  chamberId?: string | null,
): Promise<string | null> => {
  if (!chamberId) return null;

  const chamber = await prisma.chamber.findFirst({
    where: { id: chamberId, workspaceId },
    select: { id: true },
  });

  if (!chamber) {
    throw createAppError(
      "Chamber not found in the current workspace",
      Status.FORBIDDEN,
    );
  }

  return chamber.id;
};

/**
 * Prisma filter fragment for a resolved chamber scope.
 * `null` means the personal (chamber-less) context -> `chamberId IS NULL`.
 */
export const chamberScopeFilter = (
  chamberId: string | null,
): { chamberId: string | null } => ({ chamberId });

/**
 * The chamber the client is currently operating in. Sent as the `x-chamber-id`
 * header (with a `chamberId` query fallback for endpoints that already used it)
 * and always validated by `resolveChamberScope` before use.
 */
/**
 * The data scope of a request.
 *
 *  - `current` (default): ONLY the active workspace/chamber. A record from
 *    another chamber is not reachable, even by guessing its ID.
 *  - `all`: every workspace the authenticated user is an ACTIVE member of.
 *    This is an explicit opt-in (`workspaceScope=all`) and is still bounded by
 *    the user's own authorized workspaces — never another user's data.
 */
export type RequestScope = {
  mode: "current" | "all";
  workspaceId: string;
  workspaceIds: string[];
  chamberId: string | null;
};

/** Every workspace the user is an ACTIVE member of (the authorized set). */
export const authorizedWorkspaceIds = async (
  userId: string,
): Promise<string[]> => {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: MembershipStatus.ACTIVE },
    select: { workspaceId: true },
  });
  return memberships.map((m) => m.workspaceId);
};

/** Resolve the request's data scope, validating the chamber when scoped. */
export const resolveRequestScope = async (
  userId: string,
  workspaceId: string,
  req: any,
): Promise<RequestScope> => {
  if (req?.query?.workspaceScope === "all") {
    return {
      mode: "all",
      workspaceId,
      workspaceIds: await authorizedWorkspaceIds(userId),
      chamberId: null,
    };
  }

  const chamberId = await resolveChamberScope(
    workspaceId,
    chamberIdFromRequest(req),
  );
  return { mode: "current", workspaceId, workspaceIds: [workspaceId], chamberId };
};

/**
 * Prisma filter for a scope — used by BOTH list queries and record-level
 * lookups, so "current workspace" cannot be bypassed with a known record ID.
 */
export const scopeFilter = (
  scope: RequestScope,
): Record<string, unknown> =>
  scope.mode === "all"
    ? { workspaceId: { in: scope.workspaceIds } }
    : { workspaceId: scope.workspaceId, ...chamberScopeFilter(scope.chamberId) };

export const chamberIdFromRequest = (req: any): string | null => {
  const header = req?.headers?.["x-chamber-id"];
  if (typeof header === "string" && header.trim()) return header.trim();
  const query = req?.query?.chamberId;
  if (typeof query === "string" && query.trim()) return query.trim();
  return null;
};
