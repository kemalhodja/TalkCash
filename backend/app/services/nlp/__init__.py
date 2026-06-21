"""Lazy NLP engine singleton — avoids import-time dependency chain in unit tests."""


class _LazyNLPEngine:
    _instance = None

    def _get(self):
        if self._instance is None:
            from app.services.nlp.engine import NLPEngine
            self._instance = NLPEngine()
        return self._instance

    def __getattr__(self, name):
        return getattr(self._get(), name)


nlp_engine = _LazyNLPEngine()
