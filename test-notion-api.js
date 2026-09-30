// Test script to understand Notion API responses
// Run with: NOTION_TOKEN=<token> node test-notion-api.js

const DATABASE_ID = '43cda90877814ae89d2f5e80072b8730';
const NOTION_TOKEN = process.env.NOTION_TOKEN;

if (!NOTION_TOKEN) {
  console.log('Set NOTION_TOKEN environment variable');
  process.exit(1);
}

async function testQuery() {
  const url = `https://api.notion.com/v1/databases/${DATABASE_ID}/query`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      page_size: 2
    })
  });
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

testQuery().catch(console.error);
