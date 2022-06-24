import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export async function generateSignedUploadUrl(
  fileId: string,
  fileName: string
): Promise<{ uploadLink: string; fileKey: string }> {
  const key = `${fileId}/${fileName}`;
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: "BODY",
  });
  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600,
  });
  return { uploadLink: signedUrl, fileKey: key };
}
