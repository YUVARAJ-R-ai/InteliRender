"""
Standalone Google Forms MCP server (stdio transport).

This is NOT part of the persistent HTTP MCP server. The Next.js agent spawns it
per-request via StdioClientTransport (see lib/mcp/configs/google-forms.ts),
injecting the per-user OAuth refresh token through env vars:

    GOOGLE_REFRESH_TOKEN   — the user's refresh token (decrypted from the DB)
    GOOGLE_CLIENT_ID       — app OAuth client id
    GOOGLE_CLIENT_SECRET   — app OAuth client secret

main.py deliberately skips *_stdio modules, so this file is never loaded into the
shared HTTP server.
"""
import os
from typing import Any, Optional

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Google Forms")

_TOKEN_URI = "https://oauth2.googleapis.com/token"
_SCOPES = [
    "https://www.googleapis.com/auth/forms.body",
    "https://www.googleapis.com/auth/drive",
]


def _forms_service():
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=os.environ["GOOGLE_REFRESH_TOKEN"],
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        token_uri=_TOKEN_URI,
        scopes=_SCOPES,
    )
    return build("forms", "v1", credentials=creds, cache_discovery=False)


def _build_item(question: dict[str, Any]) -> dict[str, Any]:
    qtype = str(question.get("type", "text")).lower()
    title = question.get("title", "")
    required = bool(question.get("required", False))
    options = question.get("options") or []
    choice_opts = [{"value": str(o)} for o in options]

    if qtype in ("multiple_choice", "radio", "choice"):
        q: dict[str, Any] = {"required": required, "choiceQuestion": {"type": "RADIO", "options": choice_opts}}
    elif qtype == "checkbox":
        q = {"required": required, "choiceQuestion": {"type": "CHECKBOX", "options": choice_opts}}
    elif qtype == "dropdown":
        q = {"required": required, "choiceQuestion": {"type": "DROP_DOWN", "options": choice_opts}}
    elif qtype == "paragraph":
        q = {"required": required, "textQuestion": {"paragraph": True}}
    else:  # text / short answer
        q = {"required": required, "textQuestion": {"paragraph": False}}

    return {"title": title, "questionItem": {"question": q}}


@mcp.tool()
def create_google_form(
    title: str,
    questions: list[dict[str, Any]],
    description: Optional[str] = None,
) -> dict:
    """
    Create a complete Google Form with all fields/questions in one call.

    `questions` is a list of objects: { title, type, options?, required? } where
    type is one of text | paragraph | multiple_choice | checkbox | dropdown.
    `options` is required for multiple_choice / checkbox / dropdown questions.

    Returns the form link — reply to the user with the responderUri.
    """
    try:
        service = _forms_service()

        # Step 1: create the form (title only — description/items go via batchUpdate)
        form = service.forms().create(body={"info": {"title": title}}).execute()
        form_id = form["formId"]

        # Step 2: set description (if any) and add all questions in one batch
        requests: list[dict[str, Any]] = []
        if description:
            requests.append(
                {"updateFormInfo": {"info": {"description": description}, "updateMask": "description"}}
            )
        for idx, q in enumerate(questions or []):
            requests.append({"createItem": {"item": _build_item(q), "location": {"index": idx}}})

        if requests:
            service.forms().batchUpdate(formId=form_id, body={"requests": requests}).execute()

        final = service.forms().get(formId=form_id).execute()
        responder_uri = final.get("responderUri")
        edit_uri = f"https://docs.google.com/forms/d/{form_id}/edit"

        return {
            "formId": form_id,
            "responderUri": responder_uri,
            "editUri": edit_uri,
            "questionsAdded": [q.get("title") for q in (questions or [])],
        }
    except Exception as exc:
        return {"error": str(exc)}


if __name__ == "__main__":
    mcp.run(transport="stdio")
