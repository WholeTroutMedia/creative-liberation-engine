import sys
import os
import importlib.util

def get_resolve():
    """
    Connects to the DaVinci Resolve Python API.
    Compatible with Python 3.12+ (removes deprecated 'imp' module reliance).
    """
    try:
        # First try the standard Resolve internal environment import
        import dvr_maclight
        resolve = dvr_maclight.Resolve()
        if resolve:
            return resolve
    except ImportError:
        pass

    # Fallback to loading via dynamic path (standard external script method)
    try:
        # Default Windows path for DaVinci Resolve Scripting API
        ext = '.dll' if sys.platform == 'win32' else '.so'
        program_data = os.environ.get('PROGRAMDATA', 'C:\\ProgramData')
        api_path = os.environ.get(
            'RESOLVE_SCRIPT_API', 
            os.path.join(program_data, 'Blackmagic Design', 'DaVinci Resolve', 'Support', 'Developer', 'Scripting', 'Modules')
        )
        
        module_path = os.path.join(api_path, 'DaVinciResolveScript.py')
        
        if not os.path.exists(module_path):
            print(f"[ERROR] Resolve API not found at {module_path}")
            return None

        # Modern Python 3.12+ dynamic import (replaces python 2 'imp')
        spec = importlib.util.spec_from_file_location("DaVinciResolveScript", module_path)
        bmd = importlib.util.module_from_spec(spec)
        sys.modules["DaVinciResolveScript"] = bmd
        spec.loader.exec_module(bmd)
        
        resolve = bmd.scriptapp('Resolve')
        return resolve

    except Exception as e:
        print(f"[ERROR] Failed to load Resolve API: {e}")
        return None

if __name__ == "__main__":
    resolve = get_resolve()
    if resolve:
        projectManager = resolve.GetProjectManager()
        project = projectManager.GetCurrentProject()
        if project:
            print(f"✅ CONNECTED! Current Project: {project.GetName()}")
            gallery = project.GetGallery()
            print(f"✅ Gallery Name: {gallery.GetGalleryName()}")
        else:
            print("✅ CONNECTED! (But no project is currently open)")
    else:
        print("❌ RESOLVE_API_RETURNED_NONE - Is DaVinci Resolve Studio running?")
