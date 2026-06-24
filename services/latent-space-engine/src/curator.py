import os
import json
import random
import requests
import time
from datetime import datetime
from pathlib import Path
from PIL import Image
from PIL.ExifTags import TAGS
import exifread

def normalize_vault_path(path_str: str) -> Path:
    # Replace backslashes
    p = str(path_str).replace('\\', '/')
    
    # If running on Windows
    if os.name == 'nt':
        if p.startswith('/app/vault'):
            p = p.replace('/app/vault', '//127.0.0.1/The Vault')
        elif p.startswith('/app'):
            p = p.replace('/app', '//127.0.0.1/docker')
    # If running on Linux/Docker
    else:
        if p.startswith('//127.0.0.1/The Vault'):
            p = p.replace('//127.0.0.1/The Vault', '/app/vault')
        elif p.startswith('//127.0.0.1/docker'):
            p = p.replace('//127.0.0.1/docker', '/app')
        elif p.startswith('//127.0.0.1/'):
            p = p.replace('//127.0.0.1/', '/volume1/')
            
    return Path(p)


class MerchCurator:
    def __init__(self, source_dir: str, memory_service_url: str = None):
        self.source_dir = normalize_vault_path(source_dir)
        self.memory_service_url = memory_service_url or os.getenv("MEMORY_SERVICE_URL", "http://localhost:5070")
        self.supported_extensions = {'.jpg', '.jpeg', '.png', '.tiff', '.arw', '.dng'}
        self.history_doc_id = "latent_space_history"
        self.current_doc_id = "latent_space_current_drop"

    def _ensure_document(self, doc_id: str):
        url = f"{self.memory_service_url}/api/documents/{doc_id}"
        try:
            res = requests.get(url, timeout=5)
            if res.status_code == 404:
                print(f"[CURATOR] Initializing document {doc_id} in memory service...")
                create_url = f"{self.memory_service_url}/api/documents"
                payload = {
                    "collection": "latent-space-drops",
                    "initialState": {},
                    "id": doc_id
                }
                requests.post(create_url, json=payload, timeout=5)
        except Exception as e:
            print(f"[WARNING] Failed to ensure document {doc_id} exists: {e}")

    def load_history(self) -> set:
        self._ensure_document(self.history_doc_id)
        url = f"{self.memory_service_url}/api/documents/{self.history_doc_id}/active"
        try:
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                data = res.json()
                return set(data.get("activeState", {}).keys())
        except Exception as e:
            print(f"[WARNING] Failed to load history from memory service: {e}")
        return set()

    def save_drop(self, filename: str, drop_data: dict):
        # 1. Save to history document
        self._ensure_document(self.history_doc_id)
        url_history = f"{self.memory_service_url}/api/documents/{self.history_doc_id}/fields"
        try:
            requests.put(url_history, json={"key": filename, "value": drop_data}, timeout=5)
        except Exception as e:
            print(f"[WARNING] Failed to log drop to history in memory service: {e}")

        # 2. Save to current drop document
        self._ensure_document(self.current_doc_id)
        url_current = f"{self.memory_service_url}/api/documents/{self.current_doc_id}/fields"
        try:
            requests.put(url_current, json={"key": "latest", "value": drop_data}, timeout=5)
        except Exception as e:
            print(f"[WARNING] Failed to log latest drop in memory service: {e}")

    def scan_vault(self) -> list:
        if not self.source_dir.exists():
            print(f"[ERROR] Merch source directory {self.source_dir} does not exist.")
            return []
        
        files = []
        for file_path in self.source_dir.rglob('*'):
            if file_path.suffix.lower() in self.supported_extensions:
                files.append(file_path)
        return files

    def get_exif_metadata(self, file_path: Path) -> dict:
        metadata = {
            "camera": "Unknown Camera",
            "lens": "Unknown Lens",
            "exposure": "Unknown Exposure",
            "iso": "Unknown ISO",
            "aperture": "Unknown Aperture",
            "date_taken": "Unknown Date"
        }
        
        try:
            with open(file_path, 'rb') as f:
                tags = exifread.process_file(f, details=False)
                
                # Camera Model
                make = tags.get('Image Make')
                model = tags.get('Image Model')
                make_str = str(make).strip() if make else ""
                model_str = str(model).strip() if model else ""
                if make_str and model_str:
                    if model_str.startswith(make_str):
                        metadata["camera"] = model_str
                    else:
                        metadata["camera"] = f"{make_str} {model_str}"
                elif model_str:
                    metadata["camera"] = model_str
                elif make_str:
                    metadata["camera"] = make_str
                
                # Lens Model
                lens = tags.get('EXIF LensModel') or tags.get('Image LensModel')
                if lens:
                    metadata["lens"] = str(lens).strip()
                
                # Exposure Time
                exposure = tags.get('EXIF ExposureTime')
                if exposure:
                    exp_str = str(exposure).strip()
                    if exp_str.startswith('[') and exp_str.endswith(']'):
                        exp_str = exp_str[1:-1]
                    metadata["exposure"] = f"{exp_str}s"
                
                # Aperture
                aperture = tags.get('EXIF FNumber')
                if aperture:
                    val = aperture.values
                    if isinstance(val, list) and len(val) > 0:
                        first_val = val[0]
                        if hasattr(first_val, 'num') and hasattr(first_val, 'den'):
                            if first_val.den != 0:
                                f_num = float(first_val.num) / first_val.den
                                if f_num.is_integer():
                                    metadata["aperture"] = f"f/{int(f_num)}"
                                else:
                                    metadata["aperture"] = f"f/{f_num:.1f}"
                            else:
                                metadata["aperture"] = f"f/{str(aperture)}"
                        else:
                            try:
                                f_num = float(first_val)
                                if f_num.is_integer():
                                    metadata["aperture"] = f"f/{int(f_num)}"
                                else:
                                    metadata["aperture"] = f"f/{f_num:.1f}"
                            except ValueError:
                                metadata["aperture"] = f"f/{first_val}"
                    else:
                        metadata["aperture"] = f"f/{str(aperture)}"
                
                # ISO
                iso = tags.get('EXIF ISOSpeedRatings')
                if iso:
                    val = iso.values
                    if isinstance(val, list) and len(val) > 0:
                        metadata["iso"] = f"ISO {val[0]}"
                    else:
                        metadata["iso"] = f"ISO {str(iso)}"
                
                # Date Taken
                date = tags.get('Image DateTime') or tags.get('EXIF DateTimeOriginal')
                if date:
                    metadata["date_taken"] = str(date).strip()
        except Exception as e:
            print(f"[WARNING] EXIF parsing failed for {file_path.name}: {e}")
            
            # Fallback to PIL basic tags
            try:
                img = Image.open(file_path)
                exif_data = img._getexif()
                if exif_data:
                    for tag_id, value in exif_data.items():
                        tag = TAGS.get(tag_id, tag_id)
                        if tag == 'Model':
                            metadata["camera"] = str(value)
                        elif tag == 'DateTimeOriginal':
                            metadata["date_taken"] = str(value)
            except Exception:
                pass
                
        return metadata

    def scan_vault_dir(self, directory: Path) -> list:
        norm_dir = normalize_vault_path(directory)
        if not norm_dir.exists():
            print(f"[ERROR] Merch source directory {norm_dir} does not exist.")
            return []
        
        files = []
        for file_path in norm_dir.rglob('*'):
            if file_path.suffix.lower() in self.supported_extensions:
                files.append(file_path)
        return files

    def curate_next_drop(self, profile: dict = None) -> dict:
        source = self.source_dir
        title_prefix = "Latent Space Drop: "
        if profile:
            if profile.get("source_dir"):
                source = normalize_vault_path(profile["source_dir"])
            if profile.get("title_prefix"):
                title_prefix = profile["title_prefix"]

        all_files = self.scan_vault_dir(source)
        if not all_files:
            print(f"[ERROR] No images found in the vault: {source}")
            return {}

        history = self.load_history()
        eligible_files = [f for f in all_files if f.name not in history]
        
        # Reset history if all images have been dropped to ensure continuity
        if not eligible_files:
            print("[INFO] All vault images have been used. Resetting drop history.")
            history = set()
            eligible_files = all_files

        selected_file = random.choice(eligible_files)
        print(f"[CURATOR] Selected next drop: {selected_file.name}")
        
        exif = self.get_exif_metadata(selected_file)
        
        # Extract dimensions using PIL
        try:
            with Image.open(selected_file) as img:
                w, h = img.size
                aspect_ratio = round(w / h, 2)
        except Exception as e:
            print(f"[CURATOR WARNING] Failed to read image dimensions: {e}")
            w, h = 2000, 3000
            aspect_ratio = 0.67

        clean_name = selected_file.stem.replace('_', ' ').replace('-', ' ').title()
        title = f"{title_prefix}{clean_name}"

        drop_data = {
            "filename": selected_file.name,
            "local_path": str(selected_file.absolute()),
            "title": title,
            "metadata": exif,
            "dimensions": {
                "width": w,
                "height": h,
                "aspect_ratio": aspect_ratio
            },
            "timestamp": time.time(),
            "formatted_date": datetime.now().isoformat()
        }
        
        if profile:
            drop_data["profile"] = profile
        
        self.save_drop(selected_file.name, drop_data)
        return drop_data

if __name__ == "__main__":
    source = os.getenv("MERCH_SOURCE_DIR", "Y:/creative-liberation-engine/archive/legacy-systems/services/latent-space-engine/media_mock")
    curator = MerchCurator(source_dir=source)
    result = curator.curate_next_drop()
    print("[CURATOR SUCCESS]", json.dumps(result, indent=2))
