// pages/api/upload.ts
//--------------------------------------------------------------
// Google Drive にファイルをアップロードする Next.js API Route
//   - Next.js 15 / Node 22 で確認
//   - Formidable v3 を利用（0 byte も許可）
//   - Vercel Functions の制限に合わせて 4 MB 強まで
//--------------------------------------------------------------

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

import formidable, { File as FormidableFile } from "formidable";
import fs from "fs/promises";
import { createReadStream } from "fs";
import { google } from "googleapis";

export const config = {
  api: { bodyParser: false, sizeLimit: "4mb" },
};

export default async function uploadHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).end("Unauthorized");
  if (session.error === "RefreshAccessTokenError")
    return res.status(401).end("Token expired — please sign‑in again");

  let tempPath: string | undefined;
  try {
    const file: FormidableFile = await new Promise((resolve, reject) => {
      formidable({ allowEmptyFiles: true, maxFiles: 1 }).parse(
        req,
        (err, _fields, files) => {
          if (err) return reject(err);
          const f = Array.isArray(files.file) ? files.file[0] : files.file;
          if (!f) return reject(new Error("No file field"));
          tempPath = f.filepath;
          resolve(f);
        }
      );
    });

    const oauth = new google.auth.OAuth2();
    oauth.setCredentials({ access_token: session.accessToken });
    const drive = google.drive({ version: "v3", auth: oauth });

    const isEmpty = file.size === 0;
    const resp = await drive.files.create({
      requestBody: {
        name: file.originalFilename ?? "untitled",
        mimeType: file.mimetype ?? "application/octet-stream",
      },
      ...(isEmpty
        ? {}
        : {
            media: {
              mimeType: file.mimetype ?? undefined,
              body: createReadStream(file.filepath),
            },
          }),
      fields: "id",
    });

    return res.status(200).json({ fileId: resp.data.id });
  } catch (err) {
    console.error("[upload] error", err);
    return res.status(500).json({ error: "Upload failed" });
  } finally {
    if (tempPath) fs.unlink(tempPath).catch(() => null);
  }
}