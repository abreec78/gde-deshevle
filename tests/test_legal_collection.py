import importlib.util,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("legal_collector",ROOT/"tools/update_legal.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class OfficialCollectionTests(unittest.TestCase):
 def test_foreign_link_is_not_accepted_as_cbr_document(self):
  xml=b"<rss><channel><item><title>OSAGO</title><link>https://evil.test/1</link><guid>1</guid><pubDate>Tue, 03 Nov 2026 12:47:00 +0300</pubDate></item></channel></rss>"
  with patch.object(m,"get",return_value=xml):
   state,items=m.collect(m.SOURCES[0]);self.assertEqual([],items)
 def test_challenge_page_is_not_reported_as_successful_import(self):
  with patch.object(m,"get",return_value=b"<html>Enable JavaScript</html>"):
   state,items=m.collect(m.SOURCES[1]);self.assertEqual("error",state["status"]);self.assertEqual([],items)
 def test_failure_preserves_reviewed_records_and_queue(self):
  with tempfile.TemporaryDirectory()as folder:
   root=Path(folder);approved=[{"id":"approved"}];(root/"legal-reviewed.json").write_text(json.dumps(approved));(root/"legal-feed.json").write_text(json.dumps({"sources":[],"pending":[{"id":"waiting"}]}))
   with patch.object(m,"ROOT",root),patch.object(m,"get",side_effect=OSError("offline")):m.main()
   result=json.loads((root/"legal-feed.json").read_text());self.assertEqual(approved,result["items"]);self.assertEqual([{"id":"waiting"}],result["pending"]);self.assertTrue(all(x["status"]=="error"for x in result["sources"]if x["id"]!="pravo"));self.assertEqual(1,len(list((root/"legal-history").glob("*.json"))))
if __name__=="__main__":unittest.main()
