import type { APIRoute } from 'astro';
import { getAllPosts } from '../lib/blog';

export const prerender = true;

export const GET: APIRoute = async () => {
  const posts = getAllPosts();
  const siteUrl = 'https://0xegg.com';

  const items = posts.map((post) => {
    const postUrl = `${siteUrl}/blog/${post.slug}/`;
    const pubDate = new Date(post.date).toUTCString();
    return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>${post.author}</author>
      <description><![CDATA[${post.description || post.excerpt}]]></description>
    </item>`;
  }).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>0xEgg Engineering Blog</title>
    <link>${siteUrl}/blog/</link>
    <description>Dispatches and research on EVM indexing, multi-chain node clustering, and Web3 data infrastructure.</description>
    <language>en-US</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(rss.trim(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
