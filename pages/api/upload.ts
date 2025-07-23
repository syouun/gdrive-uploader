//--------------------------------------------------------------
// Google Drive にファイルをアップロードする Next.js API Route
//--------------------------------------------------------------
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import type { Session } from "next-auth";

import formidable, { File as FormidableFile } from "formidable";
import fs from "fs/promises";
import { createReadStream } from "fs";
import { google } from "googleapis";

// ── ★ セッション拡張型 ────────────────────────────────
type ExtendedSession = Session & {
  accessToken?: string;
  error?: string;
};

// ── Next.js API Route 設定 ───────────────────────────
export const config = {
  api: { bodyParser: false, sizeLimit: "4mb" },
};

// ── ルートハンドラ本体 ────────────────────────────────
export default async function uploadHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  /* (1) 認可チェック */
  const session = (await getServerSession(
    req,
    res,
    authOptions
  )) as ExtendedSession;

  if (!session?.accessToken)
    return res.status(401).end("Unauthorized (no token)");
  if (session.error === "RefreshAccessTokenError")
    return res.status(401).end("Token expired — please sign‑in again");

  let tmpPath: string | undefined;
  try {
    /* (2) multipart/form-data を解析 */
    const file: FormidableFile = await new Promise((resolve, reject) => {
      formidable({ allowEmptyFiles: true, maxFiles: 1 }).parse(
        req,
        (err, _fields, files) => {
          if (err) return reject(err);
          const f = Array.isArray(files.file) ? files.file[0] : files.file;
          if (!f) return reject(new Error("No file field"));
          tmpPath = f.filepath;
          resolve(f);
        }
      );
    });

    /* (3) Google Drive へアップロード */
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
    if (tmpPath) fs.unlink(tmpPath).catch(() => null);
  }
}