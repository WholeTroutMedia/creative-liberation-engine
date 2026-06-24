from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal

class Resolution(BaseModel):
    width: int
    height: int

class Style(BaseModel):
    aesthetic: Literal["1924_vintage", "clean_vector", "anime"]
    lora_weights: Dict[str, float]

class Assets(BaseModel):
    characters: List[str] = []
    backgrounds: List[str] = []
    audio_tracks: List[str] = []

class AssetBundleManifest(BaseModel):
    project_id: str
    fps_target: int
    fps_internal: int
    resolution: Resolution
    style: Optional[Style] = None
    assets: Optional[Assets] = None

class CameraAction(BaseModel):
    type: Literal["static", "pan", "zoom"]
    start_pos: List[float]
    end_pos: List[float]

class CharacterPresence(BaseModel):
    character_id: str
    starting_position: Literal["left", "center", "right", "offscreen"]
    action: str

class DialogueLine(BaseModel):
    character_id: str
    text: str
    audio_ref: Optional[str] = None
    start_time: float

class Shot(BaseModel):
    shot_id: str
    duration_seconds: float
    camera: CameraAction
    characters_present: List[CharacterPresence] = []
    dialogue: List[DialogueLine] = []

class Scene(BaseModel):
    scene_id: str
    background_ref: Optional[str] = None
    shots: List[Shot]

class ScriptSchema(BaseModel):
    scenes: List[Scene]

class BoneTransform(BaseModel):
    r: float  # rotation
    x: float  # translation x
    y: float  # translation y

class SpriteState(BaseModel):
    mouth: Optional[str] = None
    eyes: Optional[str] = None

class EntityState(BaseModel):
    entity_id: str
    type: Literal["character", "prop", "background"]
    x: float
    y: float
    scale: float
    rotation: float
    bones: Dict[str, BoneTransform] = {}
    sprites: Optional[SpriteState] = None

class CameraState(BaseModel):
    x: float
    y: float
    zoom: float

class Frame(BaseModel):
    camera: CameraState
    entities: List[EntityState]

class TimelineSchema(BaseModel):
    total_frames: int
    fps: int
    frames: List[Frame]
