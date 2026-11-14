import enum
from datetime import datetime

from sqlalchemy import Numeric, Text
from extensions import db


class Role(str, enum.Enum):
    CITIZEN = "CITIZEN"
    OFFICER = "GOVERNMENT_OFFICER"
    ADMIN = "SYSTEM_ADMINISTRATOR"


class AccountStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


class ReportStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    AWAITING_INFORMATION = "AWAITING_INFORMATION"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    REJECTED = "REJECTED"


class PgType(str, enum.Enum):
    SUGGESTION = "SUGGESTION"
    COMPLAINT = "COMPLAINT"
    FEEDBACK = "FEEDBACK"
    CONCERN = "CONCERN"
    COMPLIMENT = "COMPLIMENT"
    OTHER = "OTHER"


class PgStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    RECEIVED = "RECEIVED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESPONSE_PROVIDED = "RESPONSE_PROVIDED"
    CLOSED = "CLOSED"


def _enum(enum_class):
    return db.Enum(enum_class, values_callable=lambda members: [item.value for item in members])


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(191), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(30), unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(_enum(Role), default=Role.CITIZEN, nullable=False, index=True)
    status = db.Column("account_status", _enum(AccountStatus), default=AccountStatus.ACTIVE,
                       nullable=False, index=True)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"))
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    department = db.relationship("Department", back_populates="officers")

    def public_dict(self):
        return {
            "id": self.id, "fullName": self.full_name, "email": self.email,
            "phone": self.phone, "role": {"GOVERNMENT_OFFICER": "OFFICER", "SYSTEM_ADMINISTRATOR": "ADMIN"}.get(self.role.value, self.role.value), "county": None,
            "location": None, "profileImage": None, "status": self.status.value,
            "departmentId": self.department_id,
        }


class Department(db.Model):
    __tablename__ = "departments"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.Text)
    contact_email = db.Column("email", db.String(191))
    contact_phone = db.Column("phone", db.String(30))
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    officers = db.relationship("User", back_populates="department")
    categories = db.relationship("Category", back_populates="department")

    @property
    def status(self):
        return AccountStatus.ACTIVE if self.is_active else AccountStatus.INACTIVE

    @status.setter
    def status(self, value):
        self.is_active = value in (AccountStatus.ACTIVE, AccountStatus.ACTIVE.value, True, 1)

    def public_dict(self):
        return {"id": self.id, "name": self.name, "description": self.description,
                "contactEmail": self.contact_email, "contactPhone": self.contact_phone,
                "status": self.status.value}


class Category(db.Model):
    __tablename__ = "categories"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.current_timestamp())

    department = db.relationship("Department", back_populates="categories")

    def public_dict(self):
        return {"id": self.id, "name": self.name, "description": self.description,
                "departmentId": self.department_id,
                "departmentName": self.department.name if self.department else None}


class Report(db.Model):
    __tablename__ = "reports"
    id = db.Column(db.Integer, primary_key=True)
    reference_number = db.Column(db.String(30), unique=True, nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    location = db.Column(db.String(255), nullable=False)
    latitude = db.Column(Numeric(10, 7))
    longitude = db.Column(Numeric(10, 7))
    status = db.Column(_enum(ReportStatus), default=ReportStatus.SUBMITTED, nullable=False, index=True)
    citizen_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False, index=True)
    assigned_officer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    rejection_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)

    citizen = db.relationship("User", foreign_keys=[citizen_id])
    officer = db.relationship("User", foreign_keys=[assigned_officer_id])
    category = db.relationship("Category")
    department = db.relationship("Department")
    attachments = db.relationship("ReportAttachment", backref="report", cascade="all, delete-orphan")
    updates = db.relationship("ReportUpdate", backref="report", cascade="all, delete-orphan",
                              order_by="ReportUpdate.created_at")

    @property
    def submitted_at(self):
        return self.created_at

    def public_dict(self, include_citizen=False):
        result = {
            "id": self.id, "referenceNumber": self.reference_number,
            "title": self.title, "description": self.description,
            "category": self.category.name if self.category else None,
            "categoryId": self.category_id,
            "department": self.department.name if self.department else None,
            "departmentId": self.department_id, "assignedOfficerId": self.assigned_officer_id,
            "county": None, "subCounty": None, "ward": None, "location": self.location,
            "latitude": float(self.latitude) if self.latitude is not None else None,
            "longitude": float(self.longitude) if self.longitude is not None else None,
            "status": self.status.value, "priority": None,
            "submittedAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "resolvedAt": self.resolved_at.isoformat() if self.resolved_at else None,
            "closedAt": None,
            "attachments": [item.public_dict() for item in self.attachments],
            "updates": [item.public_dict() for item in self.updates],
        }
        if include_citizen:
            result["citizenName"] = self.citizen.full_name if self.citizen else None
        return result


