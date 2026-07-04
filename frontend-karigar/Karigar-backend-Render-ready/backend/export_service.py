"""Generate a professional PDF report for worker profiles.

Each worker record contains:
- Serial number, name, mobile, gender, city, skills, experience
- Current/previous employer, referral info
- Embedded images: Aadhaar card, employment proof, portfolio photos

Images are fetched from GridFS and embedded directly as thumbnails.
Report includes page numbers and generation timestamp in footer.
"""
import base64
import io
import logging
from datetime import datetime, timezone
from typing import List, Optional

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image as RLImage, PageBreak, HRFlowable,
)
from reportlab.platypus.flowables import KeepTogether
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from PIL import Image as PILImage

logger = logging.getLogger(__name__)

# ── Brand colours ────────────────────────────────────────────────────────────
BRAND       = colors.HexColor("#7A2E1D")
BRAND_LIGHT = colors.HexColor("#F5EDE9")
MUTED       = colors.HexColor("#6B6B6B")
SUCCESS     = colors.HexColor("#2D7A4F")
WARNING     = colors.HexColor("#B45309")
ERROR       = colors.HexColor("#B91C1C")
WHITE       = colors.white
BLACK       = colors.black
BORDER      = colors.HexColor("#D1C4BE")

# ── Image sizing ─────────────────────────────────────────────────────────────
THUMB_W = 55 * mm
THUMB_H = 55 * mm


# ── Helpers ──────────────────────────────────────────────────────────────────

def _decode_image(data_url: str, max_w: float = THUMB_W, max_h: float = THUMB_H) -> Optional[RLImage]:
    """Decode a base64 data-URL into a ReportLab Image flowable."""
    if not data_url:
        return None
    try:
        b64 = data_url.split(",", 1)[1] if "," in data_url else data_url
        raw = base64.b64decode(b64)
        pil = PILImage.open(io.BytesIO(raw)).convert("RGB")
        # Resize preserving aspect ratio
        pil.thumbnail((int(max_w / mm * 3.78), int(max_h / mm * 3.78)), PILImage.LANCZOS)
        buf = io.BytesIO()
        pil.save(buf, format="JPEG", quality=75)
        buf.seek(0)
        img = RLImage(buf)
        iw, ih = float(img.imageWidth), float(img.imageHeight)
        ratio = min(max_w / iw, max_h / ih) if iw and ih else 1
        img.drawWidth  = iw * ratio
        img.drawHeight = ih * ratio
        return img
    except Exception as e:
        logger.warning("Could not decode image: %s", e)
        return None


def _status_color(status: str) -> colors.Color:
    if status == "approved":
        return SUCCESS
    if status == "rejected":
        return ERROR
    return WARNING


def _status_label(status: str) -> str:
    return {"approved": "✓ Verified", "pending": "⏳ Pending", "rejected": "✗ Rejected"}.get(status, status)


def _avail_label(status: str) -> str:
    return {
        "available_now": "Available Now",
        "available_from": "Available From Date",
        "not_available": "Not Available",
    }.get(status, status or "—")


# ── Page template with footer ─────────────────────────────────────────────────

def _make_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    ts = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    canvas.drawString(20 * mm, 10 * mm, f"Karigar — Worker Profile Report  |  Generated: {ts}")
    canvas.drawRightString(
        A4[0] - 20 * mm, 10 * mm,
        f"Page {doc.page}",
    )
    canvas.restoreState()


# ── Main builder ─────────────────────────────────────────────────────────────

