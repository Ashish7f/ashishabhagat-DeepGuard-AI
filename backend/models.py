import sys
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func

_backend_dir = str(Path(__file__).resolve().parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

try:
    from backend.database import Base
except ImportError:
    from database import Base



class ScanRecord(Base):
    __tablename__ = "scan_records"
    __table_args__ = {"extend_existing": True}


    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    filename = Column(String(255), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    prediction = Column(String(10), nullable=False, index=True)  # "REAL" | "FAKE"
    confidence = Column(Float, nullable=False)
    fake_probability = Column(Float, nullable=False)
    real_probability = Column(Float, nullable=False)
    frequency_coherence = Column(Float, nullable=True)
    texture_uniformity = Column(Float, nullable=True)
    bilateral_symmetry = Column(Float, nullable=True)
    latency_ms = Column(Float, nullable=True)
    face_count = Column(Integer, default=1, nullable=True)
    model_version = Column(String(64), default="DeepGuard V8.1 Enhanced")
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        index=True
    )

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "file_size_bytes": self.file_size_bytes,
            "prediction": self.prediction,
            "confidence": round(self.confidence, 2) if self.confidence is not None else None,
            "fake_probability": round(self.fake_probability, 2) if self.fake_probability is not None else None,
            "real_probability": round(self.real_probability, 2) if self.real_probability is not None else None,
            "frequency_coherence": round(self.frequency_coherence, 2) if self.frequency_coherence is not None else None,
            "texture_uniformity": round(self.texture_uniformity, 2) if self.texture_uniformity is not None else None,
            "bilateral_symmetry": round(self.bilateral_symmetry, 2) if self.bilateral_symmetry is not None else None,
            "face_count": self.face_count if self.face_count is not None else 1,
            "latency_ms": round(self.latency_ms, 1) if self.latency_ms is not None else None,
            "model_version": self.model_version,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