class ReportAttachment(db.Model):
    __tablename__ = "report_attachments"
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey("reports.id"), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_url = db.Column(db.String(500), nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    uploaded_at = db.Column(db.DateTime, nullable=False, server_default=db.func.current_timestamp())

    def public_dict(self):
        return {"id": self.id, "fileName": self.file_name, "fileUrl": self.file_url,
                "mimeType": self.mime_type, "fileType": self.mime_type, "fileSize": self.file_size}


class ReportUpdate(db.Model):
    __tablename__ = "report_updates"
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey("reports.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    status = db.Column(_enum(ReportStatus))
    comment = db.Column(db.Text, nullable=False)
    is_public = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.current_timestamp())

    def public_dict(self):
        return {"id": self.id, "status": self.status.value if self.status else None,
                "comment": self.comment, "actionTaken": None,
                "createdAt": self.created_at.isoformat() if self.created_at else None}


class PigeonholeCategory(db.Model):
    __tablename__ = "pigeonhole_categories"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(_enum(PgType), unique=True, nullable=False)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.current_timestamp())


class PigeonholeSubmission(db.Model):
    __tablename__ = "pigeonhole_submissions"
    id = db.Column(db.Integer, primary_key=True)
    reference_number = db.Column(db.String(30), unique=True, nullable=False, index=True)
    submission_type = db.Column("type", _enum(PgType), nullable=False)
    subject = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    anonymous_submission = db.Column("is_anonymous", db.Boolean, nullable=False, default=False)
    user_id = db.Column("submitter_id", db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("pigeonhole_categories.id"), nullable=False, index=True)
    status = db.Column(_enum(PgStatus), default=PgStatus.SUBMITTED, nullable=False, index=True)
    response = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    closed_at = db.Column(db.DateTime)

    user = db.relationship("User", foreign_keys=[user_id])
    category = db.relationship("PigeonholeCategory")
    attachments = db.relationship("PigeonholeAttachment", backref="submission", cascade="all, delete-orphan")
    updates = db.relationship("PigeonholeUpdate", backref="submission", cascade="all, delete-orphan",
                              order_by="PigeonholeUpdate.created_at")

    @property
    def submitted_at(self):
        return self.created_at

    def public_dict(self, reveal_identity=False, citizen_view=False):
        visible_updates = self.updates if not citizen_view else [
            item for item in self.updates if item.status == PgStatus.RESPONSE_PROVIDED
        ]
        result = {
            "id": self.id, "referenceNumber": self.reference_number,
            "submissionType": self.submission_type.value, "subject": self.subject,
            "message": self.message, "department": None, "departmentId": None,
            "assignedOfficerId": None, "anonymousSubmission": self.anonymous_submission,
            "status": self.status.value, "priority": None, "response": self.response,
            "submittedAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "respondedAt": None, "closedAt": self.closed_at.isoformat() if self.closed_at else None,
            "attachments": [item.public_dict() for item in self.attachments],
            "updates": [item.public_dict() for item in visible_updates],
        }
        if reveal_identity and not self.anonymous_submission and self.user:
            result["submittedBy"] = self.user.full_name
        return result


class PigeonholeAttachment(db.Model):
    __tablename__ = "pigeonhole_attachments"
    id = db.Column(db.Integer, primary_key=True)
    pigeonhole_id = db.Column("submission_id", db.Integer,
                              db.ForeignKey("pigeonhole_submissions.id"), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_url = db.Column(db.String(500), nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    uploaded_at = db.Column(db.DateTime, nullable=False, server_default=db.func.current_timestamp())

    def public_dict(self):
        return {"id": self.id, "fileName": self.file_name, "fileUrl": self.file_url,
                "mimeType": self.mime_type, "fileType": self.mime_type, "fileSize": self.file_size}


class PigeonholeUpdate(db.Model):
    __tablename__ = "pigeonhole_updates"
    id = db.Column(db.Integer, primary_key=True)
    pigeonhole_id = db.Column("submission_id", db.Integer,
                              db.ForeignKey("pigeonhole_submissions.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    status = db.Column(_enum(PgStatus))
    comment = db.Column("message", db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.current_timestamp())

    def public_dict(self):
        return {"id": self.id, "status": self.status.value if self.status else None,
                "comment": self.comment, "response": self.comment if self.status == PgStatus.RESPONSE_PROVIDED else None,
                "createdAt": self.created_at.isoformat() if self.created_at else None}


class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    report_id = db.Column(db.Integer, db.ForeignKey("reports.id"), nullable=True, index=True)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, nullable=False, default=False, index=True)
    read_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.current_timestamp())

    def public_dict(self):
        return {"id": self.id, "title": self.title, "message": self.message,
                "type": None, "isRead": self.is_read, "reportId": self.report_id,
                "pigeonholeId": None,
                "createdAt": self.created_at.isoformat() if self.created_at else None}


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    entity_type = db.Column(db.String(100), nullable=False)
    entity_id = db.Column(db.String(100))
    description = db.Column("details", db.Text)
    ip_address = db.Column(db.String(45))
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.current_timestamp())

    def public_dict(self):
        return {"id": self.id, "userId": self.user_id, "action": self.action,
                "entityType": self.entity_type, "entityId": self.entity_id,
                "description": self.description, "ipAddress": self.ip_address,
                "createdAt": self.created_at.isoformat() if self.created_at else None}
