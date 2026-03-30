from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import AssetCreate, AssetUpdate, AssetOut
from app.services.services import AssetService
from app.auth.permissions import require_permission
from app.models.models import User

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetOut])
def list_assets(db: Session = Depends(get_db), _: User = Depends(require_permission("assets:read"))):
    return AssetService(db).list_all()


@router.post("", response_model=AssetOut, status_code=201)
def create_asset(data: AssetCreate, db: Session = Depends(get_db), _: User = Depends(require_permission("assets:write"))):
    return AssetService(db).create(data)


@router.patch("/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: int, data: AssetUpdate, db: Session = Depends(get_db), _: User = Depends(require_permission("assets:write"))):
    return AssetService(db).update(asset_id, data)


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("assets:write"))):
    AssetService(db).delete(asset_id)
