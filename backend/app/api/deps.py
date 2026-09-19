from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_current_user_optional(
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        return None
    return user


def get_current_user(
    user: Annotated[Optional[User], Depends(get_current_user_optional)],
) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_write_user(
    user: Annotated[Optional[User], Depends(get_current_user_optional)],
) -> Optional[User]:
    """Require auth for mutating endpoints when REQUIRE_AUTH_WRITES is enabled."""
    if settings.require_auth_writes:
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user
    return user


def require_roles(*roles: str):
    def _checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(roles)}",
            )
        return user

    return _checker
