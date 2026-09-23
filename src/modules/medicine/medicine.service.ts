import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";

let isDbIndexed = false;

const initSearchIndex = async () => {
  if (isDbIndexed) return;
  try {
    // 1. Enable pg_trgm extension if not already present
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // 2. Add GIN trigram indexes on brandName and generic columns (PostgreSQL format)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS medicine_brand_trgm_idx ON medicines USING gin ("brandName" gin_trgm_ops);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS medicine_generic_trgm_idx ON medicines USING gin (generic gin_trgm_ops);
    `);

    isDbIndexed = true;
    console.log("⚡ PG Trigram Indexes successfully verified / created.");
  } catch (err: any) {
    console.warn("⚠️ PG Trigram Index Warning (Extension might be locked or unsupported):", err.message);
  }
};

const searchMedicines = async (
  userId: string,
  query: string,
  page: number = 1,
  limit: number = 20,
  /**
   * Plan entitlement `medicine_favorites`. When false the frequently-used list
   * is not served (and results are not flagged as favourites), so disabling the
   * feature in the Admin panel stops it at the API rather than only in the UI.
   */
  favoritesAllowed: boolean = false
) => {
  await initSearchIndex();

  const doctor = await prisma.doctor.findUnique({
    where: { userId },
  });

  if (!doctor) {
    throw createAppError("Doctor profile not found", Status.NOT_FOUND);
  }

  const skip = (page - 1) * limit;

  // 1. If search input is empty, return doctor's favorites / most frequently used medicines immediately!
  //    Gated: this list IS the `medicine_favorites` feature.
  if (!query || query.trim() === "") {
    if (!favoritesAllowed) {
      return { results: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }
    const favorites = await prisma.doctorFavoriteMedicine.findMany({
      where: { doctorId: doctor.id },
      orderBy: { frequencyCount: "desc" },
      take: limit,
      include: { medicine: true },
    });
    return {
      results: favorites.map((f) => ({
        ...f.medicine,
        isFavorite: true,
        frequencyCount: f.frequencyCount,
      })),
      meta: { page, limit, total: favorites.length, totalPages: 1 },
    };
  }

  const cleanQuery = query.trim();

  try {
    // 2. Perform fuzzy trigram search in Postgres
    // similarity() calculates score. order by score desc. % matches using pg_trgm similarity threshold.
    const sql = `
      SELECT id, "brandName", type, slug, "dosageForm", generic, strength, manufacturer,
             similarity("brandName", $1) AS score
      FROM medicines
      WHERE "brandName" % $1 
         OR "brandName" ILIKE $2
         OR generic ILIKE $2
      ORDER BY score DESC, "brandName" ASC
      LIMIT $3 OFFSET $4
    `;
    
    const results: any[] = await prisma.$queryRawUnsafe(
      sql,
      cleanQuery,
      `%${cleanQuery}%`,
      limit,
      skip
    );

    // Fetch favorites of this doctor to inject an 'isFavorite' flag. Skipped
    // entirely when the plan does not include the feature, so no favourite
    // affordance is ever derived from a denied entitlement.
    const doctorFavs = favoritesAllowed
      ? await prisma.doctorFavoriteMedicine.findMany({
          where: { doctorId: doctor.id },
          select: { medicineId: true },
        })
      : [];
    const favSet = new Set(doctorFavs.map((f) => f.medicineId));

    const finalResults = results.map((item) => ({
      id: item.id,
      brandName: item.brandName,
      type: item.type,
      slug: item.slug,
      dosageForm: item.dosageForm,
      generic: item.generic,
      strength: item.strength,
      manufacturer: item.manufacturer,
      isFavorite: favSet.has(item.id),
    }));

    return {
      results: finalResults,
      meta: {
        page,
        limit,
        total: finalResults.length,
      },
    };
  } catch (error) {
    // Standard ILIKE fallback if pg_trgm is not supported in Postgres environment
    console.warn("Falling back to ILIKE search due to error:", error);
    
    const results = await prisma.medicine.findMany({
      where: {
        OR: [
          { brandName: { contains: cleanQuery, mode: "insensitive" } },
          { generic: { contains: cleanQuery, mode: "insensitive" } },
        ],
      },
      orderBy: { brandName: "asc" },
      skip,
      take: limit,
    });

    const doctorFavs = await prisma.doctorFavoriteMedicine.findMany({
      where: { doctorId: doctor.id },
      select: { medicineId: true },
    });
    const favSet = new Set(doctorFavs.map((f) => f.medicineId));

    const finalResults = results.map((item) => ({
      ...item,
      isFavorite: favSet.has(item.id),
    }));

    return {
      results: finalResults,
      meta: { page, limit, total: finalResults.length },
    };
  }
};

const getDoctorFavorites = async (userId: string) => {
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
  });

  if (!doctor) {
    throw createAppError("Doctor profile not found", Status.NOT_FOUND);
  }

  return await prisma.doctorFavoriteMedicine.findMany({
    where: { doctorId: doctor.id },
    orderBy: { frequencyCount: "desc" },
    include: { medicine: true },
  });
};

const addFavorite = async (userId: string, medicineId: string) => {
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
  });

  if (!doctor) {
    throw createAppError("Doctor profile not found", Status.NOT_FOUND);
  }

  const medicine = await prisma.medicine.findUnique({
    where: { id: medicineId },
  });

  if (!medicine) {
    throw createAppError("Medicine not found", Status.NOT_FOUND);
  }

  return await prisma.doctorFavoriteMedicine.upsert({
    where: {
      doctorId_medicineId: {
        doctorId: doctor.id,
        medicineId,
      },
    },
    update: {
      frequencyCount: { increment: 1 },
    },
    create: {
      doctorId: doctor.id,
      medicineId,
      frequencyCount: 1,
    },
  });
};

const removeFavorite = async (userId: string, medicineId: string) => {
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
  });

  if (!doctor) {
    throw createAppError("Doctor profile not found", Status.NOT_FOUND);
  }

  await prisma.doctorFavoriteMedicine.delete({
    where: {
      doctorId_medicineId: {
        doctorId: doctor.id,
        medicineId,
      },
    },
  });
};

export const MedicineServices = {
  searchMedicines,
  getDoctorFavorites,
  addFavorite,
  removeFavorite,
};
