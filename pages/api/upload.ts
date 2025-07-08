import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { google } from "googleapis";
import formidable, { File } from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,          // multipart/form-data をそのまま受け取る
    sizeLimit: "4mb",           // Vercel 無料枠の上限以下に設定（任意）
  },
};

// ------------------------------------
// POST /api/upload
// ------------------------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // ① NextAuth で保存された JWT からアクセストークンを取得
  const token = await getToken({ req });
  if (!token?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ② フォームデータ解析
  const form = formidable({ multiples: false, maxFiles: 1 });
  form.parse(req, async (err, _fields, files) => {
    if (err) return res.status(400).json({ error: "Form parse error" });

    const uploaded = Array.isArray(files.file) ? files.file[0] : (files.file as File | undefined);
    if (!uploaded) return res.status(400).json({ error: "No file sent" });

    try {
      // ③ アクセストークンを OAuth2 クライアントへセット
      const oauth2 = new google.auth.OAuth2();
      oauth2.setCredentials({ access_token: token.accessToken as string });

      const drive = google.drive({ version: "v3", auth: oauth2 });

      // ④ Google Drive にアップロード
      const response = await drive.files.create({
        requestBody: {
          name: uploaded.originalFilename ?? "upload",
          mimeType: uploaded.mimetype ?? undefined,
        },
        media: {
          mimeType: uploaded.mimetype ?? undefined,
          body: fs.createReadStream(uploaded.filepath),
        },
        fields: "id",
      });

      return res.status(200).json({ fileId: response.data.id });
    } catch (uploadErr) {
      console.error(uploadErr);
      return res.status(500).json({ error: "Drive upload failed" });
    } finally {
      // Vercel の一時フォルダーを掃除
      fs.unlink(uploaded.filepath, () => {});
    }
  });
}