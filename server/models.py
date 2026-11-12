import enum
from datetime import datetime

from extensions import db


class Role(str, enum.Enum):
    CITIZEN = "CITIZEN"
    OFFICER = "OFFICER"
    ADMIN = "ADMIN"


class AccountStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class ReportStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    AWAITING_INFORMATION = "AWAITING_INFORMATION"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    REJECTED = "REJECTED"
    DUPLICATE = "DUPLICATE"


class Priority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


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
    INVALID = "INVALID"


def _enum(e):
    return db.Enum(e, values_callable=lambda x: [i.value for i in x])


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(30))
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(_enum(Role), default=Role.CITIZEN, nullable=False, index=True)
    county = db.Column(db.String(100))
    location = db.Column(db.String(200))
    profile_image = db.Column(db.String(255))
    status = db.Column(_enum(AccountStatus), default=AccountStatus.ACTIVE, nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    department = db.relationship("Department", back_populates="officers")

    def public_dict(self):
        return {
            "id": self.id,
            "fullName": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "role": self.role.value,
            "county": self.county,
            "location": self.location,
            "profileImage": self.profile_image,
            "status": self.status.value,
            "departmentId": self.department_id,
        }


class Department(db.Model):
    __tablename__ = "departments"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), unique=True, nullable=False)
    description = db.Column(db.Text)
    contact_email = db.Column(db.String(150))
    contact_phone = db.Column(db.String(30))
    status = db.Column(_enum(AccountStatus), default=AccountStatus.ACTIVE, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    officers = db.relationship("User", back_populates="department")
    categories = db.relationship("Category", back_populates="department")

    def public_dict(self):
        return {"id": self.id, "name": self.name, "description": self.description,
                "contactEmail": self.contact_email, "contactPhone": self.contact_phone,
                "status": self.status.value}


class Category(db.Model):
    __tablename__ = "categories"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), unique=True, nullable=False)
    description = db.Column(db.String(255))
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    department = db.relationship("Department", back_populates="categories")

    def public_dict(self):
        return {"id": self.id, "name": self.name, "description": self.description,
                "departmentId": self.department_id,
                "departmentName": self.department.name if self.department else None}


class Report(db.Model):
    __tablename__ = "reports"
    id = db.Column(db.Integer, primary_key=True)
    reference_number = db.Column(db.String(30), unique=True, nullable=False, index=True)
    citizen_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=False, index=True)
    assigned_officer_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    county = db.Column(db.String(100))
    sub_county = db.Column(db.String(100))
    ward = db.Column(db.String(100))
    location = db.Column(db.String(255))
    latitude = db.Column(db.Numeric(9, 6))
    longitude = db.Column(db.Numeric(9, 6))
    status = db.Column(_enum(ReportStatus), default=ReportStatus.SUBMITTED, nullable=False, index=True)
    priority = db.Column(_enum(Priority), default=Priority.MEDIUM, nullable=False)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    closed_at = db.Column(db.DateTime)

    citizen = db.relationship("User", foreign_keys=[citizen_id])
    officer = db.relationship("User", foreign_keys=[assigned_officer_id])
    category = db.relationship("Category")
    department = db.relationship("Department")
    attachments = db.relationship("ReportAttachment", backref="report", cascade="all, delete-orphan")
    updates = db.relationship("ReportUpdate", backref="report", cascade="all, delete-orphan",
                               order_by="ReportUpdate.created_at")

    def public_dict(self, include_citizen=False):
        d = {
            "id": self.id, "referenceNumber": self.reference_number,
            "title": self.title, "description": self.description,
            "category": self.category.name if self.category else None,
            "categoryId": self.category_id,
            "department": self.department.name if self.department else None,
            "departmentId": self.department_id,
            "assignedOfficerId": self.assigned_officer_id,
            "county": self.county, "subCounty": self.sub_county, "ward": self.ward,
            "location": self.location,
            "latitude": float(self.latitude) if self.latitude is not None else None,
            "longitude": float(self.longitude) if self.longitude is not None else None,
            "status": self.status.value, "priority": self.priority.value,
            "submittedAt": self.submitted_at.isoformat() if self.submitted_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "resolvedAt": self.resolved_at.isoformat() if self.resolved_at else None,
            "closedAt": self.closed_at.isoformat() if self.closed_at else None,
            "attachments": [a.public_dict() for a in self.attachments],
            "updates": [u.public_dict() for u in self.updates],
        }
        if include_citizen:
            d["citizenName"] = self.citizen.full_name if self.citizen else None
        return d


