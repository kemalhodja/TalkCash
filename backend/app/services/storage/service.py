import asyncio
import uuid
from pathlib import Path

from app.config import settings

UPLOAD_DIR = Path("uploads")


class StorageService:
    def __init__(self):
        self._s3 = None
        if settings.s3_enabled:
            import boto3
            self._s3 = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint or None,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                region_name=settings.s3_region,
            )

    def _put_s3(self, key: str, data: bytes, extension: str) -> None:
        self._s3.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=data,
            ContentType=f"image/{extension}",
        )

    def _get_s3_object(self, bucket: str, key: str) -> tuple[bytes, str]:
        obj = self._s3.get_object(Bucket=bucket, Key=key)
        body = obj["Body"].read()
        media_type = obj.get("ContentType") or "image/jpeg"
        return body, media_type

    async def upload(self, user_id: str, data: bytes, extension: str = "jpg") -> str:
        key = f"receipts/{user_id}/{uuid.uuid4().hex}.{extension}"

        if self._s3:
            await asyncio.to_thread(self._put_s3, key, data, extension)
            if settings.s3_public_url:
                return f"{settings.s3_public_url.rstrip('/')}/{key}"
            return f"s3://{settings.s3_bucket}/{key}"

        user_dir = UPLOAD_DIR / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        filepath = user_dir / key.split("/")[-1]
        filepath.write_bytes(data)
        return str(filepath)

    async def get_url(self, stored_path: str) -> str:
        if stored_path.startswith("http"):
            return stored_path
        if stored_path.startswith("s3://") and self._s3:
            parts = stored_path.replace("s3://", "").split("/", 1)
            if len(parts) == 2:
                return await asyncio.to_thread(
                    self._s3.generate_presigned_url,
                    "get_object",
                    Params={"Bucket": parts[0], "Key": parts[1]},
                    ExpiresIn=3600,
                )
        return stored_path

    async def read_bytes(self, stored_path: str) -> tuple[bytes, str]:
        if stored_path.startswith("http"):
            raise FileNotFoundError(stored_path)

        if stored_path.startswith("s3://") and self._s3:
            parts = stored_path.replace("s3://", "").split("/", 1)
            if len(parts) != 2:
                raise FileNotFoundError(stored_path)
            return await asyncio.to_thread(self._get_s3_object, parts[0], parts[1])

        path = Path(stored_path)
        if not path.is_absolute():
            candidate = UPLOAD_DIR / stored_path if not stored_path.startswith("uploads/") else Path(stored_path)
            if candidate.exists():
                path = candidate
        if not path.exists():
            raise FileNotFoundError(stored_path)

        media_type = "image/jpeg" if path.suffix.lower() in (".jpg", ".jpeg") else "image/png"
        return path.read_bytes(), media_type
