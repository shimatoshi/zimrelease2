#!/usr/bin/env python3
"""HTML -> self-contained searchable ZIM."""
import argparse, base64, mimetypes, os, re, urllib.request
from datetime import date
from libzim.writer import Creator, Item, StringProvider, Hint
LANG_MAP={"ja":"jpn","en":"eng"}
def extract_title(html):
    m=re.search(r"<title[^>]*>(.*?)</title>",html,re.S|re.I)
    return m.group(1).strip() if m else "Untitled"
def inline_remote_images(html):
    pat=re.compile(r'(<img\\b[^>]*?\\bsrc\\s*=\\s*)(["\\'])(https?://[^"\\']+)\\2',re.I); cache={}
    def repl(m):
        url=m.group(3)
        try:
            if url not in cache:
                req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (zimrelease2)"})
                with urllib.request.urlopen(req,timeout=30) as r:
                    raw=r.read(); ctype=(r.headers.get_content_type() or "").lower()
                if not ctype.startswith("image/"): ctype=mimetypes.guess_type(url.split("?")[0])[0] or "application/octet-stream"
                if not ctype.startswith("image/"): raise ValueError("not image")
                cache[url]=f"data:{ctype};base64,"+base64.b64encode(raw).decode()
            return m.group(1)+m.group(2)+cache[url]+m.group(2)
        except Exception as e:
            print("WARNING",url,e); return m.group(0)
    return pat.sub(repl,html)
class HtmlItem(Item):
    def __init__(self,path,title,html): super().__init__(); self.p,self.t,self.h=path,title,html
    def get_path(self): return self.p
    def get_title(self): return self.t
    def get_mimetype(self): return "text/html"
    def get_contentprovider(self): return StringProvider(self.h)
    def get_hints(self): return {Hint.FRONT_ARTICLE:True}
def main():
    p=argparse.ArgumentParser(); p.add_argument("input"); p.add_argument("output"); p.add_argument("--title"); p.add_argument("--lang",default="ja"); a=p.parse_args()
    html=inline_remote_images(open(a.input,encoding="utf-8").read()); title=a.title or extract_title(html); lang=LANG_MAP.get(a.lang,a.lang)
    c=Creator(a.output).config_indexing(True,lang)
    with c:
        c.set_mainpath("index.html"); c.add_item(HtmlItem("index.html",title,html))
        for k,v in [("Title",title[:30]),("Name",os.path.splitext(os.path.basename(a.output))[0]),("Tags","_ftindex:yes"),("Language",lang),("Date",date.today().isoformat()),("Description",title[:80]),("Creator","zimrelease2-ci"),("Publisher","zimrelease2-ci")]: c.add_metadata(k,v)
if __name__=="__main__": main()
