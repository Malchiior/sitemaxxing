"""Run Plow's plow-agents CLI on Windows.

plow-agents is written for macOS/Linux. Its write_private() calls os.fchmod and
then refuses any credential file that is not POSIX mode 600 -- neither exists
on Windows, so `login` crashes after Plow has verified the text and the account
token is lost. This replaces only that function, keeping its intent: the
credential file is written atomically and readable by the current user only
(an ACL instead of a mode). Everything else is Plow's code, unchanged.

Usage: python C:\\Users\\Devin\\.plow-agents-win\\plow-agents.py <verb> [args]
"""
import importlib.machinery
import importlib.util
import os
import subprocess
import sys
import tempfile

CLI = os.environ.get("PLOW_AGENTS_CLI") or os.path.join(os.path.expanduser("~"), ".plow-agents", "bin", "plow-agents")


def write_private_windows(path: str, body: str) -> str:
    destination = os.path.abspath(path)
    directory = os.path.dirname(destination) or "."
    os.makedirs(directory, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=directory, prefix=".plow-agents.", suffix=".new")
    try:
        with os.fdopen(descriptor, "w") as handle:
            handle.write(body)
        # Windows has no POSIX modes: drop inherited access, grant only this user.
        subprocess.run(["icacls", temporary, "/inheritance:r", "/grant:r", f"{os.environ['USERNAME']}:F"],
                       check=True, capture_output=True)
        os.replace(temporary, destination)
    except BaseException:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise
    return destination


loader = importlib.machinery.SourceFileLoader("plow_agents", CLI)
spec = importlib.util.spec_from_loader("plow_agents", loader)
module = importlib.util.module_from_spec(spec)
loader.exec_module(module)
module.write_private = write_private_windows
sys.argv[0] = CLI
sys.exit(module.main())
