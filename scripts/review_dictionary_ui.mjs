import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = resolve(process.env.VISUAL_OUT ?? 'build/dictionary-review');
const roots = { site: resolve('dist'), oldsite: resolve(process.env.SITE_BASE ?? 'dist') };
const bundles = {
  '/before.js': await readFile(resolve(process.env.EXT_BASE ?? '../phase04/dist', 'content.js'), 'utf8'),
  '/after.js': await readFile(resolve(process.env.EXT_DIST ?? '../phase05-ext/dist', 'content.js'), 'utf8'),
};
const fixture = `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Reading sample</title><style>
*{box-sizing:border-box}body{margin:0;background:#faf9f5;color:#20211e;font:17px/1.8 Georgia,serif}html{color-scheme:light dark}
main{max-width:730px;margin:0 auto;padding:28px 24px 450px}h1{font:750 clamp(30px,5vw,56px)/1.05 Helvetica,Arial,sans-serif;letter-spacing:-.045em;margin:8px 0 24px}.section{font:700 12px/1.2 Helvetica,Arial,sans-serif;letter-spacing:.09em;color:#a62c1e}p{margin:12px 0 25px}@media(prefers-color-scheme:dark){body{background:#1c1d1b;color:#efeee8}.section{color:#ff9782}}
</style><main><span class="section">READING SAMPLE</span><h1>The books we keep</h1>
<p>On Saturday the library opened its doors as usual. A box of donated paperbacks was waiting beside the entrance.</p>
<p>She picked the <span id="word">book</span> up. A handwritten note slipped out and landed on the floor.</p>
<p>She read the first line twice, then carried the book to a window where the light was better.</p>
<p id="next">The librarian suggested putting the books on a separate shelf.</p>
</main></html>`;
const types = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html' };
const server = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/extension') return res.setHeader('Content-Type','text/html').end(fixture);
    if (bundles[pathname]) return res.setHeader('Content-Type','text/javascript').end(bundles[pathname]);
    const [, group, ...parts] = pathname.split('/');
    const path = resolve(roots[group], ...parts);
    assert.ok(path.startsWith(roots[group] + sep));
    const body = await readFile(path);
    res.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream').end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(ok => server.listen(0,'127.0.0.1',ok));
const origin = 'http://127.0.0.1:' + server.address().port;
await mkdir(output,{recursive:true});

const target = '#vpn-privacy-B [data-lookup="back"]';
const extPanel = 'taslexicon-lookup';
const sitePanel = '#lookup-card';
const sample = data => ({
  query: data.query, status: 'success', headword: data.query, morphology: [],
  meanings: [{ part: 'Noun', senses: [{ english: 'A written or printed work consisting of pages bound together.', chinese: '书；书籍', examples: [] }] }],
  pronunciations: [], source: { name: 'Test definition', url: 'https://en-word.net/' },
});
const report = [];
async function open(browser, surface, version, theme, scheme, size) {
  const context = await browser.newContext({ viewport: {width:size[0], height:size[1]}, colorScheme:scheme, hasTouch:size[0]<500 });
  const page = await context.newPage();
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().url().startsWith(origin + '/')) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  await page.addInitScript(({ theme, sampleFunction }) => {
    localStorage.setItem('vocab.theme', theme);
    const old = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      const root = old.call(this, this.localName === 'taslexicon-lookup' ? {...options, mode:'open'} : options);
      return root;
    };
    window.testCalls = [];
    Object.defineProperty(window,'speechSynthesis',{ value: {
      speaking:false,pending:false,getVoices:()=>[{lang:'en-GB',localService:true},{lang:'en-US',localService:true}],
      speak: u => testCalls.push([u.text,u.lang,u.rate]),cancel:()=>{},
    }});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class {constructor(text){this.text=text;}}});
    window.browser = {
      storage: {local:{get:async()=>({theme})}, onChanged:{addListener(){},removeListener(){}}},
      runtime: {id:'fixture',onMessage:{addListener(){},removeListener(){}},sendMessage:async data => {
        if (data.type === 'taslexicon:lookup') return (new Function('data', 'return (' + sampleFunction + ')(data)'))(data);
        if (data.type === 'taslexicon:collection-save') { testCalls.push(data.draft); return {id:'saved'}; }
      }},
    };
  }, {theme, sampleFunction:sample.toString()});
  const website = surface === 'site';
  const rootSelector = website ? sitePanel : extPanel;
  const container = page.locator(rootSelector);
  if (website) await page.goto(origin + (version === 'before' ? '/oldsite' : '/site') + '/vpn-privacy.html#vpn-privacy-B');
  else { await page.goto(origin+'/extension'); await page.addScriptTag({url:origin+'/'+version+'.js'}); }
  const anchor = page.locator(website ? target : '#word');
  await anchor.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await anchor.click({modifiers:website ? [] : ['Alt']});
  await container.waitFor({state:'visible'});
  const term = website ? 'rolled back' : 'picked the book up';
  if (version === 'after') await container.locator('.lex-title').getByText(term,{exact:true}).waitFor();
  else if (website) await container.locator('#smart-lookup-result').getByText('Expression · '+term,{exact:true}).waitFor();
  else await container.locator('.context-expression summary').getByText('Expression · '+term,{exact:true}).waitFor();
  assert.equal(await page.evaluate(() => scrollY),y);
  return { context, page, container, anchor, y, term, errors, external };
}

