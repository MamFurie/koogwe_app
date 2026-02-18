-- AlterTable: Add driver verification fields to DriverProfile
ALTER TABLE "DriverProfile" ADD COLUMN "faceVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DriverProfile" ADD COLUMN "faceVerifiedAt" TIMESTAMP(3);
ALTER TABLE "DriverProfile" ADD COLUMN "documentsUploaded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DriverProfile" ADD COLUMN "documentsUploadedAt" TIMESTAMP(3);
ALTER TABLE "DriverProfile" ADD COLUMN "adminApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DriverProfile" ADD COLUMN "adminApprovedAt" TIMESTAMP(3);
ALTER TABLE "DriverProfile" ADD COLUMN "adminNotes" TEXT;
