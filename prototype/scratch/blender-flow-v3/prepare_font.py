"""Download a tiny, OFL-licensed Chinese subset for the offline review page."""
from pathlib import Path
import re
import urllib.parse
import urllib.request

root=Path(__file__).resolve().parent
text=''.join(sorted(set(re.findall('[\u4e00-\u9fff]',(root/'index.html').read_text()))))
url='https://fonts.googleapis.com/css2?'+urllib.parse.urlencode({'family':'Noto Sans SC:wght@400','text':text,'display':'swap'})
try:
    request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36'})
    css=urllib.request.urlopen(request,timeout=20).read().decode()
    font_url=re.search(r'url\(([^)]+)\)',css).group(1)
    data=urllib.request.urlopen(font_url,timeout=20).read()
    license=urllib.request.urlopen('https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt',timeout=20).read()
    (root/'output/review-font.woff2').write_bytes(data)
    (root/'output/FONT-LICENSE.txt').write_bytes(license)
    print('Chinese font subset bytes:',len(data))
except Exception as error:
    print('Using system font fallback:',type(error).__name__)