try {
  for (const [name, runtime, binary] of [['Chromium',chromium,process.env.CHROMIUM_PATH],['WebKit',webkit,process.env.WEBKIT_PATH]]) {
    const browser = await runtime.launch({executablePath:binary});
    try {
      for (const surface of ['site','extension']) {
        const sizes = name === 'Chromium' ? [[1440,900],[390,844],[320,600],[844,390]] : [[1280,850],[390,844]];
        for (const size of sizes) {
          for (const [theme, scheme] of [['light','dark'],['dark','light'],['system','dark'],['system','light']]) {
            const device = size[0] < 500 || size[1] < 500;
            const s = await open(browser,surface,'after',theme,scheme,size);
            try {
              const panel = s.container.locator('.lex-panel');
              const bounds = await s.container.boundingBox();
              assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= size[0]+1 && bounds.y+bounds.height <= size[1]+1);
              const actual = await panel.evaluate(root => ({
                color:getComputedStyle(root).backgroundColor, layout:root.dataset.layout,
                hit:root.querySelector('button[aria-label="Close dictionary"]').getBoundingClientRect().height,
                noOverflow:root.querySelector('.lex-scroll').scrollWidth<=root.querySelector('.lex-scroll').clientWidth+1,
              }));
              assert.equal(actual.color,(theme==='dark' || theme==='system' && scheme==='dark')?'rgb(23, 25, 23)':'rgb(248, 248, 245)');
              assert.equal(actual.layout,device?'sheet':'anchored');
              assert.ok(actual.noOverflow);
              assert.equal(await s.page.locator('.lex-aware,taslexicon-highlight').count(),0);
              if (device) {
                assert.ok(actual.hit>=44);
                if (name === 'Chromium' && size[0] === 390 && theme === 'dark') {
                  await s.page.screenshot({path:resolve(output,surface+'-390x844-dark-compact-after.png')});
                }
                await panel.getByRole('button',{name:'Expand dictionary sheet'}).click();
                await s.page.waitForFunction(({ selector, height }) =>
                  document.querySelector(selector).getBoundingClientRect().height > height,
                { selector: surface === 'site' ? sitePanel : extPanel, height: bounds.height });
                assert.equal(await s.page.evaluate(() => scrollY),s.y);
              }
              const key = `${surface}-${size.join('x')}-${theme}-${scheme}`;
              if (name==='Chromium' && ((size[0]===1440 && theme==='light') || (size[0]===390 && theme==='dark'))) {
                const old = await open(browser,surface,'before',theme,scheme,size);
                await old.page.screenshot({path:resolve(output,key+'-before.png')});
                await old.context.close();
                await s.page.screenshot({path:resolve(output,key+'-after.png')});
              }
              if (name==='Chromium' && size[0]===1440 && theme==='light') {
                const subject = await s.container.elementHandle();
                const swap = panel.getByRole('button',{name:'Show selected word'});
                await swap.click();
                assert.notEqual(await panel.locator('.lex-title').textContent(),s.term);
                await panel.getByRole('button',{name:'Show expression'}).click();
                assert.equal(await panel.locator('.lex-title').textContent(),s.term);
                const nested = panel.locator('.lex-lookup');
                await nested.locator('summary').click();
                await nested.getByRole('searchbox').fill('assumption');
                await nested.getByRole('button',{name:'Look up',exact:true}).click();
                await panel.locator('.lex-title').getByText('assumption',{exact:true}).waitFor();
                await panel.getByRole('button',{name:'Back to previous lookup'}).click();
                assert.equal(await panel.locator('.lex-title').textContent(),s.term);
                assert.equal(await subject.evaluate((node,selector)=>node===document.querySelector(selector),surface==='site'?sitePanel:extPanel),true);
                await panel.getByRole('combobox',{name:'Playback speed'}).selectOption('0.75');
                await panel.getByRole('button',{name:'Pronounce in British English'}).click();
                assert.deepEqual(await s.page.evaluate(()=>testCalls.at(-1)),[s.term,'en-GB',0.75]);
                if (surface==='site') {
                  await panel.getByText('Dictionary settings and saved entries',{exact:true}).click();
                  await panel.getByRole('checkbox',{name:'Mark detected expressions'}).check();
                  assert.equal(await s.page.locator('.lex-aware').count(),2);
                  await panel.getByRole('button',{name:'Save locally'}).click();
                  assert.equal(await s.page.evaluate(()=>JSON.parse(localStorage.getItem('vocab.lookup.saved'))[0]),s.term);
                } else {
                  await panel.getByRole('button',{name:'Save',exact:true}).click();
                  assert.equal(await s.page.evaluate(()=>testCalls.at(-1)?.content.text),s.term);
                  await s.page.keyboard.press('F8');
                  assert.equal(await s.page.evaluate(()=>document.activeElement.localName),'taslexicon-lookup');
                }
                await s.page.keyboard.press('Escape');
                await s.container.waitFor({state:'hidden'});
                assert.equal(await s.page.evaluate(() => scrollY),s.y);
              }
              assert.deepEqual(s.errors,[]);
              assert.deepEqual(s.external,[]);
              report.push({browser:name,version:browser.version(),surface,theme,scheme,size,...actual});
              console.log('PASS',name,key);
            } finally { await s.context.close(); }
          }
        }
      }
    } finally { await browser.close(); }
  }
  await writeFile(resolve(output,'browser-matrix.json'),JSON.stringify(report,null,2)+'\n');
} finally { server.close(); }
