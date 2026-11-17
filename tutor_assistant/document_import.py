"""Extract plain text from a small DOCX without retaining the uploaded file."""
from io import BytesIO
from zipfile import BadZipFile, ZipFile
from xml.etree import ElementTree

from .portal import PortalError

NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def docx_text(raw: bytes) -> str:
    if not raw or len(raw) > 2 * 1024 * 1024:
        raise PortalError(400, "выберите DOCX размером до 2 МБ")
    try:
        with ZipFile(BytesIO(raw)) as archive:
            info = archive.getinfo("word/document.xml")
            if info.file_size > 4 * 1024 * 1024 or info.flag_bits & 1:
                raise ValueError("document too large or encrypted")
            xml = archive.read(info)
        xml = xml.decode("utf-8-sig")
        if "<!DOCTYPE" in xml.upper() or "<!ENTITY" in xml.upper():
            raise ValueError("DTD not allowed")
        root = ElementTree.fromstring(xml)
        paragraphs = []
        for paragraph in root.iter(NS + "p"):
            parts = []
            for node in paragraph.iter():
                if node.tag == NS + "t" and node.text:
                    parts.append(node.text)
                elif node.tag == NS + "tab":
                    parts.append("\t")
                elif node.tag in (NS + "br", NS + "cr"):
                    parts.append("\n")
            line = "".join(parts).strip()
            if line:
                paragraphs.append(line)
        text = "\n".join(paragraphs)
        if not text:
            raise PortalError(400, "в DOCX не найден текст; изображения и сканы не распознаются")
        return text[:5000]
    except (BadZipFile, KeyError, ValueError, ElementTree.ParseError, RuntimeError, OSError, UnicodeDecodeError):
        raise PortalError(400, "не удалось прочитать DOCX: файл повреждён, защищён или слишком велик") from None
