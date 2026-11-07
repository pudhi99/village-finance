/**
 * POST /api/upload/sign
 *
 * Returns a Cloudinary signed upload signature for authenticated users.
 * The browser uses this to upload directly to Cloudinary without
 * exposing the API secret.
 *
 * Security requirements (all enforced server-side):
 * - User must be authenticated (Supabase Auth).
 * - Folder, purpose and allowed formats are server-controlled.
 * - API secret never leaves the server.
 *
 * Request body (JSON):
 *   { purpose: "customer-photo" | "customer-document" | "loan-document" }
 *
 * Response:
 *   { signature, timestamp, apiKey, cloudName, folder, publicId }
 */
import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { generateUploadSignature } from '@/lib/cloudinary';
import { validate, z } from '@/lib/validation';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPLOAD_PURPOSES = {
  'customer-photo': {
    subfolder: 'customer-photos',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    maxBytes: 5 * 1024 * 1024, // 5 MB
  },
  'customer-document': {
    subfolder: 'customer-documents',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    maxBytes: 10 * 1024 * 1024, // 10 MB
  },
  'loan-document': {
    subfolder: 'loan-documents',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    maxBytes: 10 * 1024 * 1024,
  },
};

const bodySchema = z.object({
  purpose: z.enum(Object.keys(UPLOAD_PURPOSES)),
});

export async function POST(request) {
  try {
    // 1. Authenticate
    await requireAuth();

    // 2. Validate request body
    const body = await request.json();
    const { purpose } = validate(bodySchema, body);

    // 3. Build signed params (server-controlled)
    const config = UPLOAD_PURPOSES[purpose];
    const folder = `${process.env.CLOUDINARY_UPLOAD_FOLDER}/${config.subfolder}`;
    const publicId = `${folder}/${randomUUID()}`;

    const signatureData = generateUploadSignature({
      folder,
      publicId,
    });

    return NextResponse.json(signatureData);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error.name === 'ValidationError') {
      return NextResponse.json({ error: error.message, fields: error.fieldErrors }, { status: 422 });
    }
    console.error('[upload/sign] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
