
import { z } from 'zod'
import { SCHOOL_FILE_MAX_BYTES } from '@lms/shared'
import { AppError } from '../middleware/error.middleware'

export const schoolUpload = z.object({
  name: z.string().trim().min(1).max(180),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  base64: z.string().min(4).max(Math.ceil(SCHOOL_FILE_MAX_BYTES / 3) * 4).regex(/^[A-Za-z0-9+/]+={0,2}$/),
})

export function decodeSchoolFile(file: z.infer<typeof schoolUpload>) {
  const content = Buffer.from(file.base64, 'base64')
  const valid = file.mimeType === 'application/pdf' ? content.subarray(0, 5).toString() === '%PDF-'
    : file.mimeType === 'image/jpeg' ? content.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    : content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (!valid || content.length > SCHOOL_FILE_MAX_BYTES) {
    throw new AppError(400, 'Choose a PDF, JPEG, or PNG file no larger than 5 MB')
  }
  return { name: file.name, mimeType: file.mimeType, content, size: content.length }
}
