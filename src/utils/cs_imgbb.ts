import { Cs_AppError } from "./cs_appError";

interface Cs_ImgbbResponse {
  success: boolean;
  data?: { display_url: string; url: string };
  error?: { message: string };
}

// Uploads an image buffer to ImgBB and returns its URL
export const cs_uploadToImgbb = async (cs_buffer: Buffer, cs_fileName: string): Promise<string> => {
  const cs_apiKey = process.env.CS_IMGBB_API_KEY;
  if (!cs_apiKey) {
    throw new Error("CS_IMGBB_API_KEY is not set");
  }

  const cs_form = new FormData();
  cs_form.append("image", cs_buffer.toString("base64"));
  cs_form.append("name", cs_fileName.replace(/\.[^.]+$/, ""));

  const cs_response = await fetch(`https://api.imgbb.com/1/upload?key=${cs_apiKey}`, {
    method: "POST",
    body: cs_form,
  });
  const cs_result = (await cs_response.json()) as Cs_ImgbbResponse;

  if (!cs_response.ok || !cs_result.success || !cs_result.data) {
    throw new Cs_AppError(502, cs_result.error?.message || "Image upload failed");
  }
  return cs_result.data.display_url;
};
