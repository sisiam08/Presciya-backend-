export const getPaginationParams = (
  page?: unknown,
  limit?: unknown,
): { page: number; limit: number; skip: number } => {
  const pageNum = Math.max(1, parseInt(String(page ?? "1"), 10) || 1);
  const limitNum = Math.min(
    100,
    Math.max(1, parseInt(String(limit ?? "20"), 10) || 20),
  );
  return { page: pageNum, limit: limitNum, skip: (pageNum - 1) * limitNum };
};

export const buildPaginatedResult = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) => ({
  data,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
});
