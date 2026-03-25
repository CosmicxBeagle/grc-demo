from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine
from app.models.models import Base
from app.repositories.repositories import UserRepository

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

demo_users = [
    ("alice@example.com", "Alice", "alice@example.com", "admin"),
    ("bob@example.com", "Bob", "bob@example.com", "tester"),
    ("carol@example.com", "Carol", "carol@example.com", "tester"),
    ("dave@example.com", "Dave", "dave@example.com", "reviewer"),
    ("erin@example.com", "Erin", "erin@example.com", "reviewer"),
]

def seed():
    db: Session = SessionLocal()
    repo = UserRepository(db)

    for username, display_name, email, role in demo_users:
        existing = repo.get_by_username(username)
        if not existing:
            repo.create(
                username=username,
                display_name=display_name,
                email=email,
                role=role
            )
            print(f"Created user: {username}")
        else:
            print(f"User already exists: {username}")

    db.close()

if __name__ == "__main__":
    seed()
