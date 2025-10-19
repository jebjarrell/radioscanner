#!/usr/bin/env node
/**
 * scripts/test-services.js
 * Quick doctor script to verify local services:
 *  - rtl_tcp banner (TCP 1234)
 *  - dump1090 HTTP JSON (/data/aircraft.json)
 *  - Kismet status (/system/status.json)
 *  - gpsd TCP (2947) minimal probe
 *
 * Env overrides:
 *   RTL_TCP_HOST, RTL_TCP_PORT (default 127.0.0.1:1234)
 *   DUMP1090_URL (default http://127.0.0.1:8080/data/aircraft.json)
 *   KISMET_URL (default http://127.0.0.1:2501/system/status.json)
 *   GPSD_HOST, GPSD_PORT (default 127.0.0.1:2947)
 */

const net = require('net');
const { setTimeout: delay } = require('timers/promises');

const RTL_TCP_HOST = process.env.RTL_TCP_HOST || '127.0.0.1';
const RTL_TCP_PORT = Number(process.env.RTL_TCP_PORT || 1234);

const DUMP1090_URL = process.env.DUMP1090_URL || 'http://127.0.0.1:8080/data/aircraft.json';
const KISMET_URL = process.env.KISMET_URL || 'http://127.0.0.1:2501/system/status.json';

const GPSD_HOST = process.env.GPSD_HOST || '127.0.0.1';
const GPSD_PORT = Number(process.env.GPSD_PORT || 2947);

async function testTcp(host, port, label, readBytes = 64) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 1500 }, () => {
      socket.once('data', (buf) => {
        console.log(`✅ ${label}: connected (${host}:${port}), ${buf.length} bytes`);
        socket.destroy();
        resolve(true);
      });
      // in case no banner, still OK after connect
      setTimeout(() => {
        console.log(`✅ ${label}: connected (${host}:${port}), no banner`);
        socket.destroy();
        resolve(true);
      }, 500).unref();
    });
    socket.on('error', (err) => {
      console.log(`⚠️  ${label}: ${host}:${port} error: ${err.code || err.message}`);
      resolve(false);
    });
    socket.on('timeout', () => {
      console.log(`⚠️  ${label}: ${host}:${port} timeout`);
      socket.destroy();
      resolve(false);
    });
  });
}

async function testHttp(url, label) {
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      console.log(`⚠️  ${label}: ${url} HTTP ${res.status}`);
      return false;
    }
    if (url.endsWith('.json')) {
      await res.json();
    } else {
      await res.text();
    }
    console.log(`✅ ${label}: ${url} OK`);
    return true;
  } catch (err) {
    console.log(`⚠️  ${label}: ${url} error: ${err.message}`);
    return false;
  }
}

(async () => {
  console.log('--- Service Doctor ---');
  const rtl = await testTcp(RTL_TCP_HOST, RTL_TCP_PORT, 'rtl_tcp');
  await delay(50);
  const dump = await testHttp(DUMP1090_URL, 'dump1090 JSON');
  await delay(50);
  const kis = await testHttp(KISMET_URL, 'Kismet status');
  await delay(50);
  const gps = await testTcp(GPSD_HOST, GPSD_PORT, 'gpsd');

  const ok = rtl && dump && kis && gps;
  console.log('----------------------');
  console.log(ok ? '✅ All checks passed' : '⚠️  One or more checks failed');
  process.exit(ok ? 0 : 1);
})();
