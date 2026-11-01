import unittest
from tools.product_metadata import allowed,parse_metadata
class MetadataTests(unittest.TestCase):
 def test_product(self):
  x=parse_metadata('<script type="application/ld+json">{"@type":"Product","name":"Exact model 1 TB","mpn":"ABC"}</script>','https://ozon.ru/product/a-123/')
  self.assertTrue(x['identified']);self.assertEqual(x['mpn'],'ABC');self.assertEqual(x['offers'],[])
 def test_no_guess(self):
  self.assertFalse(parse_metadata('<title>Access denied</title>','https://ozon.ru/')['identified'])
 def test_allowlist(self):
  for u in ['http://ozon.ru/','https://ozon.ru.evil.com/','https://ozon.ru@127.0.0.1/','https://127.0.0.1/','https://ozon.ru:444/']:
   self.assertFalse(allowed(u))
 def test_graph(self):
  self.assertTrue(parse_metadata('<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"One"}]}</script>','https://market.yandex.ru/')['identified'])

 def test_blocked_store_is_not_fabricated(self):
  from unittest.mock import patch
  from urllib.error import HTTPError
  from tools.product_metadata import identify
  class Blocked:
   def open(self,*args,**kwargs):raise HTTPError('https://ozon.ru/',403,'Forbidden',{},None)
  with patch('tools.product_metadata.build_opener',return_value=Blocked()):
   result=identify('https://ozon.ru/product/item-123/')
  self.assertFalse(result['identified']);self.assertEqual(result['offers'],[])
