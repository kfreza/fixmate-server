import type { RequestHandler } from "express";
import { Cs_AppError } from "../utils/cs_appError";
import { cs_uploadToImgbb } from "../utils/cs_imgbb";

// POST /api/upload (multipart field: image)
export const cs_uploadImage: RequestHandler = async (req, res) => {
  if (!req.file) {
    throw new Cs_AppError(400, "Please choose an image to upload");
  }

  const cs_url = await cs_uploadToImgbb(req.file.buffer, req.file.originalname);
  res.status(201).json({ success: true, url: cs_url });
};
