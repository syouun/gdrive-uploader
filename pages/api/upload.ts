import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";      // 🔗 認証設定を共有
import { google } from "googleapis";
import formidable, { File } from "formidable";
import fs from "fs";

/* --- multipart 受信設定 --- */
export const config = {
  api: { bodyParser: false, sizeLimit: "4mb" },          // Vercel 無料枠上限
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  /* ① セッションからアクセストークン取得 ---------------------- */
  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: "Unauthorized" });

  /* ② フォームデータ解析 ------------------------------------- */
  const form = formidable({ multiples: false, maxFiles: 1 });
  form.parse(req, async (err, _fields, files) => {
    if (err) return res.status(400).json({ error: "Form parse error" });

    const uploaded = Array.isArray(files.file) ? files.file[0] : (files.file as File | undefined);
    if (!uploaded) return res.status(400).json({ error: "No file sent" });

    try {
      /* ③ Google Drive へアップロード ------------------------- */
      const oauth2 = new google.auth.OAuth2();
      oauth2.setCredentials({ access_token: session.accessToken });

      const drive = google.drive({ version: "v3", auth: oauth2 });
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
      fs.unlink(uploaded.filepath, () => {});            // 一時ファイル掃除
    }
  });
}