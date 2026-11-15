"""Smoke-test: package imports correctly."""

import lv_ml


def test_package_importable() -> None:
    """The lv_ml package must import without error."""
    assert lv_ml.__doc__ is not None