def build_workers_pdf(workers: List[dict]) -> bytes:
    """Build and return the PDF bytes for all workers."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        title="Karigar Worker Profile Report",
    )

    base = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=base["Title"],
        textColor=BRAND,
        fontSize=22,
        spaceAfter=4,
        alignment=TA_CENTER,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=base["Normal"],
        textColor=MUTED,
        fontSize=10,
        spaceAfter=14,
        alignment=TA_CENTER,
    )
    worker_name_style = ParagraphStyle(
        "WorkerName",
        parent=base["Heading2"],
        textColor=BRAND,
        fontSize=13,
        spaceBefore=10,
        spaceAfter=4,
    )
    label_style = ParagraphStyle(
        "Label",
        parent=base["Normal"],
        textColor=MUTED,
        fontSize=8,
        leading=11,
    )
    value_style = ParagraphStyle(
        "Value",
        parent=base["Normal"],
        textColor=BLACK,
        fontSize=9,
        leading=13,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=base["Normal"],
        textColor=BRAND,
        fontSize=9,
        fontName="Helvetica-Bold",
        spaceBefore=6,
        spaceAfter=3,
    )

    story = []

    # ── Cover header ─────────────────────────────────────────────────────────
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("Karigar", title_style))
    story.append(Paragraph("Worker Profile Report", subtitle_style))
    ts = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")
    story.append(Paragraph(
        f"Total Workers: <b>{len(workers)}</b> &nbsp;&nbsp;|&nbsp;&nbsp; Generated: <b>{ts}</b>",
        ParagraphStyle("meta", parent=base["Normal"], fontSize=9, textColor=MUTED, alignment=TA_CENTER, spaceAfter=10),
    ))
    story.append(HRFlowable(width="100%", thickness=1.5, color=BRAND, spaceAfter=14))

    # ── Worker records ────────────────────────────────────────────────────────
    col_w = (A4[0] - 30 * mm) / 2  # page usable width / 2 for label-value pairs

    for sno, w in enumerate(workers, start=1):
        # ── Worker heading ────────────────────────────────────────────────────
        story.append(Paragraph(
            f"<b>{sno}.</b> &nbsp; {w.get('full_name', '—')}",
            worker_name_style,
        ))

        # ── Verification status badge ─────────────────────────────────────────
        vstatus = w.get("verification_status", "pending")
        story.append(Paragraph(
            f"<font color='{'#2D7A4F' if vstatus == 'approved' else '#B91C1C' if vstatus == 'rejected' else '#B45309'}'>"
            f"<b>{_status_label(vstatus)}</b></font>",
            ParagraphStyle("badge", parent=base["Normal"], fontSize=9, spaceAfter=6),
        ))

        # ── Info table (text fields) ──────────────────────────────────────────
        def lv(label: str, value) -> list:
            """Return a [label, value] row for the info table."""
            v = str(value) if value not in (None, "", [], {}) else "—"
            return [
                Paragraph(label, label_style),
                Paragraph(v, value_style),
            ]

        skills_str = ", ".join(w.get("skills") or []) or "—"
        langs_str  = ", ".join(w.get("languages") or []) or "—"
        referral   = w.get("referred_by_code") or "—"
        if w.get("referred_by"):
            ref = w["referred_by"]
            referral = f"{ref.get('name','—')} (+91 {ref.get('phone','')})"

        info_data = [
            lv("Mobile Number",       f"+91 {w.get('phone', '—')}"),
            lv("Gender",              (w.get("gender") or "—").title()),
            lv("City / Area",         f"{w.get('city', '—')} / {w.get('area', '—')}"),
            lv("Skill Category",      skills_str),
            lv("Primary Skill(s)",    skills_str),
            lv("Years of Experience", f"{w.get('years_experience', 0)} years"),
            lv("Languages",           langs_str),
            lv("Current Employer",    w.get("current_employer")),
            lv("Previous Employer",   w.get("previous_employer")),
            lv("Wage Expectation",    f"₹{w.get('wage_expectation')}" if w.get("wage_expectation") else "—"),
            lv("UPI / PhonePe",       w.get("upi_id")),
            lv("Availability",        _avail_label(w.get("availability_status", ""))),
            lv("Referral",            referral),
            lv("Referral Code",       w.get("referral_code", "—")),
            lv("Registration Date",   (w.get("created_at") or "")[:10] or "—"),
        ]

        info_table = Table(
            info_data,
            colWidths=[38 * mm, A4[0] - 30 * mm - 38 * mm],
        )
        info_table.setStyle(TableStyle([
            ("VALIGN",       (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW",    (0, 0), (-1, -1), 0.3, BORDER),
            ("TOPPADDING",   (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
            ("LEFTPADDING",  (0, 0), (0, -1),  0),
            ("LEFTPADDING",  (1, 0), (1, -1),  6),
            ("BACKGROUND",   (0, 0), (0, -1),  BRAND_LIGHT),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 5 * mm))

        # ── Images section ────────────────────────────────────────────────────
        aadhaar_imgs   = w.get("aadhar_images") or []
        proof_imgs     = w.get("employment_proof_images") or []
        portfolio_imgs = w.get("portfolio_images") or []

        has_images = any([aadhaar_imgs, proof_imgs, portfolio_imgs])

        if has_images:
            story.append(Paragraph("Documents &amp; Portfolio", section_style))

            img_rows = []

            # Row 1: Aadhaar + Employment Proof
            aadhaar_cell  = _decode_image(aadhaar_imgs[0])   if aadhaar_imgs  else Paragraph("No Aadhaar image",  label_style)
            proof_cell    = _decode_image(proof_imgs[0])     if proof_imgs    else Paragraph("No proof image",    label_style)

            img_rows.append([
                [Paragraph("Aadhaar Card", label_style), aadhaar_cell or Paragraph("—", label_style)],
                [Paragraph("Employment Proof", label_style), proof_cell or Paragraph("—", label_style)],
            ])

            # Portfolio photos — all in one row, wrap into groups of 3
            if portfolio_imgs:
                story.append(Paragraph("Portfolio Photos", section_style))
                port_group = []
                for i, pimg in enumerate(portfolio_imgs):
                    fl = _decode_image(pimg, max_w=52 * mm, max_h=52 * mm)
                    port_group.append(fl or Paragraph("—", label_style))
                    if len(port_group) == 3 or i == len(portfolio_imgs) - 1:
                        # Pad to 3 columns
                        while len(port_group) < 3:
                            port_group.append("")
                        port_table = Table(
                            [port_group],
                            colWidths=[(A4[0] - 30 * mm) / 3] * 3,
                        )
                        port_table.setStyle(TableStyle([
                            ("VALIGN",       (0, 0), (-1, -1), "TOP"),
                            ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
                            ("TOPPADDING",   (0, 0), (-1, -1), 3),
                            ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
                            ("GRID",         (0, 0), (-1, -1), 0.3, BORDER),
                        ]))
                        story.append(port_table)
                        port_group = []

            # Aadhaar + Proof table
            doc_table = Table(
                [[img_rows[0][0], img_rows[0][1]]],
                colWidths=[(A4[0] - 30 * mm) / 2] * 2,
            )
            doc_table.setStyle(TableStyle([
                ("VALIGN",       (0, 0), (-1, -1), "TOP"),
                ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
                ("GRID",         (0, 0), (-1, -1), 0.3, BORDER),
                ("TOPPADDING",   (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
                ("BACKGROUND",   (0, 0), (-1, 0),  BRAND_LIGHT),
            ]))
            story.append(doc_table)

        # ── Separator before next worker ──────────────────────────────────────
        story.append(Spacer(1, 6 * mm))
        story.append(HRFlowable(width="100%", thickness=0.8, color=BORDER, spaceAfter=8))

        # Page break every worker to keep things clean for management review
        if sno < len(workers):
            story.append(PageBreak())

    doc.build(story, onFirstPage=_make_footer, onLaterPages=_make_footer)
    return buf.getvalue()


# ── Keep old xlsx builder so nothing else breaks ──────────────────────────────
def build_workers_xlsx(workers: List[dict]) -> bytes:
    """Legacy stub — redirects to PDF for backward compatibility."""
    return build_workers_pdf(workers)
