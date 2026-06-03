/**
 * Patches Node.js DNS resolution for NixOS + Tailscale environments.
 *
 * Tailscale sets the system DNS resolver to 100.100.100.100, which refuses
 * to resolve external domains. `curl` works because it uses c-ares, but
 * Node.js uses libc `getaddrinfo` which goes through the system resolver.
 *
 * This file monkey-patches `dns.lookup` to fall back to Google Public DNS
 * (via `dns.resolve4`) when the system resolver fails with ENOTFOUND.
 */
import dns from 'node:dns';

const originalLookup = dns.lookup;

dns.lookup = function patchedLookup(hostname, optionsOrCb, maybeCb) {
  // Normalise arguments — dns.lookup has overloaded signatures
  let options;
  let callback;
  if (typeof optionsOrCb === 'function') {
    options = {};
    callback = optionsOrCb;
  } else {
    options = optionsOrCb ?? {};
    callback = maybeCb;
  }

  // First, try the default system resolver
  originalLookup.call(dns, hostname, options, (err, address, family) => {
    if (!err) {
      callback(null, address, family);
      return;
    }

    // If system resolver fails, fall back to explicit DNS resolution
    if (err.code === 'ENOTFOUND' || err.code === 'EREFUSED') {
      const resolver = new dns.Resolver();
      resolver.setServers(['8.8.8.8', '1.1.1.1']);
      resolver.resolve4(hostname, (resolveErr, addresses) => {
        if (resolveErr || !addresses?.length) {
          // Give up — return the original error
          callback(err, address, family);
          return;
        }
        callback(null, addresses[0], 4);
      });
    } else {
      callback(err, address, family);
    }
  });
};
