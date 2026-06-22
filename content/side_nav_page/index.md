---
title: Page with side nav
description: Example of page with side nav
permalink: /page-with-side-nav/
layout: layouts/page
tags: website
eleventyNavigation:
  parent: website-guidance
  key: website-guidance-main
  order: 1
  title: Section 1
sidenav: true
sticky_sidenav: true
---

This page uses the single page layout found in `_includes/layouts/page`.
To display the sidenav, set the `sidenav` and `sticky_sidenav` front matter variables as `true`.
