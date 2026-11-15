import os
from PIL import Image, ImageDraw

def create_sticky_icon(size):
    # Create RGBA canvas with supersampling for crisp edges
    scale = 4
    s = size * scale
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(s * 0.08)
    corner_fold = int(s * 0.28)
    
    # Shadow
    shadow_offset = int(s * 0.04)
    shadow_rect = [
        pad + shadow_offset,
        pad + shadow_offset,
        s - pad + shadow_offset,
        s - pad + shadow_offset
    ]
    draw.rounded_rectangle(shadow_rect, radius=int(s * 0.08), fill=(0, 0, 0, 45))

    # Main sticky body points (polygon with folded bottom-right corner)
    # Top-left, Top-right, Bottom-right fold-start, Bottom-left
    points = [
        (pad, pad),
        (s - pad, pad),
        (s - pad, s - pad - corner_fold),
        (s - pad - corner_fold, s - pad),
        (pad, s - pad)
    ]
    
    # Yellow note background #fef08a -> (254, 240, 138)
    draw.polygon(points, fill=(254, 240, 138, 255))
    
    # Header strip (slightly darker yellow tint)
    header_height = int(s * 0.24)
    draw.rectangle([pad, pad, s - pad, pad + header_height], fill=(253, 224, 71, 255))
    
    # Border
    draw.line(points + [points[0]], fill=(234, 179, 8, 200), width=max(1, int(scale * 1.5)))

    # Folded corner flap
    fold_points = [
        (s - pad, s - pad - corner_fold),
        (s - pad - corner_fold, s - pad),
        (s - pad - corner_fold, s - pad - corner_fold)
    ]
    # Under-fold shadow
    draw.polygon(fold_points, fill=(202, 138, 4, 230))
    # Fold triangle
    draw.polygon([
        (s - pad, s - pad - corner_fold),
        (s - pad - corner_fold, s - pad),
        (s - pad - int(corner_fold * 0.9), s - pad - int(corner_fold * 0.9))
    ], fill=(254, 249, 195, 255))
    draw.line([
        (s - pad, s - pad - corner_fold),
        (s - pad - corner_fold, s - pad)
    ], fill=(202, 138, 4, 255), width=max(1, int(scale * 1.5)))

    # Content lines (representing text / heading)
    charcoal = (24, 24, 27, 220)
    line_w = max(1, int(s * 0.035))
    
    # Title line
    draw.rounded_rectangle([
        pad + int(s * 0.12),
        pad + int(s * 0.10),
        s - pad - int(s * 0.20),
        pad + int(s * 0.10) + line_w
    ], radius=line_w // 2, fill=(24, 24, 27, 200))

    # Body lines
    body_y_starts = [
        pad + header_height + int(s * 0.12),
        pad + header_height + int(s * 0.24),
        pad + header_height + int(s * 0.36)
    ]
    
    widths = [0.55, 0.45, 0.32]
    for y, w_factor in zip(body_y_starts, widths):
        if y < s - pad - corner_fold + int(s * 0.05):
            draw.rounded_rectangle([
                pad + int(s * 0.12),
                y,
                pad + int(s * 0.12) + int(s * w_factor),
                y + line_w
            ], radius=line_w // 2, fill=charcoal)

    # Downsample with high quality Lanczos filter
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

out_dir = r"c:\laragon\www\proj\chrome extensions\silicon_notes\icons"
for size in [16, 32, 48, 128]:
    icon = create_sticky_icon(size)
    icon.save(os.path.join(out_dir, f"icon{size}.png"), "PNG")
    print(f"Generated icon{size}.png")
