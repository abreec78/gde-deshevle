import json
import threading
import unittest
from urllib.request import build_opener, ProxyHandler
urlopen=build_opener(ProxyHandler({})).open
from urllib.error import HTTPError
from unittest.mock import patch
from http.server import ThreadingHTTPServer
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import hosted_compare_server as hosted

class MetadataHttpTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.server=ThreadingHTTPServer(('127.0.0.1',0),hosted.Handler)
  cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
  cls.base='http://127.0.0.1:'+str(cls.server.server_address[1])
 @classmethod
 def tearDownClass(cls):
  cls.server.shutdown();cls.server.server_close();cls.thread.join()
 def test_untrusted_url_rejected_before_network(self):
  with patch.object(hosted.product_metadata,'identify') as reader:
   with self.assertRaises(HTTPError) as ctx:urlopen(self.base+'/api/identify?url=https%3A%2F%2F127.0.0.1%2F')
   self.assertEqual(ctx.exception.code,400);ctx.exception.close();reader.assert_not_called()
 def test_metadata_does_not_create_offers(self):
  result={'identified':True,'title':'Exact product','offers':[],'url':'https://ozon.ru/product/x-123/'}
  with patch.object(hosted.product_metadata,'identify',return_value=result):
   with urlopen(self.base+'/api/identify?url=https%3A%2F%2Fozon.ru%2Fproduct%2Fx-123%2F') as r:
    self.assertEqual(json.load(r),result)
 def test_python_source_is_not_public(self):
  with self.assertRaises(HTTPError) as ctx:urlopen(self.base+'/tools/product_metadata.py')
  self.assertEqual(ctx.exception.code,404);ctx.exception.close()
