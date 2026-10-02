"""Offline and data-collection code that the API never imports.

``scraper_daily`` is a standalone scheduled job. It is deliberately not reachable
from ``backend.main`` or any engine: the service reads only the file the scraper
writes, so a scrape can be added, changed or removed without touching the API.
"""
