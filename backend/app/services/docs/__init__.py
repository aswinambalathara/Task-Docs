"""
Google Docs integration, split by job. Callers use the modules (`docs.sync.sync_sprint_to_doc`)
so tests can patch a function where it is looked up.
"""

from app.services.docs import oauth, periods, realtime, renderer, summaries, sync

__all__ = ["oauth", "periods", "realtime", "renderer", "summaries", "sync"]
