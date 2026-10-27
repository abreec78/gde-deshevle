"""Synthetic fixtures only: never used as a public/live catalogue."""
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('feed',Path(__file__).parents[1]/'ingestion/import_feed.py')
M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)
NOW=datetime(2026,10,27,12,tzinfo=timezone.utc)
CONFIG={'id':'test-only','authorized':True,'merchant':'Synthetic fixture, NOT a real shop','region':'Москва','feedHosts':['feed.example.test'],'productHosts':['shop.example.test'],'imageHosts':['img.example.test'],'category':'Компьютеры и комплектующие','url':'https://feed.example.test/feed?secret=NEVER_LOG_THIS'}
def fixture(price='1000',mpn='MODEL-1',capacity='1 ТБ',shipping=''):
    return f'''<yml_catalog date="{M.iso(NOW)}"><shop><offers><offer id="1" available="true"><name>Тестовый SSD, не реальный товар</name><vendor>Fixture</vendor><vendorCode>{mpn}</vendorCode><price>{price}</price><currencyId>RUB</currencyId><url>https://shop.example.test/product/1</url><picture>https://img.example.test/product.webp</picture><param name="Объём">{capacity}</param><param name="Интерфейс">NVMe</param>{shipping}</offer></offers></shop></yml_catalog>'''.encode()

