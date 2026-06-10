from typing import Optional
from pydantic import BaseModel


class Credentials(BaseModel):
    username: str
    password: str


class BrowserStep(BaseModel):
    action: str
    selector: Optional[str] = None
    value: Optional[str] = None


class BrowserRunRequest(BaseModel):
    url: str
    task: str
    steps: list[BrowserStep] = []
    credentials: Optional[Credentials] = None


class BrowserRunResponse(BaseModel):
    result: str
    screenshot: Optional[str] = None
