"""English interface labels; bilingual learning content is preserved."""
from pathlib import Path
from html.parser import HTMLParser
import re,html
ROOT=Path(__file__).resolve().parents[1]
LABELS={'外观': 'Appearance', '跟随系统': 'System', '浅色': 'Light', '深色': 'Dark', '首页': 'Home', '词汇辨析': 'Word Comparisons', '一词多义': 'Word Meanings', '多义词': 'Word Meanings', '英语阅读': 'Reading', '跳至主要内容': 'Skip to content', '词间': 'Wordbook', '资料库': 'Library', '主导航': 'Main navigation', '搜索': 'Search', '让每一个词，更清晰。': 'A clearer understanding of every word.', '英语词汇 · 私人资料库': 'English Vocabulary · Personal Library', '搜索资料库': 'Search library', '全站搜索': 'Search library', '单词、中文释义、文章…': 'Words, Chinese meanings, articles…', '关闭搜索': 'Close search', '取消': 'Cancel', '全站搜索结果': 'Search results', '搜索词汇、例句和阅读文章': 'Search words, examples, and articles', '↑ ↓ 选择 · Enter 打开 · Esc 关闭': '↑ ↓ Navigate · Enter Open · Esc Close', '英语词汇辨析、一词多义与双语阅读资料库': 'A personal library of word comparisons, meanings, and bilingual reading.', '在相近的词之间，找到准确的表达。': 'Find the right expression among similar words.', '从常见义到延伸义，读懂词的不同面貌。': 'Explore common meanings and extended uses.', '在完整的文章里，理解语言的语境。': 'Understand language through complete articles.', '词语之间，': 'Between words,', '读懂更多。': 'discover more.', '一本随手翻阅的英语笔记。': 'Your English notebook, always within reach.', '查清区别，理解词义，然后回到阅读。': 'Compare words, explore meanings, and return to reading.', '查一个词，或找一篇文章': 'Look up a word or find an article', '浏览资料库': 'Browse your library', '按你的节奏，随时查阅': 'Explore at your own pace', '最近收录的辨析': 'Recently added comparisons', '查看全部': 'View all', '继续探索': 'Keep exploring', '阅读精选': 'Featured reading', '读音': 'Pronunciation', '美式 · US': 'American · US', '英式 · UK': 'British · UK', '全部展开': 'Expand all', '全部折叠': 'Collapse all', '使用设备英语语音': 'Uses your device’s English voices', '慢一点阅读，让语境帮助你理解。': 'Read at your own pace. Let context guide your understanding.', '点开文章中的英文单词，即可查阅中英释义。': 'Tap any English word for English and Chinese definitions.', '词间 · 为查阅与阅读而整理': 'Wordbook · Made for reference and reading', '英语词汇与阅读': 'English Vocabulary & Reading', '逐词对比': 'Word-by-word comparison', '手机可左右滑动表格，横向比较用法与例句。': 'Swipe the table sideways to compare usage and examples.', '单词 / 表达': 'Word / Expression', '词性、含义与侧重点': 'Meaning & Usage', '常见搭配 / 句型': 'Collocations / Patterns', '中英例句': 'Bilingual Examples', '怎么选？易错点在哪？': 'Usage notes & common pitfalls', '搭配、语法与易错点': 'Collocations, grammar & usage notes', '朗读': 'Listen', '适度的': 'Moderate (adjective)', '主持': 'Moderate (verb)', '居住 /lɪv/': 'Live /lɪv/', '现场 /laɪv/': 'Live /laɪv/', '二手 /juːzd/': 'Used /juːzd/', '过去常常': 'Used to', '第二 /ˈsekənd/': 'Second /ˈsekənd/', '借调': 'Second (verb)', '← 阅读目录': '← Reading library', '返回阅读目录': 'Back to reading library', '正文字号': 'Text size', '标准': 'Standard', '大': 'Large', '特大': 'Extra large', '段落': 'Paragraph', '选择段落': 'Choose a paragraph', '原文': 'Original', '全文译文': 'Full translation', '阅读目录': 'Reading library', 'F 段末句按所提供的纸面原文保留；该句语句残缺。': 'The final sentence of paragraph F is incomplete in the supplied source and has been preserved.', '收录常见义及部分专业用法，并提供英文释义、双语例句与发音。': 'Common and selected specialist meanings, with English definitions, bilingual examples, and pronunciation.', '词条': 'Entry', '释义': 'Chinese meaning', '中文意思': 'Chinese meaning', '英文释义': 'English definition', '搭配': 'Collocations', '例句': 'Example', '例句译文': 'Example translation', '正文': 'Content', '译文': 'Translation', '词性': 'Part of speech', '音标': 'IPA', '精确词条': 'Exact match', '词形匹配': 'Inflected form', '词条前缀': 'Prefix match', '标题': 'Title', '阅读文章': 'Reading', '阅读词汇': 'Reading vocabulary', '短语': 'Phrases', '文章词典': 'Article dictionary', '索引加载失败，请关闭后重试。': 'Could not load search. Close and try again.', '正在加载索引…': 'Loading search…', '没有找到匹配内容，试试另一种拼写或中文关键词。': 'No matches. Try another spelling or a Chinese keyword.', ' 条匹配记录': ' matches', '查看本段译文': 'Show translation', '收起本段译文': 'Hide translation', '查词数据加载失败，请刷新页面。': 'Could not load the dictionary. Please refresh the page.', '单词中英释义': 'English and Chinese definitions', '关闭': 'Close', '关闭释义，返回原文': 'Close definitions and return to the article', '朗读结束': 'Finished reading', '朗读失败，请检查设备语音设置': 'Could not read aloud. Check your device’s voice settings.', '正在朗读': 'Reading aloud', '本句用法 · ': 'In this sentence · ', '本文收录释义': 'Meaning in this article', '常见义项': 'Common meaning', '查看「': 'Explore “', '」的词条与搭配': '”: definitions and collocations', '查看 ': 'View ', '查阅 ': 'Look up ', '已切换，点击单词旁的按钮试听。': 'Voice changed. Tap Listen next to a word to try it.', '当前浏览器不支持朗读，请尝试 Safari、Chrome 或 Edge。': 'Read aloud is unavailable in this browser. Try Safari, Chrome, or Edge.', '已停止朗读。': 'Reading stopped.', '（设备未提供所选口音，使用可用英语语音）': ' (Selected accent unavailable; using an available English voice.)', '（使用系统语音，口音取决于设备）': ' (Using the system voice; accent depends on your device.)', '正在朗读 ': 'Reading aloud: ', '已朗读 ': 'Finished: ', '朗读未获允许，请再次点击按钮。': 'Read aloud was blocked. Tap Listen again.', '朗读未成功，请检查设备英语语音设置后重试。': 'Could not read aloud. Check your device’s English voice settings and try again.', '全部词汇': 'All vocabulary', ' 个单词 · 常见义与扩展用法': ' words · common meanings and extended uses', ' 组 · 释义、搭配与双语例句': ' comparisons · meanings, collocations, and bilingual examples'}
LABELS.update({'两页重叠词已合并。收录常见义及部分专业用法；专业、正式或口语用法已标注。朗读使用设备语音，多音词提供语境短句。':'Common and selected specialist meanings, with usage labels and device pronunciation. Words with multiple pronunciations include contextual phrases.','核心区别与用法':'Key differences & usage','常用搭配与句型':'Common collocations & patterns','易错提醒':'Common pitfalls','词汇':'Vocabulary','原文 · A—T':'Original · A–T','全文译文 · A—T':'Full translation · A–T','词汇 · 英文释义':'Vocabulary · English definitions','短语 · 中文释义':'Phrases · Chinese meanings'})
for word in ['适度的','主持','居住 /lɪv/','现场 /laɪv/','二手 /juːzd/','过去常常','第二 /ˈsekənd/','借调']:LABELS.pop(word,None)
def label(text):
 stripped=text.strip();value=LABELS.get(stripped)
 if value is not None:return text.replace(stripped,value,1)
 for pattern,replacement in [
  (r'(\d+) 组辨析',r'\1 comparisons'),
  (r'(\d+) 个单词 · (\d+) 个义项',r'\1 words · \2 meanings'),
  (r'(\d+) 篇双语文章',r'\1 bilingual articles'),
  (r'(\d+) 义项',r'\1 meanings'),
  (r'词汇辨析 · (\d+) 组',r'Word Comparisons · \1 groups'),
  (r'(\d+) 个单词 · (\d+) 个主要义项 · 常见义项与扩展用法，支持逐项查阅',r'\1 words · \2 meanings · Common and extended uses'),
  (r'▷ (.+)',lambda m:'▷ '+LABELS.get(m[1],m[1])),
  (r'(.+) · 用法对照',r'\1 · Usage comparison')]:
  if re.fullmatch(pattern,stripped):return re.sub(pattern,replacement,stripped)
 return text
