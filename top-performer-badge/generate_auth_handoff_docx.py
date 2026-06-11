from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


OUT = Path("Top_Performer_Badge_Auth_Handoff.docx")


def p(text: str, bold: bool = False) -> str:
    text = escape(text)
    if bold:
        return f"<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{text}</w:t></w:r></w:p>"
    return f"<w:p><w:r><w:t>{text}</w:t></w:r></w:p>"


body = "".join(
    [
        p("Top Performer Badge API Handoff", True),
        p(""),
        p("This document explains how to test the deployed Top Performer badge edge function using the same authentication flow described in the REST API documentation."),
        p(""),
        p("Deployed Edge Functions", True),
        p("1. client-auth"),
        p("2. top-performer-badging"),
        p(""),
        p("Authentication Flow", True),
        p("1. Call client-auth with email and password."),
        p("2. Copy the access_token from the response."),
        p("3. Pass that token to top-performer-badging in the Authorization header as Bearer <access_token>."),
        p("4. Keep apikey in the headers for both requests."),
        p(""),
        p("client-auth Request", True),
        p("Method: POST"),
        p("Endpoint: https://oycqlrxnmlwxkpcfwehx.supabase.co/functions/v1/client-auth"),
        p("Headers: Content-Type: application/json"),
        p("Headers: apikey: <SUPABASE_ANON_KEY>"),
        p("Headers: Authorization: Bearer <SUPABASE_ANON_KEY>"),
        p("Body example: {\"email\": \"worker@company.com\", \"password\": \"your_password\"}"),
        p(""),
        p("client-auth Success Response", True),
        p("{"),
        p('  "access_token": "...",'),
        p('  "expires_in": 3600,'),
        p('  "company_id": "uuid-of-company"'),
        p("}"),
        p(""),
        p("top-performer-badging Request", True),
        p("Method: POST"),
        p("Endpoint: https://oycqlrxnmlwxkpcfwehx.supabase.co/functions/v1/top-performer-badging"),
        p("Headers: Content-Type: application/json"),
        p("Headers: apikey: <SUPABASE_ANON_KEY>"),
        p("Headers: Authorization: Bearer <access_token>"),
        p("Body example: {\"worker_id\": \"d32167fe-c854-422b-b4ce-b0785c2b524d\", \"event\": \"manual_test\"}"),
        p(""),
        p("Expected Badge Response", True),
        p('{"badge":"Top Performer","tier":null,"metrics":{"completionRate":0,"avgRating":0}}'),
        p(""),
        p("What the response means", True),
        p("badge: the request reached the badge evaluator."),
        p("tier: null means the worker did not meet the current rule thresholds."),
        p("completionRate and avgRating come from candidate_pipeline, interviews, and interview_feedback."),
        p(""),
        p("Important Notes", True),
        p("The badge function now requires a valid bearer token."),
        p("The token must come from client-auth."),
        p("If client-auth returns 401, the email/password pair or auth payload does not match the endpoint contract."),
        p("If top-performer-badging returns unauthorized, the token is invalid, expired, or from a different auth flow."),
        p(""),
        p("Database Tables Used", True),
        p("candidate_pipeline"),
        p("interviews"),
        p("interview_feedback"),
        p("badge_rules"),
        p("badges"),
        p("worker_badges"),
        p(""),
        p("Suggested Test Sequence", True),
        p("1. Call client-auth in Postman."),
        p("2. Copy the access_token from the response."),
        p("3. Call top-performer-badging with Authorization: Bearer <access_token>."),
        p("4. Verify the returned JSON and confirm the row in worker_badges."),
    ]
)

document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
 xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
 xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
 xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
 xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 mc:Ignorable="w14 wp14">
  <w:body>
    {body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"""


content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
"""

with ZipFile(OUT, "w", ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", rels)
    z.writestr("word/_rels/document.xml.rels", doc_rels)
    z.writestr("word/document.xml", document_xml)

print(f"Wrote {OUT}")
