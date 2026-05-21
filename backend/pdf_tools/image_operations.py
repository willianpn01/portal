from pathlib import Path

from PIL import Image

SUPPORTED_INPUT  = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.tiff'}
SUPPORTED_OUTPUT = ['jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff']


def convert_image(
    input_path: Path,
    output_path: Path,
    output_format: str,
    quality: int = 90,
) -> Path:
    with Image.open(input_path) as img:
        if output_format.lower() in ('jpeg', 'jpg') and img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        save_kwargs = {}
        if output_format.lower() in ('jpeg', 'webp'):
            save_kwargs['quality'] = quality
            save_kwargs['optimize'] = True

        img.save(output_path, format=output_format.upper(), **save_kwargs)

    return output_path


def crop_image(
    input_path: Path,
    output_path: Path,
    x: int,
    y: int,
    width: int,
    height: int,
) -> Path:
    with Image.open(input_path) as img:
        img_w, img_h = img.size
        box = (
            max(0, x),
            max(0, y),
            min(img_w, x + width),
            min(img_h, y + height),
        )
        cropped = img.crop(box)
        cropped.save(output_path)

    return output_path


def resize_image(
    input_path: Path,
    output_path: Path,
    width: int | None = None,
    height: int | None = None,
    keep_aspect: bool = True,
) -> Path:
    with Image.open(input_path) as img:
        orig_w, orig_h = img.size

        if keep_aspect:
            if width and not height:
                height = int(orig_h * (width / orig_w))
            elif height and not width:
                width = int(orig_w * (height / orig_h))

        if width and height:
            img = img.resize((width, height), Image.LANCZOS)

        img.save(output_path)

    return output_path


def get_image_info(input_path: Path) -> dict:
    with Image.open(input_path) as img:
        return {
            'width':  img.size[0],
            'height': img.size[1],
            'mode':   img.mode,
            'format': img.format,
        }
