# Virtual Try-On (Django + MediaPipe)

A Django site where the homepage shows a live webcam feed and lets users try on virtual accessories (glasses, hat, earrings) that track facial landmarks in real time using **MediaPipe FaceMesh** right in the browser.

## Quick Start

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Open http://127.0.0.1:8000/ and click **Enable Camera**.

### Notes
- All landmark detection runs client-side (no video leaves the browser).
- Accessories adapt to scale, rotation, and tilt using landmark geometry.
- Add your own PNGs in `face/static/face/img/accessories/` and register them in `templates/face/index.html` (window.APP_ACCESSORIES).
