import { Router } from "express";
import { authOnly } from "../../middleware/auth";
import { uploadImage } from "../../config/multer.config";
import { UploadControllers } from "./upload.controller";

const router = Router();



router.post(
  "/image",
  authOnly(),
  uploadImage.single("file"),
  UploadControllers.uploadImage,
);

export const UploadRouters = router;