class ReportAttachment(db.Model):
    __tablename__ = "report_attachments"
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey("reports.id"), nullable=False)
    file_url = db.Column(db.String(500), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def public_dict(self):
        return {"id": self.id, "fileUrl": self.file_url, "fileType": self.file_type,
                "fileSize": self.file_size}


class ReportUpdate(db.Model):
    __tablename__ = "report_updates"
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey("reports.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(_enum(ReportStatus))
    comment = db.Column(db.Text)
    action_taken = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def public_dict(self):
        return {"id": self.id, "status": self.status.value if self.status else None,
                "comment": self.comment, "actionTaken": self.action_taken,
                "createdAt": self.created_at.isoformat() if self.created_at else None}


class PigeonholeCategory(db.Model):
    __tablename__ = "pigeonhole_categories"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), unique=True, nullable=False)
    description = db.Column(db.String(255))
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"))
    status = db.Column(_enum(AccountStatus), default=AccountStatus.ACTIVE, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class PigeonholeSubmission(db.Model):
    __tablename__ = "pigeonhole_submissions"
    id = db.Column(db.Integer, primary_key=True)
    reference_number = db.Column(db.String(30), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    submission_type = db.Column(_enum(PgType), nullable=False)
    subject = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), index=True)
    assigned_officer_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    anonymous_submission = db.Column(db.Boolean, default=False, nullable=False)
    access_code_hash = db.Column(db.String(255))
    status = db.Column(_enum(PgStatus), default=PgStatus.SUBMITTED, nullable=False, index=True)
    priority = db.Column(_enum(Priority), default=Priority.MEDIUM, nullable=False)
    response = db.Column(db.Text)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    responded_at = db.Column(db.DateTime)
    closed_at = db.Column(db.DateTime)

    user = db.relationship("User", foreign_keys=[user_id])
    officer = db.relationship("User", foreign_keys=[assigned_officer_id])
    department = db.relationship("Department")
    attachments = db.relationship("PigeonholeAttachment", backref="submission", cascade="all, delete-orphan")
    updates = db.relationship("PigeonholeUpdate", backref="submission", cascade="all, delete-orphan",
                               order_by="PigeonholeUpdate.created_at")

    def public_dict(self, reveal_identity=False, citizen_view=False):
        d = {
            "id": self.id, "referenceNumber": self.reference_number,
            "submissionType": self.submission_type.value, "subject": self.subject,
            "message": self.message,
            "department": self.department.name if self.department else None,
            "departmentId": self.department_id,
            "assignedOfficerId": self.assigned_officer_id,
            "anonymousSubmission": self.anonymous_submission,
            "status": self.status.value, "priority": self.priority.value,
            "response": self.response,
            "submittedAt": self.submitted_at.isoformat() if self.submitted_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "respondedAt": self.responded_at.isoformat() if self.responded_at else None,
            "closedAt": self.closed_at.isoformat() if self.closed_at else None,
            "attachments": [a.public_dict() for a in self.attachments],
        }
        # Officers/admins see internal updates; citizens only see updates that carry a response.
        updates = self.updates if not citizen_view else [u for u in self.updates if u.response]
        d["updates"] = [u.public_dict() for u in updates]
        if reveal_identity and not self.anonymous_submission and self.user:
            d["submittedBy"] = self.user.full_name
        return d


class PigeonholeAttachment(db.Model):
    __tablename__ = "pigeonhole_attachments"
    id = db.Column(db.Integer, primary_key=True)
    pigeonhole_id = db.Column(db.Integer, db.ForeignKey("pigeonhole_submissions.id"), nullable=False)
    file_url = db.Column(db.String(500), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def public_dict(self):
        return {"id": self.id, "fileUrl": self.file_url, "fileType": self.file_type,
                "fileSize": self.file_size}


class PigeonholeUpdate(db.Model):
    __tablename__ = "pigeonhole_updates"
    id = db.Column(db.Integer, primary_key=True)
    pigeonhole_id = db.Column(db.Integer, db.ForeignKey("pigeonhole_submissions.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(_enum(PgStatus))
    comment = db.Column(db.Text)
    response = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def public_dict(self):
        return {"id": self.id, "status": self.status.value if self.status else None,
                "comment": self.comment, "response": self.response,
                "createdAt": self.created_at.isoformat() if self.created_at else None}


class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    report_id = db.Column(db.Integer, db.ForeignKey("reports.id"))
    pigeonhole_id = db.Column(db.Integer, db.ForeignKey("pigeonhole_submissions.id"))
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.String(500), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def public_dict(self):
        return {"id": self.id, "title": self.title, "message": self.message,
                "type": self.type, "isRead": self.is_read,
                "reportId": self.report_id, "pigeonholeId": self.pigeonhole_id,
                "createdAt": self.created_at.isoformat() if self.created_at else None}


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    action = db.Column(db.String(100), nullable=False)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.Integer)
    description = db.Column(db.String(500))
    ip_address = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def public_dict(self):
        return {"id": self.id, "userId": self.user_id, "action": self.action,
                "entityType": self.entity_type, "entityId": self.entity_id,
                "description": self.description, "ipAddress": self.ip_address,
                "createdAt": self.created_at.isoformat() if self.created_at else None}
