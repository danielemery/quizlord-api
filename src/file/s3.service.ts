import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { S3RequestPresigner } from '@aws-sdk/s3-request-presigner';
import { createRequest } from '@aws-sdk/util-create-request';
import { formatUrl } from '@aws-sdk/util-format-url';

import config from '../config/config';

export class S3FileService {
  #s3Client: S3Client;
  constructor() {
    this.#s3Client = new S3Client({ region: config.AWS_REGION });
  }

  async generateSignedUploadUrl(key: string): Promise<string> {
    const request = await createRequest(
      this.#s3Client,
      new PutObjectCommand({
        Key: key,
        Bucket: config.AWS_BUCKET_NAME,
      }),
    );

    const signer = new S3RequestPresigner({
      ...this.#s3Client.config,
    });

    const url = await signer.presign(request, {
      expiresIn: 3600,
    });
    return formatUrl(url);
  }

  keyToUrl(key: string): string {
    return `${config.FILE_ACCESS_BASE_URL}/${key}`;
  }

  createKey(resourceId: string, fileName: string) {
    return `${resourceId}/${fileName}`;
  }
}
