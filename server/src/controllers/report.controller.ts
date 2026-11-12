
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";

import { prisma } from "../config/prisma.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";

// GET /api/reports/categories
// Return active categories available for citizen reports.
export async function getActiveCategories(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            isActive: true
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    });

    const availableCategories = categories
      .filter(
        (category) =>
          !category.department || category.department.isActive
      )
      .map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        department: category.department
          ? {
              id: category.department.id,
              name: category.department.name
            }
          : null
      }));

    res.status(200).json({
      count: availableCategories.length,
      categories: availableCategories
    });
  } catch (error) {
    console.error("Fetching report categories failed:", error);

    res.status(500).json({
      message: "Unable to retrieve report categories."
    });
  }
}

// POST /api/reports
// Submit a report on behalf of the authenticated citizen.
export async function submitReport(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const userId = authenticatedReq.user?.userId;

    if (!userId) {
      res.status(401).json({
        message: "Authentication required."
      });
      return;
    }

    const body = req.body as {
      title?: unknown;
      description?: unknown;
      location?: unknown;
      categoryId?: unknown;
      latitude?: unknown;
      longitude?: unknown;
    };

    if (
      typeof body.title !== "string" ||
      typeof body.description !== "string" ||
      typeof body.location !== "string" ||
      body.categoryId === undefined ||
      body.categoryId === null ||
      body.categoryId === ""
    ) {
      res.status(400).json({
        message:
          "Title, description, location and categoryId are required."
      });
      return;
    }

    const title = body.title.trim();
    const description = body.description.trim();
    const location = body.location.trim();
    const categoryId = Number(body.categoryId);

    if (!title || title.length > 200) {
      res.status(400).json({
        message: "Title must contain between 1 and 200 characters."
      });
      return;
    }

    if (!description || description.length > 20000) {
      res.status(400).json({
        message:
          "Description must contain between 1 and 20,000 characters."
      });
      return;
    }

    if (!location || location.length > 255) {
      res.status(400).json({
        message: "Location must contain between 1 and 255 characters."
      });
      return;
    }

    if (!Number.isSafeInteger(categoryId) || categoryId < 1) {
      res.status(400).json({
        message: "categoryId must be a valid positive integer."
      });
      return;
    }

    const hasLatitude =
      body.latitude !== undefined &&
      body.latitude !== null &&
      body.latitude !== "";

    const hasLongitude =
      body.longitude !== undefined &&
      body.longitude !== null &&
      body.longitude !== "";

    if (hasLatitude !== hasLongitude) {
      res.status(400).json({
        message:
          "Provide both latitude and longitude, or omit both."
      });
      return;
    }

    let latitude: number | null = null;
    let longitude: number | null = null;

    if (hasLatitude && hasLongitude) {
      latitude = Number(body.latitude);
      longitude = Number(body.longitude);

      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        res.status(400).json({
          message: "Latitude or longitude is outside the valid range."
        });
        return;
      }
    }

    // Verify that the user still exists and has an active citizen account.
    const citizen = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        role: true,
        accountStatus: true
      }
    });

    if (!citizen || citizen.accountStatus !== "ACTIVE") {
      res.status(403).json({
        message: "Your account is not active."
      });
      return;
    }

    if (citizen.role !== "CITIZEN") {
      res.status(403).json({
        message: "Only citizen accounts can submit citizen reports."
      });
      return;
    }

    // Find the selected category and its assigned department.
    const category = await prisma.category.findUnique({
      where: {
        id: categoryId
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            isActive: true
          }
        }
      }
    });

    if (!category || !category.isActive) {
      res.status(400).json({
        message: "The selected category does not exist or is inactive."
      });
      return;
    }

    if (category.department && !category.department.isActive) {
      res.status(409).json({
        message:
          "The department assigned to this category is inactive."
      });
      return;
    }

    // Generate a unique, human-readable report reference.
    const referenceNumber =
      `CC-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;

    // Save the report, initial update and audit record atomically.
    const report = await prisma.$transaction(async (tx) => {
      const createdReport = await tx.report.create({
        data: {
          referenceNumber,
          title,
          description,
          location,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
          status: "SUBMITTED",
          citizenId: citizen.id,
          categoryId: category.id,
          departmentId: category.department?.id ?? null
        },
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          description: true,
          location: true,
          latitude: true,
          longitude: true,
          status: true,
          createdAt: true,
          category: {
            select: {
              id: true,
              name: true
            }
          },
          department: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      await tx.reportUpdate.create({
        data: {
          reportId: createdReport.id,
          userId: citizen.id,
          status: "SUBMITTED",
          comment: "Report submitted by citizen.",
          isPublic: true
        }
      });

      await tx.auditLog.create({
        data: {
          userId: citizen.id,
          action: "REPORT_SUBMITTED",
          entityType: "REPORT",
          entityId: String(createdReport.id),
          details: JSON.stringify({
            referenceNumber,
            categoryId: category.id,
            departmentId: category.department?.id ?? null
          }),
          ipAddress: req.ip ?? null
        }
      });

      return createdReport;
    });

    res.status(201).json({
      message: "Report submitted successfully.",
      report
    });
  } catch (error) {
    console.error("Report submission failed:", error);

    res.status(500).json({
      message: "Unable to submit your report. Please try again."
    });
  }
}
// GET /api/reports
// Return reports belonging only to the authenticated citizen.
export async function getMyReports(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const userId = authenticatedReq.user?.userId;

    if (!userId) {
      res.status(401).json({
        message: "Authentication required."
      });
      return;
    }

    // Confirm the account is active and belongs to a citizen.
    const citizen = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        accountStatus: true
      }
    });

    if (!citizen || citizen.accountStatus !== "ACTIVE") {
      res.status(403).json({
        message: "Your account is not active."
      });
      return;
    }

    if (citizen.role !== "CITIZEN") {
      res.status(403).json({
        message: "Only citizen accounts can access this report list."
      });
      return;
    }

    const reports = await prisma.report.findMany({
      where: {
        citizenId: citizen.id
      },
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        description: true,
        location: true,
        status: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json(reports);
  } catch (error) {
    console.error("Fetching citizen reports failed:", error);

    res.status(500).json({
      message: "Unable to retrieve your reports."
    });
  }
}

 // GET /api/reports/:id
 // Return details only when the authenticated citizen owns the report.
export async function getReportDetails(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const userId = authenticatedReq.user?.userId;
    const reportId = Number(req.params.id);

    if (!userId) {
      res.status(401).json({
        message: "Authentication required."
      });
      return;
    }

    if (!Number.isSafeInteger(reportId) || reportId < 1) {
      res.status(400).json({
        message: "Invalid report ID."
      });
      return;
    }

    const citizen = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        accountStatus: true
      }
    });

    if (
      !citizen ||
      citizen.accountStatus !== "ACTIVE" ||
      citizen.role !== "CITIZEN"
    ) {
      res.status(403).json({
        message: "An active citizen account is required."
      });
      return;
    }

    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        citizenId: citizen.id
      },
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        description: true,
        location: true,
        latitude: true,
        longitude: true,
        status: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        },
        updates: {
          where: {
            isPublic: true
          },
          select: {
            id: true,
            status: true,
            comment: true,
            createdAt: true
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!report) {
      res.status(404).json({
        message: "Report not found."
      });
      return;
    }

    res.status(200).json({
      ...report,
      submittedAt: report.createdAt
    });
  } catch (error) {
    console.error("Fetching report details failed:", error);

    res.status(500).json({
      message: "Unable to retrieve report details."
    });
  }
}

/**
 * GET /api/reports/track/:referenceNumber
 * Find a report by reference number for the authenticated citizen.
 */
export async function trackReportByReference(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const userId = authenticatedReq.user?.userId;
    const referenceNumber = String(req.params.referenceNumber ?? "").trim();

    if (!userId) {
      res.status(401).json({
        message: "Authentication required.",
      });
      return;
    }

    if (!referenceNumber) {
      res.status(400).json({
        message: "A report reference number is required.",
      });
      return;
    }

    const citizen = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        accountStatus: true,
      },
    });

    if (
      !citizen ||
      citizen.accountStatus !== "ACTIVE" ||
      citizen.role !== "CITIZEN"
    ) {
      res.status(403).json({
        message: "An active citizen account is required.",
      });
      return;
    }

    const report = await prisma.report.findFirst({
      where: {
        referenceNumber: {
          equals: referenceNumber,
        },
        citizenId: citizen.id,
      },
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        description: true,
        location: true,
        status: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        updates: {
          where: { isPublic: true },
          select: {
            id: true,
            status: true,
            comment: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!report) {
      res.status(404).json({
        message: "No report found with that reference number.",
      });
      return;
    }

    res.status(200).json({
      ...report,
      submittedAt: report.createdAt,
    });
  } catch (error) {
    console.error("Tracking report by reference failed:", error);

    res.status(500).json({
      message: "Unable to track this report right now.",
    });
  }
}
