"""Render the daily brief HTML template to a PDF file."""

from datetime import date, datetime
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from loguru import logger
from report.builder import Brief

TEMPLATE_DIR = Path(__file__).parent / "templates"


def render(brief: Brief, save_dir: Path, firm_name: str = "", your_name: str = "", lookahead_days: int = 30) -> Path:
    """
    Render brief → HTML → PDF.
    Returns the path to the saved PDF.
    """
    save_dir.mkdir(parents=True, exist_ok=True)
    out_path = save_dir / f"{brief.report_date.isoformat()}.pdf"

    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=False)
    template = env.get_template("brief.html")

    html = template.render(
        brief=brief,
        firm_name=firm_name,
        your_name=your_name,
        generated_at=datetime.now().strftime("%I:%M %p"),
        lookahead_days=lookahead_days,
    )

    try:
        from weasyprint import HTML
        HTML(string=html, base_url=str(TEMPLATE_DIR)).write_pdf(str(out_path))
        logger.info(f"PDF saved → {out_path}")
    except ImportError:
        # WeasyPrint not installed — save HTML as fallback
        out_path = out_path.with_suffix(".html")
        out_path.write_text(html, encoding="utf-8")
        logger.warning(f"WeasyPrint not found. Saved HTML instead → {out_path}")
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        out_path = out_path.with_suffix(".html")
        out_path.write_text(html, encoding="utf-8")
        logger.warning(f"Saved HTML fallback → {out_path}")

    return out_path
