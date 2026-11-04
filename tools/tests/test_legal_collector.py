from pathlib import Path
import importlib.util,unittest,datetime
spec=importlib.util.spec_from_file_location('collector',Path(__file__).resolve().parents[1]/'update_legal.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class CollectorTests(unittest.TestCase):
 def test_all_twelve_categories_have_rules(self):
  examples={'auto':'Изменение ОСАГО','tax':'Налоговая декларация','health':'Медицинская помощь','education':'Школа и образование','family':'Семейные выплаты','benefits':'Назначение пенсии','housing':'Жилищные услуги','work':'Трудовые отношения','consumer':'Потребительский кредит','digital':'Защита персональных данных','environment':'Обращение с отходами','business':'Поддержка предпринимателей'}
  for category,title in examples.items():self.assertEqual(category,m.classify(title))
 def test_unrelated_title_stays_unclassified(self):self.assertIsNone(m.classify('Расписание конференции'))
 def test_sfr_document_requires_review_and_keeps_source(self):
  result=m.sfr_documents('<a href="/order/families~123">Федеральный закон от 20.02.2026 № 29-ФЗ</a>'.encode(),'https://sfr.gov.ru/order/families','family');self.assertEqual(1,len(result));self.assertEqual('needs_review',result[0]['reviewState']);self.assertNotIn('publishedAt',result[0]);self.assertEqual('https://sfr.gov.ru/order/families~123',result[0]['sourceUrl'])
 def test_signed_date_is_not_publication_date(self):
  items=m.sfr_documents('<a href="/order/families~123">Федеральный закон от 20.02.2026 № 29-ФЗ</a>'.encode(),'https://sfr.gov.ru/order/families','family');self.assertEqual('2026-02-20',items[0]['signedAt']);self.assertNotIn('publishedAt',items[0])
 def test_foreign_host_and_projects_are_not_imported(self):
  raw='<a href="https://evil.example/order/families~12">Федеральный закон</a><a href="/order/families~13">Проект приказа</a><a href="/order/families">Федеральные законы</a>'.encode();self.assertEqual([],m.sfr_documents(raw,'https://sfr.gov.ru/order/families','family'))
if __name__=='__main__':unittest.main()
