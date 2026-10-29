"""Syntax check for the native Swift sources without Xcode (works on Windows/Linux).

    pip install tree-sitter tree-sitter-language-pack
    python scripts/check-swift-syntax.py            # checks ios/

It only proves the files parse. Type errors are caught by the GitHub Actions build (ios-build.yml).
"""
import glob
import os
import sys

from tree_sitter_language_pack import get_parser

root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'ios')
parser = get_parser('swift')
failures = 0
for path in sorted(glob.glob(os.path.join(root, '**', '*.swift'), recursive=True)):
    source = open(path, 'rb').read()
    lines = source.splitlines() or [b'']
    errors = []

    def walk(node):
        if node.type == 'ERROR' or node.is_missing:
            errors.append(node)
        for child in node.children:
            walk(child)

    walk(parser.parse(source).root_node)
    print(('OK   ' if not errors else 'FAIL ') + os.path.relpath(path, root))
    for node in errors[:5]:
        row = min(node.start_point[0], len(lines) - 1)
        print(f'     line {row + 1}: {lines[row].decode("utf-8", "replace").strip()[:110]}')
    failures += bool(errors)
sys.exit(1 if failures else 0)
