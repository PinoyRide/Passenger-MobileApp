import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

// The screen a person sees while the app starts is native (android
// LaunchScreen.kt): it is there before any JavaScript runs. It and the
// JavaScript side have to agree on a few names. Nothing fails loudly when
// they do not (the screen then leaves late, or says nothing), so they are
// checked here.

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');

const find = (dir, name) => {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      const found = find(path, name);
      if (found) {
        return found;
      }
    } else if (entry.name === name) {
      return path;
    }
  }
  return null;
};

const SOURCES = 'android/app/src/main/java';
const RES = 'android/app/src/main/res';
const launchScreen = read(find(SOURCES, 'LaunchScreen.kt'));
const layout = read(`${RES}/layout/launch_screen.xml`);

test('the app marks its root view with the name the launch screen waits for', () => {
  const waitedFor = (launchScreen.match(
    /const val APP_ROOT_NATIVE_ID = "([^"]+)"/,
  ) || [])[1];
  assert.ok(waitedFor, 'LaunchScreen.kt names the view it waits for');
  const marked = [...read('App.js').matchAll(/nativeID="([^"]+)"/g)].map(
    m => m[1],
  );
  assert.deepEqual(marked, [waitedFor]);
});

test('the activity puts the launch screen up, and takes it down with itself', () => {
  const activity = read(find(SOURCES, 'MainActivity.kt'));
  assert.match(activity, /launchScreen = LaunchScreen\.show\(this\)/);
  assert.match(activity, /launchScreen\?\.dispose\(\)/);
  // after super.onCreate: the window has to exist
  assert.ok(
    activity.indexOf('super.onCreate(null)') <
      activity.indexOf('LaunchScreen.show(this)'),
  );
});

test('every view, sentence, colour and picture the launch screen uses exists', () => {
  const strings = read(`${RES}/values/strings.xml`);
  const colors = read(`${RES}/values/colors.xml`);
  const uses = (text, kind) => [
    ...new Set(
      [...text.matchAll(new RegExp(`(?<![.\\w])${kind}([a-z_]+)`, 'g'))].map(
        m => m[1],
      ),
    ),
  ];

  for (const id of uses(launchScreen, 'R\\.id\\.')) {
    assert.ok(layout.includes(`android:id="@+id/${id}"`), `view ${id}`);
  }
  for (const name of [
    ...uses(launchScreen, 'R\\.string\\.'),
    ...uses(layout, '@string/'),
  ]) {
    assert.ok(strings.includes(`<string name="${name}">`), `sentence ${name}`);
  }
  for (const name of uses(layout, '@color/')) {
    assert.ok(colors.includes(`<color name="${name}">`), `colour ${name}`);
  }
  for (const name of uses(layout, '@drawable/')) {
    const files = readdirSync(join(root, RES), { recursive: true }).map(String);
    assert.ok(
      files.some(file =>
        new RegExp(`drawable[^/]*/${name}\\.(xml|png)$`).test(file),
      ),
      `picture ${name}`,
    );
  }
  assert.ok(uses(launchScreen, 'R\\.layout\\.').includes('launch_screen'));
  assert.ok(uses(launchScreen, 'R\\.font\\.').includes('poppins_regular'));
  readFileSync(join(root, RES, 'font/poppins_regular.ttf'));
});

test('the three sentences are the ones a person can act on', () => {
  const strings = read(`${RES}/values/strings.xml`);
  const sentence = name =>
    (strings.match(new RegExp(`<string name="${name}">([^<]+)</string>`)) ||
      [])[1];
  assert.equal(sentence('launch_checking'), 'Checking for updates…');
  assert.equal(sentence('launch_downloading'), 'Downloading the update…');
  assert.equal(sentence('launch_starting'), 'Starting…');
});

test('the sentence only moves forward: checking, downloading, starting', () => {
  // The update library stops reporting a download when it is in, before the
  // app starts; the screen asks it every LOOK_EVERY_MS, so without this it
  // went back to "Checking for updates…" (UPD-03).
  const order = (launchScreen.match(
    /private val inOrder = intArrayOf\(([^)]+)\)/,
  ) || [])[1];
  assert.ok(order, 'LaunchScreen.kt lists the sentences in order');
  assert.deepEqual(
    order.split(',').map(s => s.trim()),
    [
      'R.string.launch_checking',
      'R.string.launch_downloading',
      'R.string.launch_starting',
    ],
  );
  const say = launchScreen.slice(launchScreen.indexOf('private fun say('));
  assert.match(
    say.slice(0, say.indexOf('said = text')),
    /inOrder\.indexOf\(text\) < inOrder\.indexOf\(said\)\) \{\s+return/,
  );
  // every sentence goes through say()
  assert.equal(launchScreen.match(/\.setText\(/g).length, 1);
});

test('the window is the launch screen colour before anything is drawn', () => {
  const styles = read(`${RES}/values/styles.xml`);
  const splash = styles.slice(styles.indexOf('name="Theme.App.SplashScreen"'));
  assert.match(
    splash.slice(0, splash.indexOf('</style>')),
    /android:windowBackground">@color\/launch_background</,
  );
  assert.match(layout, /android:background="@color\/launch_background"/);
});

test('the logo is drawn as large as the app draws it on its own first screen', () => {
  const [, width, height] = layout.match(
    /android:id="@\+id\/launch_logo"\s+android:layout_width="(\d+)dp"\s+android:layout_height="(\d+)dp"/,
  );
  const splash = read('src/Screens/SplashScreen/SplashScreen.js');
  assert.match(splash, new RegExp(`width: ${width},\\s+height: ${height},`));
  assert.match(layout, /android:layout_centerInParent="true"/);
});

test('the loading screen stays up through the whole wait for an update', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const wait = Number(
    /EXPO_UPDATES_LAUNCH_WAIT_MS" android:value="(\d+)"/.exec(manifest)[1],
  );
  const kotlin = read('android/app/src/main/java/com/pinoyride/customer/LaunchScreen.kt');
  const giveUp = Number(/GIVE_UP_MS = (\d+)L/.exec(kotlin)[1]);
  // the wait, then the app's own start, before the screen gives up
  assert.ok(giveUp >= wait + 10000, `gives up at ${giveUp} ms, waits ${wait} ms`);
});
