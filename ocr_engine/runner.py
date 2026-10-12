import sys
import json
import base64
import os
import io
import re

# Ensure current dir is in sys.path to load utlis.py from maidaly/Arabic_OCR
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import utlis

def parse_arabic_exam_structure(raw_text):
    """
    Intelligently structures extracted Arabic text into question, choices, and points.
    """
    clean = raw_text.replace('\r\n', '\n').strip()
    lines = [l.strip() for l in clean.split('\n') if l.strip()]

    question_text = clean
    options = []
    points = 2
    q_type = "essay"

    # Detect points
    points_match = re.search(r'\[?\s*(\d+|درجتان|درجة|درجات)\s*(درجات|درجة)?\s*\]?', clean)
    if points_match:
        val = points_match.group(1)
        if val == "درجة":
            points = 1
        elif val == "درجتان":
            points = 2
        else:
            try:
                points = int(val)
            except:
                points = 2

    # Detect True/False
    if any(k in clean for k in ["صح أو خطأ", "ضع علامة (✓)", "ضع علامة", "(✓)", "(✗)", "صواب أو خطأ"]):
        q_type = "trueFalse"
        options = ["صح (صواب)", "خطأ (غير صواب)"]

    # Detect Multiple Choice (أ، ب، ج، د or 1, 2, 3, 4)
    choice_pattern = re.compile(r'(?:[\(\[\{]?([أ-دa-dA-D]|\d+)[\)\]\}]?\s*[-–.:]\s*|\b([أ-د])\s*[-–.]\s*)([^\n]+)')
    matches = choice_pattern.findall(clean)
    if matches and len(matches) >= 2:
        q_type = "choice"
        options = [m[2].strip() for m in matches if len(m[2].strip()) > 1]
        first_idx = clean.find(matches[0][2])
        if first_idx > 10:
            question_text = clean[:first_idx].strip()
    else:
        # Check lines for choices
        choices_in_lines = [l for l in lines if re.match(r'^[أ-دa-dA-D\d][\.\-\)]\s+', l)]
        if len(choices_in_lines) >= 2:
            q_type = "choice"
            options = [re.sub(r'^[أ-دa-dA-D\d][\.\-\)]\s+', '', l).strip() for l in choices_in_lines]
            question_text = ' '.join([l for l in lines if not re.match(r'^[أ-دa-dA-D\d][\.\-\)]\s+', l)]).strip()

    # Clean Question Text
    question_text = re.sub(r'\[\s*\d+\s*(درجات|درجة)?\s*\]', '', question_text)
    question_text = re.sub(r'\[\s*(درجتان|درجة)\s*\]', '', question_text).strip()
    if not question_text:
        question_text = clean

    # Extract Question Number
    q_num = "١"
    num_match = re.search(r'س\s*(\d+|[١-٩]+)', question_text)
    if num_match:
        q_num = num_match.group(1)

    return {
        "id": f"q-ocr-{os.getpid()}",
        "questionNumber": q_num,
        "type": q_type,
        "text": question_text,
        "options": options,
        "points": points,
        "rawOcrText": raw_text
    }

def process_image(image_input):
    try:
        from PIL import Image
        import numpy as np

        if os.path.exists(image_input):
            image = Image.open(image_input)
        else:
            # Assume base64
            clean_b64 = re.sub(r'^data:image/\w+;base64,', '', image_input)
            img_data = base64.b64decode(clean_b64)
            image = Image.open(io.BytesIO(img_data))

        image_np = np.asarray(image.convert("RGB"))

        # Import easyocr (installed in venv)
        import easyocr
        reader = easyocr.Reader(['ar', 'en'], gpu=False)
        result = reader.readtext(image_np)

        raw_text = utlis.get_raw_text(result) if result else ""

        if not raw_text.strip():
            return {"success": False, "error": "no text detected"}

        parsed = parse_arabic_exam_structure(raw_text)
        return {
            "success": True,
            "engine": "maidaly/Arabic_OCR (EasyOCR + CRAFT/CRNN)",
            "parsedQuestion": parsed,
            "rawText": raw_text
        }
    except Exception as e:
        # Never invent text: report the real failure to the caller.
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target = sys.argv[1]
        out = process_image(target)
        print(json.dumps(out, ensure_ascii=False))
    else:
        # Read from stdin
        input_data = sys.stdin.read().strip()
        out = process_image(input_data)
        print(json.dumps(out, ensure_ascii=False))
