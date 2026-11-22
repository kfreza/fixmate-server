import multer from "multer";
import { Cs_AppError } from "../utils/cs_appError";

const CS_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const CS_MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB

// Keep file in memory, then forward to ImgBB
export const cs_imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CS_MAX_IMAGE_SIZE, files: 1 },
  fileFilter: (_req, cs_file, cs_callback) => {
    if (CS_ALLOWED_IMAGE_TYPES.includes(cs_file.mimetype)) {
      return cs_callback(null, true);
    }
    cs_callback(new Cs_AppError(400, "Only JPG, PNG, WEBP or GIF images are allowed"));
  },
});
