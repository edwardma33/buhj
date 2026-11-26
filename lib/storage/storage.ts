import "server-only"

import { S3Client } from "@aws-sdk/client-s3"

export const storage = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
})

export const storageBucket = process.env.S3_BUCKET!
