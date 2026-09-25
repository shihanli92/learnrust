# Hosting the course privately on Cloudflare

This puts the course at a web address only you (and anyone you invite) can open, with in-page **Run** buttons that work. It costs nothing: Cloudflare Pages is free, and Cloudflare Access is free for up to 50 people.

How it fits together:

```text
you ──login──▶ Cloudflare Access ──▶ Cloudflare Pages (this site)
                                          │
                     Run button ──────────┴──▶ play.rust-lang.org (compiles and runs your code)
```

There is no server of your own to maintain. Code you run is sent to the official [Rust Playground](https://play.rust-lang.org), the same service the Rust book uses for its Run buttons.

Cloudflare renames menu items from time to time. If a label below doesn't match exactly, look for the closest equivalent.

## 1. Put the site on Cloudflare Pages (about 5 minutes)

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. In the sidebar, open **Workers & Pages**, then choose **Create** → **Pages** → **Connect to Git**.
3. Authorise GitHub and pick the `learnrust` repository. You can give Cloudflare access to only this repository.
4. Use these build settings:

   | Setting | Value |
   | --- | --- |
   | Project name | `learnrust` (this becomes `learnrust.pages.dev`, or similar if the name is taken) |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `node tools/build.mjs` |
   | Build output directory | `dist` |

5. Click **Save and Deploy**. After a minute your site is live at `https://learnrust.pages.dev`.

Every push to `main` now redeploys the site automatically. Pushes to other branches get their own preview addresses.

The site is public at this point, so don't share the address yet. Step 2 locks it down.

## 2. Make it private with Cloudflare Access (about 5 minutes)

**Protect the preview addresses.** In your Pages project, go to **Settings** → **General** → **Access policy** and click **Enable access policy**. This covers the `*.learnrust.pages.dev` preview addresses.

**Protect the main address.** That setting doesn't cover the production address, so add it separately:

1. From the dashboard sidebar open **Zero Trust**. The first time, it asks you to pick a team name and a plan: choose **Free**. It may ask for a card even on the free plan; you are not charged for up to 50 users.
2. Go to **Access** → **Applications** → **Add an application** → **Self-hosted**.
3. Application name: `learnrust`. Add the domain `learnrust.pages.dev`, the address from step 1.
4. Add a policy:
   - Name: `Me`
   - Action: **Allow**
   - Include → **Emails** → your email address, plus anyone you want to invite
5. Under login methods, keep **One-time PIN** enabled. To sign in, you enter your email and Cloudflare emails you a code.
6. Save.

Open the site in a private browser window to check it. You should see a Cloudflare login page first, and the course after you enter the emailed code. The login lasts 24 hours by default.

## 3. Check that Run works

Open any lesson, change an example, and click **Run**. The output appears under the code within a few seconds. If you see "Couldn't reach the Rust Playground from this page", check your internet connection. A browser extension that blocks requests to other websites could also be the cause.

## Other ways to use the site

- **On your own computer:** open `dist/index.html` in a browser. Run buttons work there too, as long as you're online.
- **The claude.ai link:** that page can't contact other websites, so Run falls back to opening the code in the Playground in a new tab. Everything else works.

## Updating the course

Edit anything under `lessons/`, then run the build and check (see the README) and push to `main`. Cloudflare rebuilds the site within a minute. Your progress and saved code drafts are stored in your browser, so they survive updates.
