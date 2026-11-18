"""
Demo/test data only. Never run this against production data.
Run with: python seed.py
"""
from werkzeug.security import generate_password_hash

from app import create_app
from extensions import db
from models import (AuditLog, Category, Department, Notification,
                    PigeonholeCategory, PigeonholeSubmission, PgType,
                    Report, ReportUpdate, Role, User)
from utils import make_reference

DEMO_PASSWORD = "Demo@12345"
DEPARTMENTS = [
    "Roads & Transport", "Water Services", "Waste Management", "Public Works",
    "Environment", "Drainage & Sewerage", "Public Lighting", "General Public Services",
]
CATEGORIES = [
    ("Roads", "Roads & Transport"), ("Streetlights", "Public Lighting"),
    ("Waste Management", "Waste Management"), ("Water", "Water Services"),
    ("Drainage", "Drainage & Sewerage"), ("Sewerage", "Drainage & Sewerage"),
    ("Public Facilities", "Public Works"), ("Environment", "Environment"),
    ("Other", "General Public Services"),
]


def get_or_create(model, defaults=None, **kwargs):
    row = model.query.filter_by(**kwargs).first()
    if row:
        return row, False
    row = model(**{**kwargs, **(defaults or {})})
    db.session.add(row)
    db.session.flush()
    return row, True


def run():
    app = create_app()
    with app.app_context():
        dept_by_name = {}
        for name in DEPARTMENTS:
            dept, _ = get_or_create(
                Department, name=name,
                defaults={"description": "Demo department (seed data)."})
            dept_by_name[name] = dept

        for cat_name, dept_name in CATEGORIES:
            get_or_create(Category, name=cat_name, defaults={
                "department_id": dept_by_name[dept_name].id,
                "description": "Demo category (seed data).",
            })

        # TiDB defines pigeonhole category names as this fixed enum.
        pg_categories = {}
        for pg_type in PgType:
            category, _ = get_or_create(
                PigeonholeCategory, name=pg_type,
                defaults={"description": f"Default {pg_type.value.lower()} category."})
            pg_categories[pg_type] = category

        password_hash = generate_password_hash(DEMO_PASSWORD)
        admin, _ = get_or_create(User, email="admin@demo.civicconnect.test", defaults={
            "full_name": "Demo Administrator", "role": Role.ADMIN,
            "password_hash": password_hash,
        })
        officer, _ = get_or_create(User, email="officer@demo.civicconnect.test", defaults={
            "full_name": "Demo Officer (Roads)", "role": Role.OFFICER,
            "password_hash": password_hash,
            "department_id": dept_by_name["Roads & Transport"].id,
        })
        citizen, _ = get_or_create(User, email="citizen@demo.civicconnect.test", defaults={
            "full_name": "Demo Citizen", "role": Role.CITIZEN,
            "password_hash": password_hash,
        })

        roads = Category.query.filter_by(name="Roads").first()
        if roads and not Report.query.filter_by(citizen_id=citizen.id).first():
            report = Report(
                reference_number=make_reference("CC"),
                citizen_id=citizen.id,
                category_id=roads.id,
                department_id=roads.department_id,
                assigned_officer_id=officer.id,
                title="Large pothole on Kenyatta Avenue",
                description="A deep pothole near the roundabout is damaging vehicles (demo data).",
                location="Kenyatta Avenue roundabout",
                status="ASSIGNED",
            )
            db.session.add(report)
            db.session.flush()
            db.session.add(ReportUpdate(
                report_id=report.id, user_id=officer.id, status="ASSIGNED",
                comment="Assigned to the Roads & Transport crew (demo data)."))
            db.session.add(Notification(
                user_id=citizen.id, report_id=report.id,
                title="Report submitted", message=f"{report.reference_number} received."))

        if not PigeonholeSubmission.query.filter_by(user_id=citizen.id).first():
            db.session.add(PigeonholeSubmission(
                reference_number=make_reference("PG"),
                user_id=citizen.id,
                submission_type=PgType.SUGGESTION,
                subject="Add more public waste bins downtown",
                message="There aren't enough bins along the main street, so litter piles up (demo data).",
                category_id=pg_categories[PgType.SUGGESTION].id,
                anonymous_submission=False,
            ))

        db.session.add(AuditLog(
            user_id=admin.id, action="SEED_RUN", entity_type="System",
            description="Demo seed data loaded."))
        db.session.commit()
        print("Seed complete. Demo accounts (password: %s):" % DEMO_PASSWORD)
        print("  admin@demo.civicconnect.test")
        print("  officer@demo.civicconnect.test  (Roads & Transport)")
        print("  citizen@demo.civicconnect.test")


if __name__ == "__main__":
    run()
