from zipfile import ZipFile, ZIP_DEFLATED
from pathlib import Path
from xml.sax.saxutils import escape


OUT = Path("Top_Performer_Badge_Handoff.docx")


def p(text, bold=False):
    text = escape(text)
    if bold:
        return f"<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{text}</w:t></w:r></w:p>"
    return f"<w:p><w:r><w:t>{text}</w:t></w:r></w:p>"


content = [
    p("Top Performer Badge Handoff", bold=True),
    p(""),
    p("This document describes the deployed Supabase Edge Function for the Top Performer badge and the files included in the function bundle."),
    p(""),
    p("Deployed function files:", bold=True),
    p("index.ts"),
    p("evaluators/topPerformer.ts"),
    p("metrics/completion.ts"),
    p("metrics/ratings.ts"),
    p(""),
    p("What the function does:", bold=True),
    p("1. Accepts a worker_id from the request payload."),
    p("2. Evaluates whether the worker qualifies for the Top Performer badge."),
    p("3. Checks the score inputs used by the evaluator and metrics files."),
    p("4. Writes the badge assignment to the database when the worker qualifies."),
    p("5. Returns a success or failure response for the caller."),
    p(""),
    p("How the files fit together:", bold=True),
    p("index.ts is the entry point and coordinates the request flow."),
    p("evaluators/topPerformer.ts contains the badge decision logic."),
    p("metrics/completion.ts contributes completion-related scoring."),
    p("metrics/ratings.ts contributes rating-related scoring."),
    p(""),
    p("How to test:", bold=True),
    p("1. Deploy the edge function."),
    p("2. Run the local test script to call the deployed endpoint."),
    p("3. Confirm the edge function logs show a successful request."),
    p("4. Verify the expected row exists in public.worker_badges."),
    p(""),
    p("Verification query:", bold=True),
    p("SELECT wb.worker_id, b.badge_name, wb.earned_at FROM public.worker_badges wb JOIN public.badges b ON b.id = wb.badge_id WHERE b.badge_name = 'Top Performer';"),
    p(""),
    p("Frontend note:", bold=True),
    p("The frontend team still needs to call this deployed function and render the badge from the same data source the portal already uses."),
]

document_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
</w:document>""".format(body="".join(content))

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
