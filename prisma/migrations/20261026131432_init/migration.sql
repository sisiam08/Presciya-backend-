-- Enable pg_trgm extension for trigram similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('USER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'CHAMBER', 'INSTITUTION');

-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('HOSPITAL', 'CLINIC');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('NORMAL', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "AppointmentPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FREE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'DOCTOR', 'MANAGER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('PERSONAL', 'INSTITUTION');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ContactLabel" AS ENUM ('DEFAULT', 'RECEPTION', 'EMERGENCY', 'AMBULANCE', 'MANAGER', 'DOCTOR', 'PATIENT', 'PHARMACY', 'LAB', 'ASSISTANT', 'OTHER');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FinancialTransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MedicineInstructionType" AS ENUM ('DAILY', 'TOPICAL', 'WEEKLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MealTiming" AS ENUM ('BEFORE_MEAL', 'AFTER_MEAL', 'WITH_MEAL', 'AFTER_FULL_MEAL', 'EMPTY_STOMACH', 'ANYTIME');

-- CreateEnum
CREATE TYPE "PrescriptionLanguage" AS ENUM ('ENGLISH', 'BANGLA');

-- CreateEnum
CREATE TYPE "PrescriptionDesignTemplate" AS ENUM ('DEFAULT', 'MODERN_CLINICAL', 'MINIMAL_PROFESSIONAL', 'MODERN_MEDICAL', 'ELEGANT_COMPACT');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RUNNING', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "LoginStatus" AS ENUM ('SUCCESS', 'FAILED', 'SUSPICIOUS');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'VERIFY', 'REJECT', 'ACCEPT', 'ACCEPT_INVITE', 'REJECT_INVITE', 'CANCEL', 'INVITE', 'STATUS_CHANGE', 'SUSPEND', 'RESTORE', 'SUBSCRIPTION_CHANGE', 'PRINT', 'EXPORT', 'DOWNLOAD', 'CHANGE', 'REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "OnboardingState" AS ENUM ('PROFILE_SETUP', 'VERIFICATION_SUBMITTED', 'VERIFICATION_APPROVED', 'READY');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('USER', 'WORKSPACE', 'MEMBERSHIP', 'INVITATION', 'PATIENT', 'PRESCRIPTION', 'CHAMBER', 'APPOINTMENT', 'SUBSCRIPTION', 'PAYMENT', 'INVOICE', 'VERIFICATION', 'SYSTEM', 'FINANCIAL_TRANSACTION', 'FINANCIAL_CATEGORY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER', 'MOBILE_BANKING', 'CASH', 'CHEQUE', 'ONLINE_GATEWAY');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPOINTMENT', 'PRESCRIPTION', 'PAYMENT', 'SYSTEM', 'USER_ACTION', 'VERIFICATION', 'INVITATION', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "systemRole" "SystemRole" NOT NULL DEFAULT 'USER',
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "onboardingState" "OnboardingState" NOT NULL DEFAULT 'PROFILE_SETUP',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bmdcNumber" TEXT,
    "specialization" TEXT,
    "qualifications" TEXT,
    "designation" TEXT,
    "signatureUrl" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationType" "VerificationType" NOT NULL DEFAULT 'PERSONAL',
    "prescriptionLanguage" "PrescriptionLanguage" NOT NULL DEFAULT 'ENGLISH',
    "prescriptionTemplate" "PrescriptionDesignTemplate" NOT NULL DEFAULT 'DEFAULT',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradeLicenseNo" TEXT,
    "website" TEXT,
    "description" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "fontFamily" TEXT,
    "headerTemplate" TEXT,
    "footerTemplate" TEXT,
    "showLogo" BOOLEAN,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL,
    "institutionType" "InstitutionType",
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "slogan" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "templateConfig" JSONB,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "permissions" JSONB,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_numbers" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "chamberId" TEXT,
    "label" "ContactLabel" NOT NULL,
    "phone" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contact_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "departmentId" TEXT,
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chamber" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "footerText" TEXT,
    "visitingHours" JSONB,
    "templateConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chamber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicines" (
    "id" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "dosageForm" TEXT NOT NULL,
    "generic" TEXT NOT NULL,
    "strength" TEXT,
    "manufacturer" TEXT,

    CONSTRAINT "medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "chamberId" TEXT,
    "doctorId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "Gender" NOT NULL,
    "weight" DOUBLE PRECISION,
    "phone" TEXT,
    "address" TEXT,
    "bloodGroup" TEXT,
    "allergies" TEXT,
    "chronicDiseases" TEXT,
    "emergencyContact" TEXT,
    "patientNotes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "chamberId" TEXT,
    "doctorUserId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "userId" TEXT,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "serialNumber" TEXT,
    "verificationCode" TEXT,
    "language" "PrescriptionLanguage" NOT NULL DEFAULT 'ENGLISH',
    "template" "PrescriptionDesignTemplate" NOT NULL DEFAULT 'DEFAULT',
    "renderSnapshot" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "complaints" TEXT,
    "diagnosis" TEXT,
    "clinicalNotes" TEXT,
    "advises" TEXT,
    "history" TEXT,
    "examRespiratoryRate" TEXT,
    "examLungs" TEXT,
    "examHeart" TEXT,
    "examAnaemia" TEXT,
    "examCyanosis" TEXT,
    "examOedema" TEXT,
    "examDehydration" TEXT,
    "examOthers" TEXT,
    "nextVisitDate" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_categories" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "prescriptionId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_visiting_fees" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "chamberId" TEXT,
    "visitingFee" DECIMAL(12,2) NOT NULL,
    "followUpFee" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_visiting_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_share_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "doctorId" TEXT,
    "percentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_share_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "doctorUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "complaints" TEXT,
    "advises" TEXT,
    "medicinesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_observations" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloodPressure" TEXT,
    "pulse" INTEGER,
    "temperature" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "height" TEXT,
    "respiratoryRate" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_variants" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "variantName" TEXT NOT NULL,
    "description" JSONB NOT NULL,
    "dailyPrescriptionLimit" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "subscriptionVariantId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    "voucherCode" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "discountPercentage" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CARD',
    "transactionId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'signup',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_histories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" "LoginStatus" NOT NULL DEFAULT 'SUCCESS',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_doctors" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_assignments" (
    "id" TEXT NOT NULL,
    "institutionDoctorId" TEXT NOT NULL,
    "chamberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "submittedData" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chamber_schedules" (
    "id" TEXT NOT NULL,
    "chamberId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "maxSerials" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chamber_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "chamberId" TEXT,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "serialNo" INTEGER NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "cancelReason" TEXT,
    "notes" TEXT,
    "appointmentType" "AppointmentType" NOT NULL DEFAULT 'NORMAL',
    "visitingFee" DECIMAL(12,2),
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payableAmount" DECIMAL(12,2),
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentStatus" "AppointmentPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod",
    "paidAt" TIMESTAMP(3),
    "revenueSharePercent" DECIMAL(5,2),
    "hospitalShareAmount" DECIMAL(12,2),
    "doctorShareAmount" DECIMAL(12,2),
    "followUpOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_medicines" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "medicineId" TEXT,
    "snapshotBrandName" TEXT,
    "snapshotGeneric" TEXT,
    "snapshotStrength" TEXT,
    "snapshotType" TEXT,
    "usageType" "MedicineInstructionType" NOT NULL DEFAULT 'DAILY',
    "dosagePattern" TEXT,
    "frequency" TEXT,
    "intervalDays" INTEGER,
    "duration" TEXT NOT NULL,
    "mealTiming" "MealTiming",
    "instruction" TEXT,
    "notes" TEXT,
    "quantity" INTEGER,
    "dose" TEXT,
    "frequencyMorning" INTEGER,
    "frequencyNoon" INTEGER,
    "frequencyNight" INTEGER,
    "durationValue" INTEGER,
    "durationUnit" TEXT,
    "applicationAmount" TEXT,
    "applicationArea" TEXT,
    "applicationFrequency" TEXT,
    "specificDays" TEXT,
    "customScheduleJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_investigations" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_investigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_pdf_versions" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_pdf_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_print_logs" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "printedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_print_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_favorite_medicines" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "frequencyCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_favorite_medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_subscriptions" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "subscriptionVariantId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "institutionSubscriptionId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "notes" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "sentStatus" TEXT NOT NULL,
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role" "WorkspaceRole" NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role","permissionId")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("userId","permissionId")
);

-- CreateTable
CREATE TABLE "features" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "isEnabledGlobally" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "limitValue" INTEGER,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_tracking" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "workspaceId" TEXT,
    "actionType" "AuditActionType" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_userId_key" ON "institutions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_idx" ON "Membership"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "contact_numbers_userId_idx" ON "contact_numbers"("userId");

-- CreateIndex
CREATE INDEX "contact_numbers_chamberId_idx" ON "contact_numbers"("chamberId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_workspaceId_idx" ON "Invitation"("workspaceId");

-- CreateIndex
CREATE INDEX "Invitation_invitedById_idx" ON "Invitation"("invitedById");

-- CreateIndex
CREATE INDEX "Chamber_workspaceId_idx" ON "Chamber"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "medicines_slug_key" ON "medicines"("slug");

-- CreateIndex
CREATE INDEX "medicines_slug_idx" ON "medicines"("slug");

-- CreateIndex
CREATE INDEX "medicine_brand_trgm_idx" ON "medicines" USING GIN ("brandName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "medicine_generic_trgm_idx" ON "medicines" USING GIN ("generic" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patients_workspaceId_idx" ON "patients"("workspaceId");

-- CreateIndex
CREATE INDEX "patients_doctorId_idx" ON "patients"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_verificationCode_key" ON "Prescription"("verificationCode");

-- CreateIndex
CREATE INDEX "Prescription_workspaceId_idx" ON "Prescription"("workspaceId");

-- CreateIndex
CREATE INDEX "Prescription_chamberId_idx" ON "Prescription"("chamberId");

-- CreateIndex
CREATE INDEX "Prescription_doctorUserId_idx" ON "Prescription"("doctorUserId");

-- CreateIndex
CREATE INDEX "Prescription_patientId_idx" ON "Prescription"("patientId");

-- CreateIndex
CREATE INDEX "Prescription_supersedesId_idx" ON "Prescription"("supersedesId");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_serialNumber_key" ON "Prescription"("serialNumber");

-- CreateIndex
CREATE INDEX "financial_categories_workspaceId_idx" ON "financial_categories"("workspaceId");

-- CreateIndex
CREATE INDEX "financial_categories_type_idx" ON "financial_categories"("type");

-- CreateIndex
CREATE UNIQUE INDEX "financial_categories_workspaceId_name_type_key" ON "financial_categories"("workspaceId", "name", "type");

-- CreateIndex
CREATE INDEX "financial_transactions_workspaceId_idx" ON "financial_transactions"("workspaceId");

-- CreateIndex
CREATE INDEX "financial_transactions_transactionDate_idx" ON "financial_transactions"("transactionDate");

-- CreateIndex
CREATE INDEX "financial_transactions_type_idx" ON "financial_transactions"("type");

-- CreateIndex
CREATE INDEX "financial_transactions_categoryId_idx" ON "financial_transactions"("categoryId");

-- CreateIndex
CREATE INDEX "financial_transactions_workspaceId_transactionDate_idx" ON "financial_transactions"("workspaceId", "transactionDate");

-- CreateIndex
CREATE INDEX "financial_transactions_workspaceId_type_transactionDate_idx" ON "financial_transactions"("workspaceId", "type", "transactionDate");

-- CreateIndex
CREATE INDEX "doctor_visiting_fees_workspaceId_idx" ON "doctor_visiting_fees"("workspaceId");

-- CreateIndex
CREATE INDEX "doctor_visiting_fees_chamberId_idx" ON "doctor_visiting_fees"("chamberId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_visiting_fees_doctorId_chamberId_key" ON "doctor_visiting_fees"("doctorId", "chamberId");

-- CreateIndex
CREATE INDEX "revenue_share_configs_workspaceId_idx" ON "revenue_share_configs"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_share_configs_workspaceId_doctorId_key" ON "revenue_share_configs"("workspaceId", "doctorId");

-- CreateIndex
CREATE INDEX "prescription_templates_workspaceId_idx" ON "prescription_templates"("workspaceId");

-- CreateIndex
CREATE INDEX "prescription_templates_doctorUserId_idx" ON "prescription_templates"("doctorUserId");

-- CreateIndex
CREATE INDEX "clinical_observations_prescriptionId_idx" ON "clinical_observations"("prescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_variants_key_key" ON "subscription_variants"("key");

-- CreateIndex
CREATE INDEX "subscriptions_workspaceId_idx" ON "subscriptions"("workspaceId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_subscriptionVariantId_idx" ON "subscriptions"("subscriptionVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE INDEX "payments_subscriptionId_idx" ON "payments"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "otps_email_key" ON "otps"("email");

-- CreateIndex
CREATE INDEX "otps_email_idx" ON "otps"("email");

-- CreateIndex
CREATE INDEX "otps_expiresAt_idx" ON "otps"("expiresAt");

-- CreateIndex
CREATE INDEX "login_histories_userId_idx" ON "login_histories"("userId");

-- CreateIndex
CREATE INDEX "login_histories_createdAt_idx" ON "login_histories"("createdAt");

-- CreateIndex
CREATE INDEX "departments_institutionId_idx" ON "departments"("institutionId");

-- CreateIndex
CREATE INDEX "institution_doctors_doctorId_idx" ON "institution_doctors"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "institution_doctors_institutionId_doctorId_key" ON "institution_doctors"("institutionId", "doctorId");

-- CreateIndex
CREATE INDEX "doctor_assignments_chamberId_idx" ON "doctor_assignments"("chamberId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_assignments_institutionDoctorId_chamberId_key" ON "doctor_assignments"("institutionDoctorId", "chamberId");

-- CreateIndex
CREATE INDEX "VerificationRequest_userId_idx" ON "VerificationRequest"("userId");

-- CreateIndex
CREATE INDEX "VerificationRequest_workspaceId_idx" ON "VerificationRequest"("workspaceId");

-- CreateIndex
CREATE INDEX "VerificationRequest_reviewedById_idx" ON "VerificationRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "chamber_schedules_chamberId_idx" ON "chamber_schedules"("chamberId");

-- CreateIndex
CREATE INDEX "appointments_workspaceId_idx" ON "appointments"("workspaceId");

-- CreateIndex
CREATE INDEX "appointments_chamberId_idx" ON "appointments"("chamberId");

-- CreateIndex
CREATE INDEX "appointments_doctorId_idx" ON "appointments"("doctorId");

-- CreateIndex
CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");

-- CreateIndex
CREATE INDEX "appointments_appointmentDate_idx" ON "appointments"("appointmentDate");

-- CreateIndex
CREATE INDEX "appointments_paymentStatus_idx" ON "appointments"("paymentStatus");

-- CreateIndex
CREATE INDEX "appointments_followUpOfId_idx" ON "appointments"("followUpOfId");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_chamberId_appointmentDate_serialNo_key" ON "appointments"("chamberId", "appointmentDate", "serialNo");

-- CreateIndex
CREATE INDEX "prescription_medicines_prescriptionId_idx" ON "prescription_medicines"("prescriptionId");

-- CreateIndex
CREATE INDEX "prescription_medicines_medicineId_idx" ON "prescription_medicines"("medicineId");

-- CreateIndex
CREATE INDEX "prescription_investigations_prescriptionId_idx" ON "prescription_investigations"("prescriptionId");

-- CreateIndex
CREATE INDEX "prescription_pdf_versions_prescriptionId_idx" ON "prescription_pdf_versions"("prescriptionId");

-- CreateIndex
CREATE INDEX "prescription_print_logs_prescriptionId_idx" ON "prescription_print_logs"("prescriptionId");

-- CreateIndex
CREATE INDEX "prescription_print_logs_userId_idx" ON "prescription_print_logs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_favorite_medicines_doctorId_medicineId_key" ON "doctor_favorite_medicines"("doctorId", "medicineId");

-- CreateIndex
CREATE INDEX "institution_subscriptions_institutionId_idx" ON "institution_subscriptions"("institutionId");

-- CreateIndex
CREATE INDEX "institution_subscriptions_subscriptionVariantId_idx" ON "institution_subscriptions"("subscriptionVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "features_key_key" ON "features"("key");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_featureId_key" ON "feature_flags"("featureId");

-- CreateIndex
CREATE INDEX "plan_features_variantId_idx" ON "plan_features"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_features_variantId_featureId_key" ON "plan_features"("variantId", "featureId");

-- CreateIndex
CREATE INDEX "usage_tracking_workspaceId_idx" ON "usage_tracking"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "usage_tracking_workspaceId_featureKey_key" ON "usage_tracking"("workspaceId", "featureKey");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_idx" ON "audit_logs"("workspaceId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_numbers" ADD CONSTRAINT "contact_numbers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_numbers" ADD CONSTRAINT "contact_numbers_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamber" ADD CONSTRAINT "Chamber_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET DEFAULT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorUserId_fkey" FOREIGN KEY ("doctorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_visiting_fees" ADD CONSTRAINT "doctor_visiting_fees_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_visiting_fees" ADD CONSTRAINT "doctor_visiting_fees_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_visiting_fees" ADD CONSTRAINT "doctor_visiting_fees_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_share_configs" ADD CONSTRAINT "revenue_share_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_share_configs" ADD CONSTRAINT "revenue_share_configs_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_templates" ADD CONSTRAINT "prescription_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_templates" ADD CONSTRAINT "prescription_templates_doctorUserId_fkey" FOREIGN KEY ("doctorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_observations" ADD CONSTRAINT "clinical_observations_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscriptionVariantId_fkey" FOREIGN KEY ("subscriptionVariantId") REFERENCES "subscription_variants"("id") ON DELETE SET DEFAULT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_voucherCode_fkey" FOREIGN KEY ("voucherCode") REFERENCES "vouchers"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_histories" ADD CONSTRAINT "login_histories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_doctors" ADD CONSTRAINT "institution_doctors_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_doctors" ADD CONSTRAINT "institution_doctors_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_doctors" ADD CONSTRAINT "institution_doctors_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_assignments" ADD CONSTRAINT "doctor_assignments_institutionDoctorId_fkey" FOREIGN KEY ("institutionDoctorId") REFERENCES "institution_doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_assignments" ADD CONSTRAINT "doctor_assignments_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamber_schedules" ADD CONSTRAINT "chamber_schedules_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_followUpOfId_fkey" FOREIGN KEY ("followUpOfId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_medicines" ADD CONSTRAINT "prescription_medicines_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_medicines" ADD CONSTRAINT "prescription_medicines_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_investigations" ADD CONSTRAINT "prescription_investigations_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_pdf_versions" ADD CONSTRAINT "prescription_pdf_versions_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_print_logs" ADD CONSTRAINT "prescription_print_logs_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_print_logs" ADD CONSTRAINT "prescription_print_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_favorite_medicines" ADD CONSTRAINT "doctor_favorite_medicines_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_favorite_medicines" ADD CONSTRAINT "doctor_favorite_medicines_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_subscriptions" ADD CONSTRAINT "institution_subscriptions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_subscriptions" ADD CONSTRAINT "institution_subscriptions_subscriptionVariantId_fkey" FOREIGN KEY ("subscriptionVariantId") REFERENCES "subscription_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_institutionSubscriptionId_fkey" FOREIGN KEY ("institutionSubscriptionId") REFERENCES "institution_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "features"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "subscription_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "features"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
