import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import config from ".";

cloudinary.config({
  cloud_name: config.cloudinary.cloudinaryCloudName as string,
  api_key: config.cloudinary.cloudinaryApiKey as string,
  api_secret: config.cloudinary.cloudinaryApiSecret as string,
});

export const uploadFileToCloudinary = async (
  buffer: Buffer,
  fileName: string,
): Promise<UploadApiResponse> => {
  if (!buffer || !fileName) {
    throw new Error("File buffer and file name are required for upload");
  }

  const extension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();

  const fileNameWithoutExt = fileName
    .substring(0, fileName.lastIndexOf("."))
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");

  const uniqueName =
    Math.random().toString(36).substring(2) +
    "-" +
    Date.now() +
    "-" +
    fileNameWithoutExt +
    extension;

  const folder =
    extension === ".pdf"
      ? "pdfs"
      : "images";

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: `Presciya/${folder}`,
          public_id: uniqueName,
          resource_type: "auto",
        },
        (error, result) => {
          if (error) {
            return reject(new Error("Failed to upload file to Cloudinary"));
          }
          resolve(result as UploadApiResponse);
        },
      )
      .end(buffer);
  });
};

export const deleteFileFromCloudinary = async (url: string) => {
  try {
    const parts = url.split("/upload/");
    if (parts.length > 1) {
      let path = parts[1] as string;
      path = path.replace(/^v\d+\//, "");

      const publicIdWithExt = path;
      const publicIdWithoutExt = path.includes(".") 
        ? path.substring(0, path.lastIndexOf(".")) 
        : path;

      let res = await cloudinary.uploader.destroy(publicIdWithoutExt, {
        resource_type: "image",
      });

      if (res.result === "ok") {
        console.log(`File ${publicIdWithoutExt} deleted successfully from Cloudinary.`);
        return;
      }

      res = await cloudinary.uploader.destroy(publicIdWithExt, {
        resource_type: "image",
      });

      if (res.result === "ok") {
        console.log(`File ${publicIdWithExt} deleted successfully from Cloudinary.`);
      } else {
        console.log(`Failed to delete file from Cloudinary. Result: ${res.result}`);
      }
    }
  } catch (error) {
    console.error("Error occurred while deleting file from Cloudinary:", error);
  }
};

export const cloudinaryUpload = cloudinary;
