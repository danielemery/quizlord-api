import { createRequest } from "@aws-sdk/util-create-request";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { formatUrl } from "@aws-sdk/util-format-url";

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export async function generateSignedUploadUrl(key: string): Promise<string> {
  const request = await createRequest(
    s3Client,
    new PutObjectCommand({
      Key: key,
      Bucket: process.env.AWS_BUCKET_NAME,
    })
  );

  const signer = new S3RequestPresigner({
    ...s3Client.config,
  });

  const url = await signer.presign(request, {
    expiresIn: 3600,
  });
  return formatUrl(url);
}

export function keyToUrl(key: string): string {
  return `https://quizlord-dev-uploads.demery.net/${key}`;
}

export function createKey(resourceId: string, fileName: string) {
  return `${resourceId}/${fileName}`;
}
