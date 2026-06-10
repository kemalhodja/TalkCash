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

    async def upload(self, user_id: str, data: bytes, extension: str = "jpg") -> str:
        key = f"receipts/{user_id}/{uuid.uuid4().hex}.{extension}"

        if self._s3:
            self._s3.put_object(
                Bucket=settings.s3_bucket,
                Key=key,
                Body=data,
                ContentType=f"image/{extension}",
            )
            if settings.s3_public_url:
                return f"{settings.s3_public_url.rstrip('/')}/{key}"
            return f"s3://{settings.s3_bucket}/{key}"

        user_dir = UPLOAD_DIR / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        filepath = user_dir / key.split("/")[-1]
        filepath.write_bytes(data)
        return str(filepath)

    async def get_url(self, stored_path: str) -> str:
        if stored_path.startswith("s3://") and self._s3:
            parts = stored_path.replace("s3://", "").split("/", 1)
            if len(parts) == 2:
                return self._s3.generate_presigned_url("get_object", Params={"Bucket": parts[0], "Key": parts[1]}, ExpiresIn=3600)
        return stored_path
