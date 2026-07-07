/**
 * A minimal superagent-compatible mock module, built to work correctly whether
 * it is consumed:
 *  - wrapped by superagent-promise (original agent.js does
 *    `superagentPromise(_superagent, Promise)`, which subclasses our exported
 *    `Request` and only ever calls `.end(cb)` on it through a captured
 *    reference to `Request.prototype.end`), or
 *  - used directly/natively (a migrated agent.js calling `.then()` on the
 *    request object we return from get/post/put/del).
 *
 * Every request records {method, url, headers, body} into `calls` at the
 * moment `.end()` actually runs (i.e. after the full chain has been built).
 */
import { vi } from 'vitest';

export function createSuperagentMock() {
  const calls = [];
  let nextResponse = { body: { ok: true } };
  let nextError = null;

  function Request(method, url) {
    this.method = method;
    this.url = url;
    this.headers = {};
    this._body = undefined;
    this._query = undefined;
  }

  Request.prototype.use = function (fn) {
    fn(this);
    return this;
  };

  Request.prototype.set = function (key, value) {
    this.headers[key] = value;
    return this;
  };

  Request.prototype.send = function (body) {
    this._body = body;
    return this;
  };

  Request.prototype.query = function (q) {
    this._query = q;
    return this;
  };

  // Node-callback style, matching real superagent's Request.prototype.end
  // signature exactly -- superagent-promise captures and calls this directly.
  Request.prototype.end = function (cb) {
    calls.push({
      method: this.method,
      url: this.url,
      headers: { ...this.headers },
      body: this._body,
      query: this._query,
    });
    if (nextError) {
      cb(nextError);
    } else {
      cb(null, nextResponse);
    }
    return this;
  };

  // Native-thenable support, for a migrated agent that calls `.then()`
  // directly on the request without superagent-promise in between.
  Request.prototype.then = function (resolve, reject) {
    return new Promise((accept, reject_) => {
      this.end((err, res) => {
        if (err) reject_(err);
        else accept(res);
      });
    }).then(resolve, reject);
  };

  function method(verb) {
    return (url, data) => {
      const req = new Request(verb, url);
      if (data !== undefined) req.send(data);
      return req;
    };
  }

  const mod = {
    Request,
    get: method('GET'),
    post: method('POST'),
    put: method('PUT'),
    del: method('DELETE'),
    delete: method('DELETE'),
    patch: method('PATCH'),
  };

  return {
    module: mod,
    calls,
    setResponse(body) {
      nextResponse = { body };
      nextError = null;
    },
    setError(err) {
      nextError = err;
      nextResponse = { body: { ok: true } };
    },
    reset() {
      calls.length = 0;
      nextResponse = { body: { ok: true } };
      nextError = null;
    },
  };
}
