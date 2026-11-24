"""Read only the expected files from an untrusted GitHub Actions artifact."""

import stat
import sys
from pathlib import Path
from zipfile import ZipFile


def extract(archive, destination):
    limits = {"analysis.json": 64 * 1024, "lcov.info": 25 * 1024 * 1024}
    with ZipFile(archive) as coverage:
        selected = {}
        for name, limit in limits.items():
            entries = [entry for entry in coverage.infolist() if entry.filename == name]
            if len(entries) != 1:
                raise ValueError(f"Expected exactly one {name} in the coverage archive.")
            entry = entries[0]
            mode = stat.S_IFMT(entry.external_attr >> 16)
            if entry.is_dir() or mode not in (0, stat.S_IFREG) or not 0 < entry.file_size < limit:
                raise ValueError(f"Invalid type or size for {name} in the coverage archive.")
            with coverage.open(entry) as contents:
                data = contents.read(limit)
            if len(data) != entry.file_size:
                raise ValueError(f"Unexpected length for {name} in the coverage archive.")
            selected[name] = data
    destination.mkdir()
    for name, data in selected.items():
        with (destination / name).open("xb") as output:
            output.write(data)


if __name__ == "__main__":
    try:
        extract(Path(sys.argv[1]), Path(sys.argv[2]))
    except Exception as error:
        sys.exit(f"Cannot read the coverage archive: {error}")
