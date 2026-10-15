import type { WebViewMessageEvent } from 'react-native-webview';

import { printHtml } from '@/lib/print';
import { shareBase64File } from '@/lib/share-file';

/**
 * Injected into website pages shown in the app. A WebView can't print, open pop-up windows or save
 * blob downloads, which the website's ID card / certificate tools rely on, so this hands them to the
 * app instead:
 * - window.print()          -> the page (canvases turned into images) goes to the system print sheet
 * - window.open('') + write  -> the written print preview goes to the system print sheet
 * - <a download href=blob:>  -> the file goes to the share sheet (jsPDF .save(), ZIP downloads)
 */
export const FILE_BRIDGE_SCRIPT = `(function () {
  if (window.__appBridge) return; window.__appBridge = true;
  function post(msg) { try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {} }
  function withBase(html) {
    var base = '<base href="' + location.origin + '/">';
    return /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, '<head$1>' + base) : base + html;
  }
  function snapshot() {
    var clone = document.documentElement.cloneNode(true);
    var live = document.querySelectorAll('canvas'), copies = clone.querySelectorAll('canvas');
    for (var i = 0; i < live.length && i < copies.length; i++) {
      try {
        var img = document.createElement('img');
        img.src = live[i].toDataURL('image/png');
        img.setAttribute('style', copies[i].getAttribute('style') || '');
        img.width = live[i].width; img.height = live[i].height;
        copies[i].parentNode.replaceChild(img, copies[i]);
      } catch (e) {}
    }
    clone.querySelectorAll('script').forEach(function (s) { s.remove(); });
    return withBase('<!DOCTYPE html>' + clone.outerHTML);
  }
  function sendFile(url, name) {
    fetch(url).then(function (r) { return r.blob(); }).then(function (blob) {
      var reader = new FileReader();
      reader.onload = function () {
        var data = String(reader.result || '');
        post({ type: 'file', name: name || 'download', mime: blob.type || 'application/octet-stream', data: data.slice(data.indexOf(',') + 1) });
      };
      reader.readAsDataURL(blob);
    }).catch(function () { post({ type: 'error' }); });
  }
  function handleUrl(url, name) {
    if (!url) return false;
    if (url.indexOf('blob:') === 0 || url.indexOf('data:') === 0) { sendFile(url, name); return true; }
    return false;
  }
  window.print = function () { post({ type: 'print', html: snapshot() }); };
  var origOpen = window.open;
  window.open = function (url) {
    if (url && url !== 'about:blank') {
      if (handleUrl(url, 'document.pdf')) return null;
      return origOpen.apply(window, arguments);
    }
    var html = '', timer = null;
    function flush() { if (html) post({ type: 'print', html: withBase(html) }); html = ''; }
    function later() { clearTimeout(timer); timer = setTimeout(flush, 400); }
    var fake = {
      closed: false,
      document: { write: function (s) { html += s; later(); }, writeln: function (s) { html += s + '\\n'; later(); }, open: function () {}, close: function () { later(); }, title: '' },
      print: function () { clearTimeout(timer); flush(); },
      focus: function () {}, close: function () { fake.closed = true; },
      addEventListener: function () {}, removeEventListener: function () {},
    };
    var loc = {};
    Object.defineProperty(loc, 'href', { set: function (u) { handleUrl(u, 'document.pdf'); }, get: function () { return 'about:blank'; } });
    loc.assign = loc.replace = function (u) { handleUrl(u, 'document.pdf'); };
    fake.location = loc;
    return fake;
  };
  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if ((this.hasAttribute('download') || (this.href || '').indexOf('blob:') === 0) && handleUrl(this.href, this.getAttribute('download'))) return;
    return click.apply(this, arguments);
  };
  var dispatch = HTMLAnchorElement.prototype.dispatchEvent;
  HTMLAnchorElement.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === 'click' && this.hasAttribute('download') && handleUrl(this.href, this.getAttribute('download'))) return true;
    return dispatch.apply(this, arguments);
  };
})(); true;`;

const SAFE_NAME = /[^\w.\- ]+/g;

/** Handles messages posted by FILE_BRIDGE_SCRIPT. Returns an error key for the caller to toast, if any. */
export async function handleBridgeMessage(e: WebViewMessageEvent): Promise<'print-failed' | 'file-failed' | null> {
  let msg: { type?: string; html?: string; name?: string; mime?: string; data?: string };
  try {
    msg = JSON.parse(e.nativeEvent.data);
  } catch {
    return null;
  }
  try {
    if (msg.type === 'print' && typeof msg.html === 'string') {
      await printHtml(msg.html);
      return null;
    }
    if (msg.type === 'file' && typeof msg.data === 'string') {
      const name = (msg.name || 'download').replace(SAFE_NAME, '_').slice(0, 120) || 'download';
      await shareBase64File(name, msg.data, msg.mime || 'application/octet-stream');
      return null;
    }
    if (msg.type === 'error') return 'file-failed';
  } catch {
    return msg.type === 'print' ? 'print-failed' : 'file-failed';
  }
  return null;
}
