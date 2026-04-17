import { chromium } from 'playwright';

const baseUrl = process.env.SOVIO_QA_BASE_URL ?? 'http://127.0.0.1:8081';
const email =
  process.env.SOVIO_QA_EMAIL ??
  `sovio.test.${Date.now()}@mailinator.com`;
const password = process.env.SOVIO_QA_PASSWORD ?? 'Sovio!23456';
const skipSignup = process.env.SOVIO_QA_SKIP_SIGNUP === '1';

const screenshots = 'D:/Download/AI/Sovio/apps/mobile/qa-screens';
const avatarClickPoint = { x: 1402, y: 88 };

async function step(name, fn) {
  process.stdout.write(`\n[step] ${name}\n`);
  await fn();
}

async function isInAppHome(page) {
  const candidates = [
    page.getByText('Tonight looks easy').first(),
    page.getByText('Home').first(),
    page.getByText('Refresh').first(),
  ];

  for (const locator of candidates) {
    if (await locator.isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  geolocation: { latitude: 41.8781, longitude: -87.6298 },
  permissions: ['geolocation'],
});
const page = await context.newPage();

page.on('console', (msg) => {
  process.stdout.write(`[console:${msg.type()}] ${msg.text()}\n`);
});

page.on('pageerror', (err) => {
  process.stdout.write(`[pageerror] ${err.message}\n`);
});

page.on('response', async (response) => {
  if (response.status() >= 400) {
    process.stdout.write(`[http:${response.status()}] ${response.request().method()} ${response.url()}\n`);
  }
});

try {
  await step('open app', async () => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${screenshots}/01-entry.png`, fullPage: true });
  });

  if (!skipSignup) {
    await step('open signup', async () => {
      await page.getByText("Don't have an account? Sign up").click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${screenshots}/02-signup.png`, fullPage: true });
    });

    await step('create account', async () => {
      await page.getByPlaceholder('Your name').fill('Sovio QA');
      await page.locator('input[placeholder="you@example.com"]').last().fill(email);
      await page.getByPlaceholder('Create a password').fill(password);
      await page.getByText('Create Account').click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${screenshots}/03-post-signup.png`, fullPage: true });

      const needsConfirmation = await page.getByText('Check your inbox').isVisible().catch(() => false);
      if (needsConfirmation) {
        await page.getByText('Back to sign in').click();
        await page.waitForTimeout(1500);
      }
    });
  }

  await step('sign in', async () => {
    await page.locator('input[placeholder="you@example.com"]').first().fill(email);
    await page.getByPlaceholder('Your password').fill(password);
    await page.getByText('Sign In').click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${screenshots}/03b-post-login-attempt.png`, fullPage: true });
  });

  await step('complete onboarding', async () => {
    if (await isInAppHome(page)) {
      await page.screenshot({ path: `${screenshots}/04-home.png`, fullPage: true });
      return;
    }

    const maybeInterests = ['Coffee', 'Live music', 'Walks', 'Brunch'];
    for (const label of maybeInterests) {
      const item = page.getByText(label).first();
      if (await item.isVisible().catch(() => false)) {
        await item.click();
      }
    }

    for (let i = 0; i < 8; i += 1) {
      if (await isInAppHome(page)) {
        break;
      }

      const continueButton = page
        .getByRole('button', {
          name: /Continue|Turn on AI help|Enable notifications|Enable location|Open Sovio|Maybe later/i,
        })
        .first();
      if (await continueButton.isVisible().catch(() => false)) {
        await continueButton.click();
        await page.waitForTimeout(1200);
      } else {
        break;
      }
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${screenshots}/04-home.png`, fullPage: true });
  });

  await step('refresh home suggestions', async () => {
    const refreshButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    if (await refreshButton.isVisible().catch(() => false)) {
      await refreshButton.click();
      await page.waitForTimeout(4000);
    }
    await page.screenshot({ path: `${screenshots}/05-home-refresh.png`, fullPage: true });
  });

  await step('visit momentum', async () => {
    const tab = page.getByText('Momentum').first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(2000);
    }

    const availableButton =
      page.getByRole('switch').first().or(page.locator('input[type="checkbox"]').first());
    if (await availableButton.isVisible().catch(() => false)) {
      await availableButton.click();
      await page.waitForTimeout(4000);
    }

    await page.screenshot({ path: `${screenshots}/06-momentum.png`, fullPage: true });
  });

  await step('visit replay and messages', async () => {
    for (const label of ['Replay', 'Messages']) {
      const tab = page.getByText(label).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(1500);
        await page.screenshot({
          path: `${screenshots}/tab-${label.toLowerCase()}.png`,
          fullPage: true,
        });
      }
    }
  });

  await step('visit notifications center', async () => {
    await page.mouse.click(avatarClickPoint.x, avatarClickPoint.y);
    await page.waitForTimeout(1200);
    await page.getByText('Notifications').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `${screenshots}/07-notifications.png`,
      fullPage: true,
    });

    const markAllRead = page.getByText('Mark all read').first();
    if (await markAllRead.isVisible().catch(() => false)) {
      await markAllRead.click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: `${screenshots}/08-notifications-read.png`,
        fullPage: true,
      });
    }
  });

  await step('visit settings and privacy', async () => {
    await page.goBack();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${screenshots}/09-settings.png`, fullPage: true });

    const privacyLink = page.getByText('Privacy').first();
    if (await privacyLink.isVisible().catch(() => false)) {
      await privacyLink.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${screenshots}/10-privacy.png`, fullPage: true });
    }
  });

  await step('visit subscription and weekly insight', async () => {
    await page.goBack();
    await page.waitForTimeout(1200);
    await page.getByText('Subscription').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `${screenshots}/11-subscription.png`,
      fullPage: true,
    });

    await page.goBack();
    await page.waitForTimeout(1200);
    await page.getByText('Notifications').first().click();
    await page.waitForTimeout(1200);
    const weeklyInsight = page.getByText('Your weekly insight is here').first();
    if (await weeklyInsight.isVisible().catch(() => false)) {
      await weeklyInsight.click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: `${screenshots}/12-weekly-insight.png`,
        fullPage: true,
      });
    }
  });

  await step('visit presence score', async () => {
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1200);
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1200);

    const presenceLink = page.getByText('Presence Score').first();
    if (!(await presenceLink.isVisible().catch(() => false))) {
      await page.mouse.click(avatarClickPoint.x, avatarClickPoint.y);
      await page.waitForTimeout(1200);
    }

    await page.getByText('Presence Score').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `${screenshots}/13-presence-score.png`,
      fullPage: true,
    });
  });

  process.stdout.write(`\n[done] QA complete for ${email}\n`);
} finally {
  await context.close();
  await browser.close();
}
