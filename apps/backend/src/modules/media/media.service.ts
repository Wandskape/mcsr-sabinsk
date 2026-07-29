import { randomUUID } from "node:crypto"

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { CoverUpload } from "@mcsr-sabinsk/shared"

const EXTENSIONS_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

@Injectable()
export class MediaService {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly publicBaseUrl: string
  private readonly makeBucketPublic: boolean

  constructor(@Inject(ConfigService) config: ConfigService) {
    const endpoint = config.getOrThrow<string>("S3_ENDPOINT").replace(/\/$/, "")
    this.bucket = config.getOrThrow<string>("S3_BUCKET")
    this.publicBaseUrl = (
      config.get<string>("S3_PUBLIC_BASE_URL") ?? `${endpoint}/${this.bucket}`
    ).replace(/\/$/, "")
    this.makeBucketPublic =
      config.get<string>("S3_ALLOW_PUBLIC_READ") !== "false"
    this.client = new S3Client({
      endpoint,
      region: config.getOrThrow<string>("S3_REGION"),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow<string>("S3_ACCESS_KEY"),
        secretAccessKey: config.getOrThrow<string>("S3_SECRET_KEY"),
      },
    })
  }

  async uploadCover(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Выберите файл обложки.")
    }
    const extension = EXTENSIONS_BY_MIME[file.mimetype]
    if (!extension) {
      throw new BadRequestException(
        "Поддерживаются только изображения JPEG, PNG и WebP."
      )
    }

    await this.ensureBucket()
    const objectKey = `covers/${randomUUID()}.${extension}`
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: file.buffer,
        ContentLength: file.size,
        ContentType: file.mimetype,
        CacheControl: "public, max-age=31536000, immutable",
      })
    )

    const upload: CoverUpload = {
      objectKey,
      publicUrl: this.publicUrlFor(objectKey),
    }
    return { data: upload }
  }

  async assertObjectExists(objectKey: string) {
    this.assertCoverKey(objectKey)
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        })
      )
    } catch {
      throw new NotFoundException("Загруженная обложка не найдена.")
    }
  }

  async downloadCover(objectKey: string) {
    this.assertCoverKey(objectKey)
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        })
      )
      if (!response.Body) {
        throw new Error("Empty S3 response body")
      }
      return {
        buffer: Buffer.from(await response.Body.transformToByteArray()),
        mimeType: response.ContentType ?? "application/octet-stream",
      }
    } catch {
      throw new NotFoundException("Обложка турнира не найдена в хранилище.")
    }
  }

  async storeImportedCover(input: {
    tournamentId: string
    extension: string
    mimeType: string
    buffer: Buffer
  }) {
    if (!/^[a-z0-9]+$/i.test(input.extension)) {
      throw new BadRequestException("Недопустимое расширение обложки.")
    }
    await this.ensureBucket()
    const objectKey = `covers/imported/${input.tournamentId}.${input.extension.toLowerCase()}`
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: input.buffer,
        ContentLength: input.buffer.length,
        ContentType: input.mimeType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    )
    return {
      objectKey,
      publicUrl: this.publicUrlFor(objectKey),
    }
  }

  async deleteImportedCover(objectKey: string) {
    if (!objectKey.startsWith("covers/imported/") || objectKey.includes("..")) {
      throw new BadRequestException(
        "Недопустимый ключ импортированной обложки."
      )
    }
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      })
    )
  }

  publicUrlFor(objectKey: string) {
    const encodedKey = objectKey
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")
    return `${this.publicBaseUrl}/${encodedKey}`
  }

  private async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
      } catch (error) {
        if (!this.isBucketAlreadyOwned(error)) {
          throw error
        }
      }
    }

    if (this.makeBucketPublic) {
      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Sid: "PublicReadCovers",
                Effect: "Allow",
                Principal: "*",
                Action: ["s3:GetObject"],
                Resource: [`arn:aws:s3:::${this.bucket}/covers/*`],
              },
            ],
          }),
        })
      )
    }
  }

  private assertCoverKey(objectKey: string) {
    if (!objectKey.startsWith("covers/") || objectKey.includes("..")) {
      throw new BadRequestException("Недопустимый ключ объекта.")
    }
  }

  private isBucketAlreadyOwned(error: unknown) {
    if (typeof error !== "object" || error === null) {
      return false
    }
    const name = "name" in error ? error.name : null
    return name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists"
  }
}
