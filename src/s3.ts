import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export async function generateSignedUploadUrl(key: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: "BODY",
  });
  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600,
  });
  return signedUrl;
}

export function keyToUrl(key: string): string {
  return `https://quizlord-images.demery.net/${key}`;
}

export function createKey(resourceId: string, fileName: string) {
  return `${resourceId}/${fileName}`;
}
