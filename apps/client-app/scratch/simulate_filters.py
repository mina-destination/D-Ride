import colorsys

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return [int(hex_str[i:i+2], 16) / 255.0 for i in (0, 2, 4)]

def rgb_to_hex(rgb):
    return '#' + ''.join(f'{max(0, min(255, int(c * 255))):02x}' for c in rgb)

def apply_invert(rgb, amount=1.0):
    return [c * (1.0 - amount) + (1.0 - c) * amount for c in rgb]

def apply_sepia(rgb, amount=1.0):
    r, g, b = rgb
    tr = r * (1 - 0.607 * amount) + g * 0.769 * amount + b * 0.189 * amount
    tg = r * 0.349 * amount + g * (1 - 0.314 * amount) + b * 0.168 * amount
    tb = r * 0.272 * amount + g * 0.534 * amount + b * (1 - 0.869 * amount)
    return [max(0.0, min(1.0, val)) for val in (tr, tg, tb)]

def apply_saturate(rgb, amount=1.0):
    r, g, b = rgb
    l = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return [max(0.0, min(1.0, l + (c - l) * amount)) for c in rgb]

def apply_hue_rotate(rgb, angle_deg):
    r, g, b = rgb
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    h = (h + angle_deg / 360.0) % 1.0
    return list(colorsys.hsv_to_rgb(h, s, v))

def apply_brightness(rgb, amount=1.0):
    return [max(0.0, min(1.0, c * amount)) for c in rgb]

def apply_contrast(rgb, amount=1.0):
    return [max(0.0, min(1.0, (c - 0.5) * amount + 0.5)) for c in rgb]

start_color = "#f4f3f0"
target_color = "#131e2b"

print(f"Start color: {start_color}")
print(f"Target color: {target_color}\n")

best_dist = 999.0
best_filter = ""
best_result = ""

# Loop parameters
sepia_vals = [x / 10.0 for x in range(0, 11)]
saturate_vals = [x / 4.0 for x in range(4, 21)]  # 1.0 to 5.0
hue_vals = list(range(160, 240, 5))
brightness_vals = [x / 10.0 for x in range(4, 13)] # 0.4 to 1.2
contrast_vals = [x / 10.0 for x in range(6, 15)]   # 0.6 to 1.4

for sepia in sepia_vals:
    for saturate in saturate_vals:
        for hue in hue_vals:
            for brightness in brightness_vals:
                for contrast in contrast_vals:
                    rgb = hex_to_rgb(start_color)
                    rgb = apply_invert(rgb, 1.0)
                    rgb = apply_sepia(rgb, sepia)
                    rgb = apply_saturate(rgb, saturate)
                    rgb = apply_hue_rotate(rgb, hue)
                    rgb = apply_brightness(rgb, brightness)
                    rgb = apply_contrast(rgb, contrast)
                    
                    tr, tg, tb = hex_to_rgb(target_color)
                    dist = ((rgb[0]-tr)**2 + (rgb[1]-tg)**2 + (rgb[2]-tb)**2)**0.5
                    if dist < best_dist:
                        best_dist = dist
                        best_result = rgb_to_hex(rgb)
                        best_filter = (
                            f"invert(100%) sepia({int(sepia*100)}%) saturate({int(saturate*100)}%) "
                            f"hue-rotate({hue}deg) brightness({int(brightness*100)}%) contrast({int(contrast*100)}%)"
                        )

print(f"Best match distance: {best_dist:.4f}")
print(f"Resulting color: {best_result}")
print(f"Filter combination:\n{best_filter}")
