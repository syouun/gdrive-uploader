import formidable from 'formidable';
import fs from 'fs';
import { google } from 'googleapis';

/* --- Next.js API config --- */
export const config = {
  api: { bodyParser: false, sizeLimit: '4mb' },
};

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  /* 1) OAuth アクセストークンは省略 … */

  /* 2) Form 解析（空ファイル許可） */
  const files = await new Promise<formidable.Files>((ok, ng) =>
    formidable({ allowEmptyFiles: true, minFileSize: 0, maxFiles: 1 }).parse(
      req,
      (err, _f, f) => (err ? ng(err) : ok(f)),
    ),
  );

  const uploaded: any = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!uploaded) return res.status(400).json({ error: 'No file field' });

  /* 3) Drive へアップロード */
  try {
    const oauth = new google.auth.OAuth2();
    oauth.setCredentials({ access_token: session.accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth });

    const isEmpty = uploaded.size === 0;
    const driveRes = await drive.files.create({
      requestBody: {
        name: uploaded.originalFilename || 'empty',
        mimeType: uploaded.mimetype || 'application/octet-stream',
      },
      ...(isEmpty
        ? {} // 0 byte ⇒ metadata-only
        : {
            media: {
              mimeType: uploaded.mimetype,
              body: fs.createReadStream(uploaded.filepath),
            },
          }),
      fields: 'id',
    });

    return res.status(200).json({ fileId: driveRes.data.id });
  } catch (err) {
    console.error('upload error', err);
    return res.status(500).json({ error: 'Upload failed' });
  } finally {
    fs.unlink(uploaded.filepath, () => {});
  }
};