import { Request, Response, NextFunction } from "express";
import multer, { MulterError } from "multer";
import { AppError } from "../errors/app.error";

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new AppError("Invalid file type. Allowed formats: PDF, JPG, PNG, DOC, DOCX", 400));
    }
    cb(null, true);
  },
});

export const uploadSingleFile = (fieldName: string) => {
  const uploadMiddleware = upload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction): void => {
    uploadMiddleware(req, res, (err: any) => {
      if (err) {
        if (err instanceof MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return next(new AppError("File size exceeds the 10MB limit", 400));
          }
          return next(new AppError(err.message, 400));
        }
        return next(err);
      }
      next();
    });
  };
};