class EnglishUI(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.out=[];self.raw=0
 def handle_starttag(self,t,attrs):
  raw=self.get_starttag_text()
  for key,value in attrs:
   if key in ('aria-label','placeholder','title','content') and value:
    translated=label(value)
    if value.startswith('朗读 '):translated='Listen to '+value[3:].replace(' 朗读','')
    if value.endswith(' 对比表'):translated=value[:-4]+' comparison table'
    raw=raw.replace(key+'="'+html.escape(value,quote=True)+'"',key+'="'+html.escape(translated,quote=True)+'"')
  if t=='html':raw=raw.replace('lang="zh-CN"','lang="en"')
  self.out.append(raw)
  if t in ('script','style'):self.raw+=1
 def handle_startendtag(self,t,a):self.handle_starttag(t,a)
 def handle_endtag(self,t):
  self.out.append('</'+t+'>')
  if t in ('script','style'):self.raw-=1
 def handle_data(self,s):self.out.append(s if self.raw else label(s))
 def handle_entityref(self,n):self.out.append('&'+n+';')
 def handle_charref(self,n):self.out.append('&#'+n+';')
 def handle_decl(self,s):self.out.append('<!'+s+'>')
 def handle_comment(self,s):self.out.append('<!--'+s+'-->')
def build():
 for p in (ROOT/'dist').glob('*.html'):
  parser=EnglishUI();parser.feed(p.read_text());p.write_text(''.join(parser.out))
