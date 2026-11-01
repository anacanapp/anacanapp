#!/usr/bin/env python3
"""3D renderlər üçün AI fon silmə (rembg + BiRefNet).

Yumşaq kölgə və işıq haşiyəsi olan 3D şəkillərdə ağ fonu flood-fill ilə kəsmək
kölgə və halo saxlayır; BiRefNet onları da təmiz ayırır.

İşlətmə: python3 -I cutout_ai.py <giriş.png> <çıxış.png>
Asılılıq: pip install "rembg[cpu]"  (model ilk dəfə ~224MB yüklənir)
"""
import sys

from PIL import Image
from rembg import new_session, remove

session = new_session("birefnet-general-lite")
src = Image.open(sys.argv[1]).convert("RGB")
remove(src, session=session, post_process_mask=False).save(sys.argv[2], optimize=True)
