import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class S3FileService {
  #s3Client: S3Client;
  #fileAccessBaseUrl: string;
  #bucketName: string;

  constructor(region: string, bucketName: string, fileAccessBaseUrl: string) {
    this.#s3Client = new S3Client({ region: region });
    this.#fileAccessBaseUrl = fileAccessBaseUrl;
    this.#bucketName = bucketName;
  }

  async generateSignedUploadUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.#s3Client,
      new PutObjectCommand({
        Key: key,
        Bucket: this.#bucketName,
      }),
      { expiresIn: 3600 },
    );
  }

  keyToUrl(key: string): string {
    return `${this.#fileAccessBaseUrl}/${key}`;
  }

  createKey(resourceId: string, fileName: string) {
    return `${resourceId}/${fileName}`;
  }
}
