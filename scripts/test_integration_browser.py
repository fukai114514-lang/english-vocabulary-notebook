"""Cross-feature checks. Run with Python Playwright and its Chromium, or set CHROMIUM_PATH."""

import json
import os
import tempfile
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


class StaticFiles(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


# Hold utterances open so that cancellation and changes of owner can be observed.
PROBES = """
window.spoken = [];
window.interruptions = 0;
Object.defineProperty(window, 'speechSynthesis', {value: {
    getVoices: () => ['en-US', 'en-GB'].map(lang => ({ lang, localService: true })),
    speak: u => spoken.push({text:u.text, lang:u.lang, rate:u.rate}),
    cancel: () => { interruptions++; }
}});
Object.defineProperty(window, 'SpeechSynthesisUtterance', {value: class {
    constructor(text) { this.text = text; }
}});
"""


class IntegratedUI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        folder = tempfile.TemporaryDirectory()
        cls.addClassCleanup(folder.cleanup)
        root = Path(folder.name)
        prefix = 'english-vocabulary-notebook'
        (root / prefix).symlink_to(Path(__file__).resolve().parents[1] / 'dist', target_is_directory=True)
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(StaticFiles, directory=root))
        cls.addClassCleanup(server.server_close)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        cls.addClassCleanup(server.shutdown)
        cls.url = f'http://127.0.0.1:{server.server_port}/{prefix}/'
        runtime = sync_playwright().start()
        cls.addClassCleanup(runtime.stop)
        cls.browser = runtime.chromium.launch(
            executable_path=os.getenv('CHROMIUM_PATH'),
            args=['--disable-dev-shm-usage'],
        )
        cls.addClassCleanup(cls.browser.close)

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 320, 'height': 568},
                                                reduced_motion='reduce')
        self.addCleanup(self.context.close)
        self.context.add_init_script(PROBES)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.addCleanup(self.assertEqual, self.errors, [])
        self.panel = self.page.locator('#sentence-practice')
        self.status = self.panel.get_by_role('status')
        self.dialog = self.page.locator('#search-dialog')

    def reader(self):
        self.page.goto(self.url + 'nap.html#nap-A')
        expect(self.page.locator('#nap-A .lookup-word').first).to_be_visible()

    def practice(self):
        self.page.locator('.practice-trigger').first.click()
        expect(self.panel).to_be_visible()

    def action(self, name):
        self.panel.get_by_role('button', name=name, exact=True).click()

    def test_sentence_practice_has_no_recording_controls(self):
        self.context.add_init_script("""
            window.microphoneRequests = 0;
            navigator.mediaDevices.getUserMedia = async () => {
                window.microphoneRequests++;
                throw Error('Unexpected microphone request');
            };
        """)
        self.reader()
        self.practice()
        expect(self.panel.get_by_role('button')).to_have_count(3)
        self.action('Listen to the sentence')
        expect(self.status).to_contain_text('Reading aloud.')
        self.action('Stop reading aloud')
        expect(self.status).to_have_text('Reading stopped.')
        self.action('Repeat the sentence')
        expect(self.status).to_contain_text('Reading aloud.')
        self.assertEqual(self.page.evaluate('microphoneRequests'), 0)

    def test_dictionary_hands_focus_and_audio_to_search(self):
        self.reader()
        self.practice()
        self.panel.get_by_role('combobox', name='Voice', exact=True).select_option('en-GB')
        self.panel.get_by_role('combobox', name='Speed', exact=True).select_option('0.75')
        self.action('Listen to the sentence')
        self.action('Repeat the sentence')
        sentence = self.page.locator('.practice-quote').text_content()
        self.assertEqual(self.page.evaluate('spoken'), [{'text': sentence, 'lang': 'en-GB', 'rate': 0.75}] * 2)
        self.assertNotRegex(sentence, r'[\u4e00-\u9fff]')
        word = self.page.locator('#nap-A .lookup-word').first
        word.click()
        dictionary = self.page.locator('#lookup-card')
        expect(dictionary).to_be_visible()
        self.assertEqual(self.page.evaluate('interruptions'), 2)
        dictionary.locator('.lookup-speech').click()
        y = self.page.evaluate('scrollY')
        self.page.keyboard.press('Meta+k')
        expect(self.dialog).to_be_visible()
        expect(dictionary).to_be_hidden()
        self.assertEqual(self.page.evaluate('interruptions'), 3)
        self.page.keyboard.press('Escape')
        expect(word).to_be_focused()
        self.assertEqual(self.page.evaluate('scrollY'), y)
        self.page.reload()
        self.practice()
        expect(self.panel.get_by_role('combobox', name='Voice', exact=True)).to_have_value('en-GB')
        expect(self.panel.get_by_role('combobox', name='Speed', exact=True)).to_have_value('0.75')

    def test_sidebar_links_open_independent_learning_parts(self):
        self.page.goto(self.url)
        nav = self.page.get_by_role('navigation', name='Main navigation')
        links = nav.locator('.learning-nav-link')
        expect(links).to_have_count(8)
        for name in ('Word Families', 'Collocations', 'Word Patterns', 'Phrasal Verbs',
                     'Common Mistakes', 'Register & Tone', 'Idioms & Expressions', 'Pronunciation Lab'):
            self.page.get_by_role('button', name='Expand navigation').click()
            link = nav.get_by_role('link', name=name, exact=True)
            expect(link.locator('span')).to_be_visible()
            self.assertGreaterEqual(link.bounding_box()['height'], 44)
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth === innerWidth'))
            link.click()
            expect(self.page.get_by_role('heading', name=name, exact=True)).to_be_visible()
            expect(nav.get_by_role('link', name=name, exact=True)).to_have_attribute('aria-current', 'page')
            if name == 'Collocations':
                data = Path(__file__).resolve().parents[1] / 'content/learning-parts/collocations.json'
                expected = json.loads(data.read_text())['entries']
                entries = self.page.get_by_role('region', name='Article collocations').get_by_role('link')
                expect(entries).to_have_count(len(expected))
                first = expected[0]
                expect(entries.first).to_contain_text(first['phrase'])
                expect(entries.first).to_have_attribute('href', f"{first['article']}.html#{first['article']}-{first['paragraph']}")
            else:
                expect(self.page.get_by_role('heading', name='No entries yet.')).to_be_visible()

    def test_home_returns_to_top_from_library_index(self):
        self.page.goto(self.url + 'index.html#home')
        nav = self.page.get_by_role('navigation', name='Main navigation')
        library = self.page.locator('#library-title')
        nav.get_by_role('link', name='Library index').click()
        expect(library).to_be_focused()
        self.assertGreater(self.page.evaluate('scrollY'), 0)
        nav.get_by_role('link', name='Home', exact=True).click()
        self.page.wait_for_url('**/index.html#home')
        self.page.wait_for_function('scrollY === 0')
        self.page.go_back()
        self.page.wait_for_url('**/index.html#library-title')
        expect(library).to_be_focused()
        self.page.go_forward()
        self.page.wait_for_url('**/index.html#home')
        self.page.wait_for_function('scrollY === 0')

    def test_consecutive_lookups_reuse_open_dictionary(self):
        self.reader()
        words = self.page.locator('#nap-A .lookup-word')
        first, second = words.nth(0), words.nth(1)
        dictionary = self.page.locator('#lookup-card')
        first.click()
        expect(dictionary).to_be_visible()
        first_title = dictionary.locator('#lookup-title').text_content()
        scroll_y = self.page.evaluate('scrollY')
        dictionary.evaluate("""
            panel => {
                window.dictionaryChanges = [];
                const observer = new MutationObserver(records =>
                    window.dictionaryChanges.push(...records));
                observer.observe(panel, {attributes: true, attributeFilter: ['open']});
            }
        """)
        second.click()
        expect(second).to_have_attribute('aria-expanded', 'true')
        expect(first).not_to_have_attribute('aria-expanded', 'true')
        expect(dictionary.locator('#lookup-title')).not_to_have_text(first_title)
        expect(dictionary).to_be_visible()
        self.assertEqual(self.page.evaluate('window.dictionaryChanges.length'), 0)
        self.assertEqual(self.page.evaluate('scrollY'), scroll_y)

    def test_shared_reader_index_routes_and_history(self):
        requests = []
        self.page.on('request', lambda request: requests.append(request.url)
                     if request.url.endswith('/search-index.json') else None)
        pending = []
        self.page.route('**/search-index.json', lambda route: pending.append(route))
        self.page.goto(self.url + 'index.html#nap-A')
        self.page.wait_for_url('**/nap.html#nap-A')
        self.page.keyboard.press('Control+k')
        query = self.page.locator('#search')
        results = self.page.locator('#search-groups a')
        query.fill('学分')
        expect(self.page.locator('#search-status')).to_contain_text('Loading')
        self.assertEqual(len(pending), 1)
        pending[0].continue_()
        self.page.unroute('**/search-index.json')
        expect(results.first).to_be_visible()
        self.assertEqual(len(requests), 1)
        query.fill('creidt')
        suggestion = self.dialog.get_by_role('button', name='Did you mean: credit?')
        expect(suggestion).to_be_visible()
        expect(query).to_have_value('creidt')
        suggestion.click()
        self.dialog.get_by_role('button', name='Word Meanings', exact=True).click()
        expect(query).to_have_value('credit')
        query.focus()
        self.page.keyboard.press('Enter')
        self.page.wait_for_url('**/index.html#sense-credit-*')
        expect(self.page.locator('#poly-credit')).to_have_attribute('open', '')
        self.page.go_back()
        self.page.wait_for_url('**/nap.html#nap-A')
        expect(self.dialog).to_be_hidden()
        self.page.go_forward()
        expect(self.page.locator('#poly-credit')).to_have_attribute('open', '')

    def test_retry_index_after_network_failure(self):
        attempts = []
        def serve_index(route):
            attempts.append(route.request.url)
            if len(attempts) == 1:
                route.fulfill(status=503)
            else:
                route.continue_()
        self.page.route('**/search-index.json', serve_index)
        self.page.goto(self.url + 'index.html')
        self.page.keyboard.press('Control+k')
        self.page.locator('#search').fill('credits')
        expect(self.page.locator('#search-status')).to_have_text('Could not load search. Close and try again.')
        self.page.keyboard.press('Escape')
        self.page.keyboard.press('Control+k')
        expect(self.page.locator('#search-groups a').first).to_have_text('credit')
        self.assertEqual(len(attempts), 2)

    def test_reference_controls_fit_and_stop_on_navigation(self):
        self.page.goto(self.url + 'index.html')
        for view in ('original', 'poly', 'phrases'):
            self.page.locator(f'.primary-nav [data-view="{view}"]').click()
            entry = self.page.locator('#list > details:visible').first
            entry.locator(':scope > summary').click()
            entry.locator('.practice-trigger').first.click()
            self.action('Listen to the sentence')
            self.assertNotRegex(self.page.evaluate('spoken.at(-1).text'), r'[\u4e00-\u9fff]')
            fits = self.panel.evaluate("""p => {
                const right = document.documentElement.clientWidth;
                const left = document.querySelector('.sidebar').getBoundingClientRect().right;
                return document.documentElement.scrollWidth === right &&
                    [...p.querySelectorAll('button, select')].filter(c => c.offsetWidth).every(c => {
                        const r = c.getBoundingClientRect();return r.left >= left && r.right <= right;
                    });
            }""")
            self.assertTrue(fits, view)
            self.page.locator('.primary-nav [data-view="home"]').click()
            expect(self.panel).to_have_count(0)
        self.assertEqual(self.page.evaluate('interruptions'), 3)

    def test_opening_another_meaning_stops_the_old_sentence(self):
        self.page.goto(self.url + 'index.html#poly-heading')
        entries = self.page.locator('#list > .poly-entry')
        first, second = entries.nth(0), entries.nth(1)
        first.locator(':scope > summary').click()
        first.locator('.practice-trigger').first.click()
        self.action('Listen to the sentence')
        second.locator(':scope > summary').click()
        expect(self.page.locator('#list > .poly-entry[open]')).to_have_count(1)
        expect(second).to_have_attribute('open', '')
        expect(self.panel).to_have_count(0)
        self.assertEqual(self.page.evaluate('interruptions'), 1)
        second.locator('.practice-trigger').first.click()
        self.action('Listen to the sentence')
        self.assertEqual(self.page.evaluate('spoken.length'), 2)

    def test_landscape_safe_area_with_search_and_dictionary(self):
        self.page.set_viewport_size({'width': 844, 'height': 390})
        self.context.new_cdp_session(self.page).send('Emulation.setSafeAreaInsetsOverride', {
            'insets': {'top': 0, 'left': 44, 'right': 44, 'bottom': 21}
        })
        self.reader()
        word = self.page.locator('#nap-A .lookup-word').first
        word.click()
        rail = self.page.locator('.sidebar').bounding_box()
        panel = self.page.locator('#lookup-card').bounding_box()
        self.assertAlmostEqual(rail['width'] - 44, 50, delta=1)
        self.assertGreaterEqual(panel['x'], rail['width'])
        self.assertLessEqual(panel['x'] + panel['width'], 800)
        self.page.keyboard.press('Control+k')
        rect = self.dialog.bounding_box()
        self.assertGreaterEqual(rect['x'], 44)
        self.assertLessEqual(rect['x'] + rect['width'], 800)
        self.assertLessEqual(rect['y'] + rect['height'], 369)


if __name__ == '__main__':
    unittest.main(verbosity=2)
