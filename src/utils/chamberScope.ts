import { prisma } from "../lib/prisma";
import { createAppError } from "../errors/appError";
import { Status } from "../errors/httpStatus";
import { MembershipStatus } from "../../generated/prisma/enums";


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


export const chamberScopeFilter = (
  chamberId: string | null,
): { chamberId: string | null } => ({ chamberId });



export type RequestScope = {
  mode: "current" | "all";
  workspaceId: string;
  workspaceIds: string[];
  chamberId: string | null;
};


export const authorizedWorkspaceIds = async (
  userId: string,
): Promise<string[]> => {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: MembershipStatus.ACTIVE },
    select: { workspaceId: true },
  });
  return memberships.map((m) => m.workspaceId);
};



export const requestedScopeMode = (req: any): "current" | "all" => {
  const header = req?.headers?.["x-workspace-scope"];
  const value =
    typeof header === "string" && header.trim()
      ? header.trim()
      : typeof req?.query?.workspaceScope === "string"
        ? req.query.workspaceScope.trim()
        : "";
  return value.toLowerCase() === "all" ? "all" : "current";
};

export const resolveRequestScope = async (
  userId: string,
  workspaceId: string,
  req: any,
): Promise<RequestScope> => {
  const requestedChamberId = chamberIdFromRequest(req);

  
  
  
  if (requestedScopeMode(req) === "all" && !requestedChamberId) {
    return {
      mode: "all",
      workspaceId,
      workspaceIds: await authorizedWorkspaceIds(userId),
      chamberId: null,
    };
  }

  const chamberId = await resolveChamberScope(workspaceId, requestedChamberId);
  return { mode: "current", workspaceId, workspaceIds: [workspaceId], chamberId };
};


export const scopeFilter = (
  scope: RequestScope,
): Record<string, unknown> =>
  scope.mode === "all"
    ? { workspaceId: { in: scope.workspaceIds } }
    : { workspaceId: scope.workspaceId, ...chamberScopeFilter(scope.chamberId) };


export const recordInScope = (
  record: { workspaceId?: string | null; chamberId?: string | null },
  scope: RequestScope,
): boolean => {
  if (scope.mode === "all") {
    return scope.workspaceIds.includes(record.workspaceId ?? "");
  }
  return (
    record.workspaceId === scope.workspaceId &&
    (record.chamberId ?? null) === scope.chamberId
  );
};

export const chamberIdFromRequest = (req: any): string | null => {
  const header = req?.headers?.["x-chamber-id"];
  if (typeof header === "string" && header.trim()) return header.trim();
  const query = req?.query?.chamberId;
  if (typeof query === "string" && query.trim()) return query.trim();
  return null;
};
