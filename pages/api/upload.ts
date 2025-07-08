// pages/api/upload.ts
//--------------------------------------------------------------
// Google Drive にファイルをアップロードする Next.js API Route
//   - Next.js 15 / Node 22 で確認
//   - Formidable v3 を利用（0 byte も許可）
//   - Vercel Functions の制限に合わせて 4 MB 強まで
//--------------------------------------------------------------

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

import formidable, { File as FormidableFile } from 'formidable';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { google } from 'googleapis';

/* -------- Next.js API Route の設定 -------- */
export const config = {
  api: {
    bodyParser: false,          // multipart は自前で解析
    sizeLimit: '4mb',           // Vercel 上限 4.5 MB 未満に
  },
};

/* -------- ハンドラー本体 -------- */
async function uploadHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  /* (1) 認可チェック */
  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).end('Unauthorized');

  /* 一時ファイルのパスを保持して finally で削除するための変数 */
  let tempFilePath: string | undefined;

  try {
    /* (2) multipart/form-data を解析 */
    const file: FormidableFile = await new Promise((resolve, reject) => {
      formidable({
        allowEmptyFiles: true,  // 0 byte を許可
        minFileSize: 0,
        maxFiles: 1,
      }).parse(req, (err, _fields, files) => {
        if (err) return reject(err);
        const f = Array.isArray(files.file) ? files.file[0] : files.file;
        if (!f) return reject(new Error('No file field'));
        tempFilePath = f.filepath;      // finally 用に保存
        return resolve(f);
      });
    });

    console.info('[upload] received', {
      name: file.originalFilename,
      size: file.size,
      type: file.mimetype,
    });

    /* (3) Google Drive へアップロード */
    const oauth = new google.auth.OAuth2();
    oauth.setCredentials({ access_token: session.accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth });
    const isEmpty = file.size === 0;     // 0 byte なら metadata-only

    const driveRes = await drive.files.create({
      requestBody: {
        name: file.originalFilename ?? 'untitled',
        mimeType: file.mimetype ?? 'application/octet-stream',
      },
      ...(isEmpty
        ? {}                                  // metadata-only
        : {
            media: {
              mimeType: file.mimetype ?? undefined,
              body: createReadStream(file.filepath),
            },
          }),
      fields: 'id',
    });

    /* (4) 正常終了 */
    return res.status(200).json({ fileId: driveRes.data.id });
  } catch (err) {
    console.error('[upload] error', err);
    return res.status(500).json({ error: 'Upload failed' });
  } finally {
    /* (5) 一時ファイルを削除 */
    if (tempFilePath) {
      fs.unlink(tempFilePath).catch(() => null); // エラーは無視
    }
  }
}

/* 名前付き関数を default export → import/no-anonymous-default-export 回避 */
export default uploadHandler;