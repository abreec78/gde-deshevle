import importlib.util
import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import hosted_compare_server as server

class FakeRedirect:
    def __init__(self, status, location):
        self.code=status
        self.headers={"Location":location}
    def read(self, n=-1):
        return b""

class HostedServerTests(unittest.TestCase):
    def test_shortlinks_only_for_https_ozon(self):
        self.assertEqual(server.canonical_ozon("https://ozon.ru/t/bTByYAY?utm=1"),
                         "https://ozon.ru/t/bTByYAY")
        for value in [
            "http://ozon.ru/t/bTByYAY",
            "https://ozon.ru.evil.example/t/bTByYAY",
            "https://example.com/t/bTByYAY",
            "https://ozon.ru@evil.example/t/bTByYAY",
            "https://ozon.ru/product/n-12345/",
        ]:
            self.assertIsNone(server.canonical_ozon(value))

    def test_follows_redirect_to_exact_product(self):
        fake=FakeRedirect(302,"https://www.ozon.ru/product/item-123456789/?utm_source=x")
        class FakeOpener:
            def open(self, request, timeout):
                raise HTTPError(request.full_url,302,"Found",fake.headers,None)
        with patch.object(server,"build_opener",return_value=FakeOpener()):
            got=server.follow_ozon_shortlink("https://ozon.ru/t/bTByYAY")
        self.assertEqual(got,"https://www.ozon.ru/product/item-123456789/")

    def test_external_redirect_is_rejected(self):
        fake=FakeRedirect(302,"https://evil.example/product/item-12345/")
        class FakeOpener:
            def open(self, request, timeout):
                raise HTTPError(request.full_url,302,"Found",fake.headers,None)
        with patch.object(server,"build_opener",return_value=FakeOpener()):
            self.assertIsNone(server.follow_ozon_shortlink("https://ozon.ru/t/bTByYAY"))

    def test_static_files_cannot_expose_implementation(self):
        self.assertTrue(server.allowed_static("/"))
        self.assertTrue(server.allowed_static("/results.js"))
        self.assertFalse(server.allowed_static("/tools/private_compare_server.py"))
        self.assertFalse(server.allowed_static("/.git/config"))
        self.assertFalse(server.allowed_static("/data/private.env"))
        self.assertFalse(server.allowed_static("/../private.py"))

    def test_default_paid_limit_is_zero(self):
        with patch.dict(server.os.environ,{"KUPIORA_DAILY_SEARCH_LIMIT":"0"}):
            self.assertFalse(server.consume_budget())

if __name__ == "__main__":
    unittest.main()