class ImportTests(unittest.TestCase):
    def test_fields_and_unknown_delivery(self):
        rows,rejected=M.parse_yml(fixture(),CONFIG,NOW)
        self.assertEqual(rejected,0);self.assertEqual(rows[0]['offer']['price'],1000);self.assertIsNone(rows[0]['offer']['delivery']);self.assertEqual(rows[0]['product']['interface'],'NVMe');self.assertTrue(rows[0]['product']['id'].startswith('live:'))
    def test_free_delivery_only_when_verified(self):
        raw=fixture(shipping='<delivery-options><option cost="0" days="1"/></delivery-options>')
        self.assertIsNone(M.parse_yml(raw,CONFIG,NOW)[0][0]['offer']['delivery'])
        self.assertEqual(M.parse_yml(raw,dict(CONFIG,deliveryVerified=True),NOW)[0][0]['offer']['delivery'],0)
    def test_ambiguous_shipping_not_minimized(self):
        raw=fixture(shipping='<delivery-options><option cost="0"/><option cost="500"/></delivery-options>')
        self.assertIsNone(M.parse_yml(raw,dict(CONFIG,deliveryVerified=True),NOW)[0][0]['offer']['delivery'])
    def test_rejects_invalid_prices_and_unsafe_xml(self):
        for v in ['-1','NaN','Infinity','not-a-price']:
            with self.assertRaises(ValueError):M.parse_yml(fixture(price=v),CONFIG,NOW)
        with self.assertRaises(ValueError):M.parse_yml(b'<!DOCTYPE a [<!ENTITY x "y">]><a/>',CONFIG,NOW)
    def test_stale_and_future_feed_rejected(self):
        with self.assertRaises(ValueError):M.parse_yml(fixture(),CONFIG,NOW+timedelta(days=2))
        with self.assertRaises(ValueError):M.parse_yml(fixture(),CONFIG,NOW-timedelta(days=2))
    def test_urls_require_https_and_approved_hosts(self):
        for u in ['javascript:alert(1)','http://shop.example.test','https://127.0.0.1/a','https://u:p@shop.example.test/a']:
            self.assertFalse(M.public_url(u,CONFIG['productHosts']))
        self.assertFalse(M.public_url('https://other.test/a',CONFIG['productHosts']))
    def test_exact_matching_across_shops_and_variant_separation(self):
        a=M.parse_yml(fixture(),CONFIG,NOW)[0][0]['product']['id']
        b=M.parse_yml(fixture(),dict(CONFIG,id='another-shop'),NOW)[0][0]['product']['id']
        c=M.parse_yml(fixture(capacity='2 ТБ'),CONFIG,NOW)[0][0]['product']['id']
        self.assertEqual(a,b);self.assertNotEqual(a,c)
    def test_no_fuzzy_title_matching(self):
        self.assertNotEqual(M.product_key('a','1','','','',{}),M.product_key('b','1','','','',{}))
        self.assertNotEqual(M.product_key('a','1','','','1234567890123',{}),M.product_key('b','1','','','1234567890123',{}))
    def test_multiple_merchants_form_one_product_with_separate_offers(self):
        db=sqlite3.connect(':memory:');M.init_db(db)
        M.ingest(db,CONFIG,fixture(),NOW)
        M.ingest(db,dict(CONFIG,id='another-shop'),fixture(price='950'),NOW)
        products=M.export(db,NOW,[])['products']
        self.assertEqual(len(products),1);self.assertEqual(len(products[0]['offers']),2)
        self.assertEqual(len(products[0]['history']),2)
    def test_valid_gtin_and_capacity_units(self):
        self.assertEqual(M.product_key('a','1','','','4006381333931',{}),M.product_key('b','2','','','4006381333931',{}))
        raw=fixture(capacity='1').replace('name="Объём"'.encode(),'name="Объём" unit="TB"'.encode())
        self.assertEqual(M.parse_yml(raw,CONFIG,NOW)[0][0]['product']['capacity'],'1 ТБ')
    def test_history_atomic_update_and_failure_preserves_good_data(self):
        db=sqlite3.connect(':memory:');M.init_db(db)
        M.ingest(db,CONFIG,fixture(),NOW);M.ingest(db,CONFIG,fixture(price='900'),NOW+timedelta(hours=1))
        with self.assertRaises(ValueError):M.ingest(db,CONFIG,b'bad xml',NOW)
        p=M.export(db,NOW+timedelta(hours=1),[])['products'][0]
        self.assertEqual(p['offers'][0]['price'],900);self.assertEqual(len(next(iter(p['history'].values()))),2)
        self.assertEqual(M.export(db,NOW+timedelta(days=2),[])['products'],[])
    def test_deleted_offer_not_exported_and_removed_source_not_leaked(self):
        db=sqlite3.connect(':memory:');M.init_db(db);M.ingest(db,CONFIG,fixture(),NOW)
        M.ingest(db,CONFIG,fixture().replace(b'id="1"',b'id="2"'),NOW+timedelta(minutes=1))
        self.assertEqual(len(M.export(db,NOW,[])['products'][0]['offers']),1)
        self.assertEqual(M.export(db,NOW,[],set())['products'],[])
    def test_history_does_not_join_different_regions_or_reused_product_ids(self):
        db=sqlite3.connect(':memory:');M.init_db(db)
        M.ingest(db,CONFIG,fixture(),NOW)
        M.ingest(db,dict(CONFIG,region='Другой город'),fixture(),NOW+timedelta(minutes=1))
        M.ingest(db,dict(CONFIG,region='Другой город'),fixture(mpn='DIFFERENT-MODEL'),NOW+timedelta(minutes=2))
        p=M.export(db,NOW+timedelta(minutes=2),[])['products'][0]
        self.assertEqual(len(next(iter(p['history'].values()))),1)
    def test_failed_download_redacts_secret_and_exports_empty(self):
        with tempfile.TemporaryDirectory() as td,patch.object(M,'fetch_feed',side_effect=RuntimeError(CONFIG['url'])):
            result=M.run([CONFIG],Path(td)/'db.sqlite',Path(td)/'catalog.json',NOW)
            self.assertNotIn('NEVER_LOG_THIS',json.dumps(result));self.assertEqual(result['sources'][0]['status'],'error');self.assertEqual(result['products'],[])
    def test_no_unauthorized_sources_or_mixed_regions(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(ValueError):M.run([dict(CONFIG,authorized=False)],Path(td)/'db',Path(td)/'out',NOW)
            with self.assertRaises(ValueError):M.run([CONFIG,dict(CONFIG,region='Другой город')],Path(td)/'db',Path(td)/'out',NOW)

if __name__=='__main__':unittest.main()
