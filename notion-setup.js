#!/usr/bin/env node
// ── Notion Database Setup — JD Governance Console ──────────────────────────
// One-shot script to create JD Records and JD Versions databases under a parent page.
//
// Usage:
//   NOTION_TOKEN=ntn_xxx NOTION_PARENT_PAGE_ID=xxx node notion-setup.js
//
// Requires: Node.js 18+ (uses native fetch)

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const token = process.env.NOTION_TOKEN;
const parentPageId = process.env.NOTION_PARENT_PAGE_ID || '3378b054-c583-8157-826a-ce436e4194c7';

if (!token) {
  console.error('Error: NOTION_TOKEN environment variable is required.');
  console.error('Usage: NOTION_TOKEN=ntn_xxx node notion-setup.js');
  process.exit(1);
}

async function notionRequest(method, path, body) {
  const res = await fetch(`${NOTION_BASE}/${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${method} ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function main() {
  console.log('JD Governance Console — Notion Database Setup');
  console.log('─'.repeat(50));
  console.log(`Parent page: ${parentPageId}`);
  console.log();

  // Verify parent page is accessible
  console.log('1. Verifying parent page access...');
  try {
    await notionRequest('GET', `pages/${parentPageId}`);
    console.log('   Parent page accessible.');
  } catch (err) {
    console.error(`   Failed to access parent page: ${err.message}`);
    process.exit(1);
  }

  // Create JD Records database
  console.log('2. Creating "JD Records" database...');
  const recordsDb = await notionRequest('POST', 'databases', {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: 'JD Records' } }],
    properties: {
      Title: { title: {} },
      Status: { select: { options: [
        { name: 'Draft', color: 'gray' },
        { name: 'In Review', color: 'yellow' },
        { name: 'Approved', color: 'green' },
        { name: 'Archived', color: 'red' },
      ]}},
      Family: { select: { options: [] } },
      'Score Total': { number: { format: 'number' } },
      'Score Structure': { number: { format: 'number' } },
      'Score Bias': { number: { format: 'number' } },
      'Score EUPTD': { number: { format: 'number' } },
      Language: { select: { options: [
        { name: 'EN', color: 'blue' },
        { name: 'PL', color: 'red' },
        { name: 'ES', color: 'orange' },
      ]}},
      Source: { select: { options: [
        { name: 'Pasted', color: 'gray' },
        { name: 'Uploaded', color: 'blue' },
        { name: 'URL', color: 'purple' },
        { name: 'Blank', color: 'default' },
      ]}},
      'Source URL': { url: {} },
      'Time to First Draft (s)': { number: { format: 'number' } },
      'Time to Approved (s)': { number: { format: 'number' } },
      Iterations: { number: { format: 'number' } },
      'Flags Resolved': { number: { format: 'number' } },
    },
  });
  console.log(`   Created: ${recordsDb.id}`);

  // Create JD Versions database with relation to Records
  console.log('3. Creating "JD Versions" database...');
  const versionsDb = await notionRequest('POST', 'databases', {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: 'JD Versions' } }],
    properties: {
      Version: { title: {} },
      'JD Record': { relation: { database_id: recordsDb.id, single_property: {} } },
      'Score at Save': { number: { format: 'number' } },
      Action: { select: { options: [
        { name: 'Imported', color: 'gray' },
        { name: 'AI Rewrite', color: 'purple' },
        { name: 'Manual Edit', color: 'blue' },
        { name: 'Approved', color: 'green' },
      ]}},
      Timestamp: { date: {} },
    },
  });
  console.log(`   Created: ${versionsDb.id}`);

  console.log();
  console.log('─'.repeat(50));
  console.log('Setup complete. Database IDs:');
  console.log();
  console.log(`  JD Records:  ${recordsDb.id}`);
  console.log(`  JD Versions: ${versionsDb.id}`);
  console.log();
  console.log('Paste these into your Settings page or .env file.');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
