[![CodeQL](https://github.com/beykansen/sesssion-authentication-worker/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/beykansen/sesssion-authentication-worker/actions/workflows/codeql-analysis.yml)

# Cloudflare Session Authentication Worker

This worker uses both cookie and basic authentication by creating a `__session` cookie and encrypts with `AES-CBC` after initial login via basic authentication.
While the cookie is valid, the annoying browser basic authentication popup won't be triggered again even you close browser or device like in normal session based authentications.

Also, you can visit `https://{WORKER_URL}/logout` page for manually logout and deleting cookie.

:warning: **Use with caution**. This worker is not meant to be replaced your trusted authentication mechanism. It just may be useful for non-critical back office applications or dashboards.

#### How to use:

1. Change worker `name` in `wrangler.toml` according to your worker.
2. Create environment variables that you see below.
3. Type `wranger publish` from your favorite terminal.
4. (Optional) Change cookie `MAX_AGE`, name and basic authentication `REALM` in `src/index.ts`.

##### Create These Environment Variables via Cloudflare Dashboard:

1. `USERNAME`: for admin username
2. `PASSWORD`: for admin password
3. `SECRET_KEY`: for cookie encryption.

##### Guides:

- [Get Started To Workers](https://developers.cloudflare.com/workers/get-started/guide/)
- [Creating environment variables](https://developers.cloudflare.com/workers/platform/environment-variables/#:~:text=Add%20environment%20variables%20by%20logging,Add%20variable%20under%20Environment%20Variables.)
