from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys


source = Path(__file__).with_name("main.py")
spec = spec_from_file_location("pulsedrop_api_main", source)
if spec is None or spec.loader is None:
    raise RuntimeError("Could not load PulseDrop API module.")
module = module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
app = module.app