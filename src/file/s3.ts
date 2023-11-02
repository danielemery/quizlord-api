import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { S3RequestPresigner } from '@aws-sdk/s3-request-presigner';
import { createRequest } from '@aws-sdk/util-create-request';
import { formatUrl } from '@aws-sdk/util-format-url';

import config from '../config/config';

const s3Client = new S3Client({ region: config.AWS_REGION });

export async function generateSignedUploadUrl(key: string): Promise<string> {
  const request = await createRequest(
    s3Client,
    new PutObjectCommand({
      Key: key,
      Bucket: config.AWS_BUCKET_NAME,
    }),
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
  return `${config.FILE_ACCESS_BASE_URL}/${key}`;
}

export function createKey(resourceId: string, fileName: string) {
  return `${resourceId}/${fileName}`;
}
