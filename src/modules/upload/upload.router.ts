import { Router } from "express";
import { authOnly } from "../../middleware/auth";
import { uploadImage } from "../../config/multer.config";
import { UploadControllers } from "./upload.controller";

const router = Router();

// Any authenticated user may upload a configuration image; the returned URL is
// only usable by the caller's own settings.
router.post(
  "/image",
  authOnly(),
  uploadImage.single("file"),
  UploadControllers.uploadImage,
);

export const UploadRouters = router;
