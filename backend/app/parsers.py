"""Turns an uploaded file (Excel/CSV/PDF) into plain rows of dicts. This
layer only extracts rows — it has no opinion on what the columns mean or
which government-data category they belong to. That understanding step is
AI's job (see gemini_client.detect_schema), kept separate on purpose so a
parsing bug can never masquerade as a wrong AI decision."""

import io

import pandas as pd


class UnsupportedFileType(Exception):
    pass


def parse_file(filename: str, content: bytes) -> list[dict]:
    name = filename.lower()
    if name.endswith(".csv"):
        return _parse_dataframe(pd.read_csv(io.BytesIO(content)))
    if name.endswith(".xlsx") or name.endswith(".xls"):
        return _parse_dataframe(pd.read_excel(io.BytesIO(content)))
    if name.endswith(".pdf"):
        return _parse_pdf(content)
    raise UnsupportedFileType(f"Unsupported file type: {filename}")


def _parse_dataframe(df: pd.DataFrame) -> list[dict]:
    df = df.dropna(how="all")
    df.columns = [str(c).strip() for c in df.columns]
    return df.to_dict(orient="records")


def _parse_pdf(content: bytes) -> list[dict]:
    import pdfplumber

    rows: list[dict] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                if not table or len(table) < 2:
                    continue
                header = [str(c).strip() if c else f"col_{i}" for i, c in enumerate(table[0])]
                for raw_row in table[1:]:
                    row = {header[i]: raw_row[i] for i in range(min(len(header), len(raw_row)))}
                    if any(v not in (None, "") for v in row.values()):
                        rows.append(row)
    return rows
