# Blog Content Contract

This repository adheres to the standardized network blog specification.

## Post Location & Format
- Blog posts are stored in `src/content/blog/<slug>.md` as Markdown files with YAML frontmatter.
- Static assets/images should be placed in `public/`.

## Required Frontmatter Schema
```yaml
---
title: "Article Title"
description: "140-160 character description used for search previews and meta tags."
date: YYYY-MM-DD
updated: YYYY-MM-DD       # optional
author: "Author Name"     # Real name or editorial masthead (e.g., "0xEgg Team")
tags: ["tag1", "tag2"]    # optional
draft: false              # optional; drafts are omitted from build, RSS, and sitemap
canonical: "https://..."  # optional
---
```

## Adding a Post
1. Create `src/content/blog/<slug>.md` with the frontmatter above.
2. Ensure the first paragraph has no links and provides a 40–60 word definitional summary.
3. Include at least 4 external citations and at most 2 network links. Avoid denylisted anchor text.
4. Verify by running `node lint-post.mjs src/content/blog/<slug>.md`.
