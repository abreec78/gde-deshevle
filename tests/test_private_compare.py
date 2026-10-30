import importlib.util
import pathlib
import threading
import unittest
from unittest.mock import patch

FILE=pathlib.Path(__file__).resolve().parents[1]/"tools"/"private_compare_server.py"
spec=importlib.util.spec_from_file_location("private_compare_server",FILE)
srv=importlib.util.module_from_spec(spec)
spec.loader.exec_module(srv)

class PrivateCompareTests(unittest.TestCase):
    def test_api_doc_pairlist(self):
        self.assertEqual(srv.unpack_pairs([{"result":"success"},{"data":[[{"status":"completed"}]]}])["result"],"success")
        self.assertEqual(srv.unpack_pairs([{"userlabel":"x"},{"report_json":"https://files.parser.market/_filestorage/a/b.json"}])["userlabel"],"x")

    def test_yandex_sample_card_with_photo(self):
        d={"regioncode":"Москва","data":[{"link":"https://market.yandex.ru/card/samsung-ssd/12345",
            "sku":{"history":[{"record_date":"2026-10-30T12:37:40+03:00"}]},
            "offers":[{"Name":"Samsung 980 MZ-V8V1T0BW 1 ТБ","Price":30689,
                "Offer_pics":["https://avatars.mds.yandex.net/item.jpg"]}]}]}
        items=srv.match_report_records(d,"ym")
        self.assertEqual(len(items),1)
        self.assertEqual(items[0]["price"],30689.0)
        self.assertTrue(items[0]["image"].startswith("https://"))
        self.assertEqual(items[0]["shop"],"Яндекс Маркет")

    def test_search_page_is_not_a_product(self):
        d={"data":[{"link":"https://market.yandex.ru/search?text=ssd",
            "offers":[{"Name":"Samsung 980 1 ТБ","Price":12345}]}]}
        self.assertEqual(srv.match_report_records(d,"ym"),[])

    def test_spoofed_store_domain_rejected(self):
        self.assertFalse(srv.permitted_store_url("https://ozon.ru.evil.test/product/123","ozons"))
        self.assertFalse(srv.permitted_store_url("http://www.ozon.ru/product/123","ozons"))
        self.assertTrue(srv.permitted_store_url("https://www.ozon.ru/product/123","ozons"))

    def test_report_download_requires_provider(self):
        self.assertIsNone(srv.get_report("https://evil.test/_filestorage/file.json"))

    def test_submits_three_provider_searches_without_real_calls(self):
        calls=[]
        def fake_post(endpoint,payload):
            calls.append((endpoint,payload.copy()))
            return [{"result":"success"}]
        job={"markets":{},"offers":[],"errors":[],"submitted":False}
        with patch.object(srv,"provider_post",side_effect=fake_post):
            srv.submit(job,"Samsung Galaxy A55","Москва")
        self.assertEqual([p[1]["market"] for p in calls],["ozons","wbs","ym"])
        self.assertEqual(calls[-1][1]["regionid"],"213")
        self.assertTrue(job["submitted"])

    def test_receives_provider_report_by_label(self):
        job={"markets":{"ym":{"label":"test123","state":"waiting"}},"offers":[],"errors":[],"submitted":True}
        response=[{"result":"success"},{"data":[[
            {"userlabel":"test123"},{"status":"completed"},
            {"report_json":"https://files.parser.market/_filestorage/x/demo.json"}]]}]
        report={"data":[{"link":"https://market.yandex.ru/card/ssd/123",
            "offers":[{"Name":"SSD 1TB","Price":2500}]}]}
        with patch.object(srv,"provider_post",return_value=response),patch.object(srv,"get_report",return_value=report):
            srv.poll(job)
        self.assertEqual(job["markets"]["ym"]["state"],"done")
        self.assertEqual(len(job["offers"]),1)

if __name__=="__main__":unittest.main()
