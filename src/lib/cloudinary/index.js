/**
 * Cloudinary server-side utilities — server-only.
 * Never import in client components. API secret must stay server-side.
 *
 * Uses the cloudinary v2 SDK for signed upload signature generation
 * and server-side asset verification.
 */
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

/**
 * Generate a signed upload signature for direct browser upload.
 * The signature authorises one upload to a specific folder/purpose.
 *
 * @param {object} params
 * @param {string} params.folder       - Cloudinary folder path (e.g. "village-finance/customer-photos")
 * @param {string} params.publicId     - Pre-generated unique public ID
 * @returns {{ signature: string, timestamp: number, apiKey: string, cloudName: string, folder: string, publicId: string }}
 */
export function generateUploadSignature({ folder, publicId }) {
  const timestamp = Math.round(Date.now() / 1000);

  // Sign only the exact parameters that the client submits in the FormData payload
  const paramsToSign = {
    folder,
    public_id: publicId,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
    publicId,
  };
}

/**
 * Verify a completed upload's metadata against expected constraints.
 * Call after the browser reports a successful upload before saving to DB.
 *
 * @param {object} params
 * @param {string} params.publicId
 * @param {string} params.expectedFolder
 * @param {string[]} params.allowedFormats
 * @param {number}  params.maxBytes
 * @returns {Promise<object>} Cloudinary asset resource
 * @throws if asset fails any constraint
 */
export async function verifyUploadedAsset({ publicId, expectedFolder, allowedFormats, maxBytes }) {
  const resource = await cloudinary.api.resource(publicId, {
    resource_type: 'image',
  });

  if (!resource.public_id.startsWith(expectedFolder)) {
    throw new Error('Upload folder mismatch — asset rejected.');
  }
  if (allowedFormats && !allowedFormats.includes(resource.format)) {
    throw new Error(`Disallowed format: ${resource.format}`);
  }
  if (maxBytes && resource.bytes > maxBytes) {
    throw new Error(`File exceeds size limit: ${resource.bytes} bytes`);
  }

  return resource;
}
