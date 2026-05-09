import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cloudinaryUpload } from "./cloudinary.config";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const FILE_SIZE_LIMIT = 50 * 1024 * 1024;

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinaryUpload as any,
  params: async (req: any, file: any) => {
    try {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new Error(`File type not allowed.`);
      }

      const originalName = file.originalname;
      const extension = originalName.substring(originalName.lastIndexOf(".")).toLowerCase();
      const fileNameWithoutExt = originalName
        .substring(0, originalName.lastIndexOf("."))
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");

      const uniqueName = Math.random().toString(36).substring(2) + "-" + Date.now() + "-" + fileNameWithoutExt;

      const folder =
        extension === ".pdf"
          ? "pdfs"
          : "images";

      return {
        folder: `Presciya/${folder}`,
        public_id: uniqueName,
        resource_type: "auto",
        timeout: 120000,
      };
    } catch (error) {
      console.error("Error in multer params:", error);
      throw error;
    }
  },
});

export const uploadToCloudinary = multer({
  storage: cloudinaryStorage,
  limits: { fileSize: FILE_SIZE_LIMIT, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`File type not allowed.`));
    }
    cb(null, true);
  },
});

const memoryStorage = multer.memoryStorage();

export const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: FILE_SIZE_LIMIT,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(
        new Error(
          `File type not allowed.`
        )
      );
    }
    cb(null, true);
  },
});

export { memoryStorage as storage, cloudinaryStorage };
