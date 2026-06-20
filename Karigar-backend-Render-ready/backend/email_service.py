"""Generate a verified-artisan profile PDF and email it via Gmail SMTP.

Triggered server-side when an admin approves a worker. Sender and recipient are
configured via env (GMAIL_ADDRESS, GMAIL_APP_PASSWORD, PROFILE_EMAIL_RECIPIENT).
If credentials are missing, sending is skipped gracefully.
"""
import os
import ssl
import base64
import smtplib
import logging
from io import BytesIO
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage,
)

logger = logging.getLogger(__name__)

GMAIL_ADDRESS = os.environ.get("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
RECIPIENT = os.environ.get("PROFILE_EMAIL_RECIPIENT")

BRAND = colors.HexColor("#7A2E1D")
MUTED = colors.HexColor("#6B6B6B")

PROOF_LABELS = {
    "payslip": "Payslip", "onsite_photo": "On-site Photo",
    "salary_statement": "Salary Statement", "appointment_letter": "Appointment Letter",
}
AVAIL_LABELS = {
    "available_now": "Available Now", "available_from": "Available From",
    "not_available": "Not Available",
}


def is_email_configured() -> bool:
    return bool(GMAIL_ADDRESS and GMAIL_APP_PASSWORD and RECIPIENT)


def _decode_data_url(data_url: str):
    if not data_url:
        return None
    try:
        b64 = data_url.split(",", 1)[1] if "," in data_url else data_url
        return base64.b64decode(b64)
    except Exception:
        return None


def _image_flowable(data_url: str, target_w=82 * mm, max_h=95 * mm):
    raw = _decode_data_url(data_url)
    if not raw:
        return None
    try:
        img = RLImage(BytesIO(raw))
        iw, ih = float(img.imageWidth), float(img.imageHeight)
        if iw <= 0 or ih <= 0:
            return None
        ratio = target_w / iw
        w, h = target_w, ih * ratio
        if h > max_h:
            r2 = max_h / h
            w, h = w * r2, h * r2
        img.drawWidth, img.drawHeight = w, h
        return img
    except Exception as e:
        logger.warning("Could not embed image in PDF: %s", e)
        return None


def _image_grid(images, styles):
    """Two-column grid of images for a documents/portfolio section."""
    flows = [f for f in (_image_flowable(i) for i in (images or [])) if f is not None]
    if not flows:
        return []
    rows = []
    for i in range(0, len(flows), 2):
        pair = flows[i:i + 2]
        if len(pair) == 1:
            pair.append("")
        rows.append(pair)
    table = Table(rows, colWidths=[88 * mm, 88 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    return [table]


def generate_profile_pdf(worker: dict, referred_by: dict | None = None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=18 * mm, bottomMargin=16 * mm,
        leftMargin=16 * mm, rightMargin=16 * mm, title="Karigar Artisan Profile",
    )
    base = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=base["Title"], textColor=BRAND, fontSize=20, spaceAfter=2)
    sub = ParagraphStyle("sub", parent=base["Normal"], textColor=MUTED, fontSize=9, spaceAfter=10)
    sec = ParagraphStyle("sec", parent=base["Heading2"], textColor=BRAND, fontSize=13, spaceBefore=12, spaceAfter=6)
    body = ParagraphStyle("body", parent=base["Normal"], fontSize=10, leading=14)

    story = [
        Paragraph("Karigar — Verified Artisan Profile", h1),
        Paragraph(
            f"Approved on {datetime.now(timezone.utc).strftime('%d %b %Y, %H:%M UTC')}"
            f" &nbsp;•&nbsp; Profile ID: {worker.get('id', '')}", sub,
        ),
    ]

    def kv(label, value):
        return [Paragraph(f"<b>{label}</b>", body), Paragraph(str(value) if value not in (None, "") else "—", body)]

    avail = AVAIL_LABELS.get(worker.get("availability_status"), worker.get("availability_status") or "—")
    if worker.get("availability_status") == "available_from" and worker.get("available_from"):
        avail = f"Available From {worker['available_from']}"

    details = [
        kv("Full Name", worker.get("full_name")),
        kv("Phone", f"+91 {worker.get('phone', '')}"),
        kv("Date of Birth", worker.get("dob")),
        kv("Gender", (worker.get("gender") or "").title()),
        kv("Area / City", f"{worker.get('area', '')}, {worker.get('city', '')}"),
        kv("Experience", f"{worker.get('years_experience', 0)} years"),
        kv("Skills", ", ".join(worker.get("skills", []) or [])),
        kv("Languages", ", ".join(worker.get("languages", []) or [])),
        kv("Current Employer", worker.get("current_employer")),
        kv("Previous Employer", worker.get("previous_employer")),
        kv("Expected Monthly Wage", f"₹{worker.get('wage_expectation')}" if worker.get("wage_expectation") else "—"),
        kv("PhonePe / Google Pay", worker.get("upi_id")),
        kv("Availability", avail),
        kv("Referral Code", worker.get("referral_code")),
    ]
    if referred_by:
        details.append(kv("Referred By", f"{referred_by.get('name')} (+91 {referred_by.get('phone')})"))
    details.append(kv("Verification", "APPROVED ✓"))

    table = Table(details, colWidths=[48 * mm, 128 * mm])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E0DC")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(table)

    portfolio = worker.get("portfolio_images") or []
    aadhaar = worker.get("aadhar_images") or []
    proof = worker.get("employment_proof_images") or []

    if portfolio:
        story.append(Paragraph("Portfolio", sec))
        story += _image_grid(portfolio, base)
    if aadhaar:
        story.append(Paragraph("Aadhaar Card", sec))
        story += _image_grid(aadhaar, base)
    if proof:
        plabel = PROOF_LABELS.get(worker.get("employment_proof_type"), "")
        story.append(Paragraph(f"Employment Proof{(' · ' + plabel) if plabel else ''}", sec))
        story += _image_grid(proof, base)

    doc.build(story)
    return buf.getvalue()


def send_profile_email(worker: dict, referred_by: dict | None = None) -> bool:
    if not is_email_configured():
        logger.warning("Email not configured; skipping profile email for %s", worker.get("id"))
        return False
    try:
        pdf_bytes = generate_profile_pdf(worker, referred_by)
        name = worker.get("full_name", "Artisan")
        msg = MIMEMultipart()
        msg["Subject"] = f"Verified Artisan Profile — {name} (+91 {worker.get('phone','')})"
        msg["From"] = GMAIL_ADDRESS
        msg["To"] = RECIPIENT
        html = (
            f"<p>A new artisan profile has been <b>approved</b> on Karigar.</p>"
            f"<ul><li><b>Name:</b> {name}</li>"
            f"<li><b>Phone:</b> +91 {worker.get('phone','')}</li>"
            f"<li><b>Area:</b> {worker.get('area','')}, {worker.get('city','')}</li>"
            f"<li><b>Skills:</b> {', '.join(worker.get('skills', []) or [])}</li></ul>"
            f"<p>The full profile (with photos) is attached as a PDF.</p>"
        )
        msg.attach(MIMEText(html, "html"))
        attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
        safe = "".join(c for c in name if c.isalnum() or c in (" ", "_")).strip().replace(" ", "_")
        attachment.add_header("Content-Disposition", "attachment", filename=f"Karigar_{safe or 'Profile'}.pdf")
        msg.attach(attachment)

        context = ssl.create_default_context()
with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context, timeout=30) as server:
    server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
    server.sendmail(GMAIL_ADDRESS, [RECIPIENT], msg.as_string())
        logger.info("Profile email sent for worker %s to %s", worker.get("id"), RECIPIENT)
        return True
    except Exception as e:
        logger.error("Failed to send profile email for %s: %s", worker.get("id"), e)
        return False
