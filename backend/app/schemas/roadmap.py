from uuid import UUID

from pydantic import BaseModel


class RoadmapFeatureItem(BaseModel):
    id: UUID
    title: str
    description: str
    status: str
    vote_count: int
    is_voted: bool
    sort_order: int


class RoadmapGroupedResponse(BaseModel):
    active: list[RoadmapFeatureItem]
    soon: list[RoadmapFeatureItem]
    backlog: list[RoadmapFeatureItem]


class RoadmapVoteResponse(BaseModel):
    feature_id: UUID
    vote_count: int
    is_voted: bool
