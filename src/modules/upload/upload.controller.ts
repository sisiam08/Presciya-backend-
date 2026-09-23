import { Response } from "express";
import sharp from "sharp";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { createAppError } from "../../errors/appError";
import { uploadFileToCloudinary } from "../../config/cloudinary.config";
import { AuthenticatedRequest } from "../../middleware/auth";

/**
 * Generic image upload for configuration images (logos, watermarks, signatures).
 *
 * It deliberately reuses the EXISTING Cloudinary infrastructure
 * (`uploadFileToCloudinary`) rather than introducing a second storage system:
 * the file is optimised with sharp, stored in Cloudinary, and only the resulting
 * URL/public id is returned. The caller then saves that URL into whatever
 * configuration owns it — nothing is linked here.
 */
const uploadImage = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const file = req.file;

  if (!file) {
    throw createAppError("No image provided", Status.BAD_REQUEST);
  }

  const buffer = await sharp(file.buffer)
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const result = await uploadFileToCloudinary(
    buffer,
    file.originalname.replace(/\.[^.]+$/, ".webp"),
  );

  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "Image uploaded",
    data: {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    },
  });
});

export const UploadControllers = { uploadImage };
