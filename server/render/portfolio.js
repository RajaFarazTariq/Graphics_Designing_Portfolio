// =========================================================
// Public portfolio renderer.
// Produces the exact markup of the original hand-written index.html,
// filled from the database. Class names, structure, inline styles and
// attribute order are intentionally identical so styles.css, script.js and
// hero-scene.js keep working untouched. `npm run verify:ui` checks this.
// =========================================================
import { serviceIconSvg, socialIconSvg, SOCIAL_PLATFORMS } from './icons.js';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (v) => esc(v).replace(/"/g, '&quot;');
const pad2 = (n) => String(n).padStart(2, '0');
const telHref = (phone) => 'tel:' + String(phone || '').replace(/[^\d+]/g, '');
const absUrl = (base, rel) => { try { return new URL(rel, base).href; } catch { return rel; } };
const jsonLd = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');

/** Sections render only when enabled AND they have something to show. */
function visibleSections(c) {
  const has = {
    marquee: c.settings.marquee.items.length > 0,
    about: true,
    skills: c.skills.length > 0,
    stats: c.stripStats.length > 0,
    work: c.projects.length > 0,
    process: c.process.length > 0,
    services: c.services.length > 0,
    experience: c.experiences.length > 0,
    testimonials: c.testimonials.length > 0,
    contact: true,
  };
  const out = {};
  let n = 0;
  for (const s of Object.values(c.sections).sort((a, b) => a.position - b.position)) {
    const show = !!s.is_visible && has[s.key] !== false;
    out[s.key] = { ...s, show, number: show && s.eyebrow ? pad2(++n) : null };
  }
  return out;
}

function sectionTitle(s, indent) {
  return `${indent}<span class="eyebrow">${s.number} — ${esc(s.eyebrow)}</span>
${indent}<h2 class="section__title">
${indent}  ${esc(s.heading)}<br>
${indent}  <em>${esc(s.heading_em)}</em>
${indent}</h2>`;
}

function sectionHead(s) {
  return `      <div class="section__head reveal">
${sectionTitle(s, '        ')}
      </div>`;
}

/** "Crafting *visual*\nstories that\n*resonate.*" → animated word spans. */
function heroHeadline(text) {
  let i = 0;
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.map((line, li) => {
    const words = line.split(/\s+/).map((w) => {
      i += 1;
      const m = /^\*(.+)\*$/.exec(w);
      const inner = m ? `<em>${esc(m[1])}</em>` : esc(w);
      return `          <span class="word word--${i}"><span>${inner}</span></span>`;
    });
    return words.join('\n') + (li < lines.length - 1 ? '<br/>' : '');
  }).join('\n');
}

function yearRange(e) {
  const y = (d) => (d ? String(d).slice(0, 4) : '');
  const start = y(e.start_date);
  const end = e.is_current ? 'Present' : y(e.end_date);
  if (!start && !end) return '';
  if (!start) return end;
  if (!end || end === start) return start;
  return `${start} — ${end}`;
}

const DOWNLOAD_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const FILE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
const ARROW_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10m0 0L9 4m4 4l-4 4"/></svg>';
const FILL_IMG = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;';

export function renderPortfolio(c) {
  const { profile: p, settings: st } = c;
  const seo = st.seo;
  const sec = visibleSections(c);
  const nameParts = String(p.full_name || '').trim().split(/\s+/);
  const resumeUrl = c.resume?.url || null;
  const canonical = seo.canonical_url || '/';
  const ogImage = absUrl(canonical, seo.og_image || 'og-image.jpg');

  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.full_name,
    givenName: nameParts[0] || '',
    familyName: nameParts.slice(1).join(' '),
    jobTitle: p.job_title,
    description: seo.person_description,
    url: canonical,
    image: ogImage,
    email: p.email ? `mailto:${p.email}` : undefined,
    telephone: p.phone_intl || undefined,
    address: { '@type': 'PostalAddress', addressLocality: p.city, addressCountry: p.country_code },
    knowsAbout: seo.knows_about,
    makesOffer: c.services.map(s => ({ '@type': 'Offer', name: s.title })),
  };
  if (c.socials.length) person.sameAs = c.socials.map(s => s.url);

  const navItems = Object.values(sec).filter(s => s.show && s.nav_label);
  const footerItems = Object.values(sec).filter(s => s.show && s.in_footer);
  const siteSocials = c.socials.filter(s => s.show_on_site);

  const cvButton = (cls, svg, label) => resumeUrl ? `
          <a href="${attr(resumeUrl)}" class="${cls}" target="_blank" rel="noopener noreferrer" data-cursor="hover">
            ${svg}
            ${esc(label)}
          </a>` : '';

  const favicon = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%23FF5A36'/%3E%3Ctext x='50' y='68' font-size='62' font-family='Arial' font-weight='700' fill='white' text-anchor='middle'%3E${encodeURIComponent(esc(st.branding.logo_mark))}%3C/text%3E%3C/svg%3E`;

  const logo = `<span class="logo-mark">${esc(st.branding.logo_mark)}</span>
        <span class="logo-text">${esc(st.branding.logo_text)}<span class="dot">.</span></span>`;

  // ---------- sections ----------
  const marquee = sec.marquee?.show ? `
  <!-- ============ MARQUEE ============ -->
  <div class="marquee" aria-hidden="true">
    <div class="marquee__track">
${[...st.marquee.items, ...st.marquee.items].map(i => `      <span>${esc(i)}</span><span>✦</span>`).join('\n')}
    </div>
  </div>
` : '';

  const bioParas = String(p.bio || '').split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
  const about = sec.about?.show ? `
  <!-- ============ ABOUT ============ -->
  <section id="about" class="section about">
    <div class="container">
${sectionHead(sec.about)}

      <div class="about__grid">
        <div class="about__intro reveal" data-delay="100">
          <p class="lead">
            ${esc(p.bio_lead)}
          </p>
${bioParas.map(t => `          <p>
            ${esc(t)}
          </p>`).join('\n')}
${p.philosophy_quote ? `
          <div class="philosophy">
            <h3>${esc(p.philosophy_title)}</h3>
            <blockquote>${esc(p.philosophy_quote)}</blockquote>
          </div>
` : ''}${cvButton('btn btn--outline btn-magnetic', FILE_SVG, st.about.resume_cta)}
        </div>

        <div class="about__side reveal" data-delay="200">
          <div class="about__card signature">
            <span class="signature__role">${esc(p.signature_role)}</span>
            <p class="signature__name">${esc(p.full_name)}</p>
          </div>
${c.facts.length ? `
          <div class="about__card">
            <h3>${esc(st.about.facts_title)}</h3>
            <div class="facts">
${c.facts.map(f => `              <div class="fact">
                <div class="fact__label">${esc(f.label)}</div>
                <div class="fact__value">${esc(f.value)}</div>
              </div>`).join('\n')}
            </div>
          </div>` : ''}
        </div>
      </div>
    </div>
  </section>
` : '';

  const skills = sec.skills?.show ? `
  <!-- ============ SKILLS / TOOLS ============ -->
  <section id="skills" class="section skills-section">
    <div class="container">
${sectionHead(sec.skills)}

      <div class="tools-grid">
${c.skills.map((s, i) => {
    const hasP = s.proficiency !== null && s.proficiency !== undefined;
    const icon = s.icon_url
      ? `<img src="${attr(s.icon_url)}" alt="" style="${FILL_IMG}">`
      : esc(s.icon_text);
    return `        <div class="tool-card reveal" data-delay="${100 + i * 60}"${hasP ? ` data-w="${s.proficiency}"` : ''}${s.icon_shadow ? ` style="--icon-shadow: ${attr(s.icon_shadow)};"` : ''}>
          <div class="tool-card__icon"${s.icon_bg ? ` style="background:${attr(s.icon_bg)};"` : ''}>${icon}</div>
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.description)}</p>${hasP ? `
          <div class="tool-progress">
            <div class="tool-progress__bar" style="--w:${s.proficiency}%"></div>
            <span class="tool-progress__value">${s.proficiency}%</span>
          </div>` : ''}
        </div>
`;
  }).join('\n')}
      </div>
    </div>
  </section>
` : '';

  const stats = sec.stats?.show ? `
  <!-- ============ STATS STRIP ============ -->
  <section class="stats-strip" aria-label="By the numbers">
    <div class="container">
      <ul class="stats reveal">
${c.stripStats.map(s => `        <li class="stat">
          <span class="stat__num" data-target="${attr(s.value)}" data-suffix="${attr(s.suffix)}">0</span>
          <span class="stat__label">${esc(s.label)}</span>
        </li>`).join('\n')}
      </ul>
    </div>
  </section>
` : '';

  const work = sec.work?.show ? `
  <!-- ============ PORTFOLIO ============ -->
  <section id="work" class="section work">
    <div class="container">
${sectionHead(sec.work)}

      <div class="filters reveal" data-delay="100" role="tablist" aria-label="Project category filters">
        <button class="filter is-active" data-filter="all" role="tab" aria-selected="true" data-cursor="hover">${esc(st.work.all_label)}</button>
${c.categories.map(cat => `        <button class="filter" data-filter="${attr(cat.slug)}" role="tab" aria-selected="false" data-cursor="hover">${esc(cat.label)}</button>`).join('\n')}
      </div>

      <div class="portfolio" id="portfolioGrid">

${c.projects.map(pr => {
    const img = pr.thumbnail_url || pr.main_url || pr.featured_url || '';
    const big = pr.main_url && pr.main_url !== img ? ` data-full-image="${attr(pr.main_url)}"` : '';
    const full = pr.full_description && pr.full_description !== pr.short_description ? ` data-full-desc="${attr(pr.full_description)}"` : '';
    return `        <article class="project reveal" data-category="${attr(pr.category_slug || '')}"${big}${full} data-cursor="text">
          <div class="project__image">
            <img src="${attr(img)}" alt="${attr(pr.image_alt || pr.title)}" loading="lazy">
            <span class="project__view">View Project →</span>
          </div>
          <div class="project__body">
            <div class="project__meta">${pr.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
            <h3>${esc(pr.title)}</h3>
            <p>${esc(pr.short_description)}</p>
            <span class="project__tools">${esc(pr.tools.join(' · '))}</span>
          </div>
        </article>
`;
  }).join('\n')}
      </div>
    </div>
  </section>
` : '';

  const process = sec.process?.show ? `
  <!-- ============ PROCESS ============ -->
  <section class="section process">
    <div class="container">
${sectionHead(sec.process)}

      <div class="process-grid">
${c.process.map((s, i) => `        <div class="process-step reveal" data-delay="${100 * (i + 1)}">
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.description)}</p>
        </div>`).join('\n')}
      </div>
    </div>
  </section>
` : '';

  const services = sec.services?.show ? `
  <!-- ============ SERVICES ============ -->
  <section id="services" class="section services">
    <div class="container">
${sectionHead(sec.services)}

      <div class="service-grid">
${c.services.map((s, i) => `        <article class="service reveal" data-delay="${100 * (i + 1)}">
          <span class="service__num" aria-hidden="true">${pad2(i + 1)}</span>
          <div class="service__icon">
            ${s.icon_url ? `<img src="${attr(s.icon_url)}" alt="" width="26" height="26" style="object-fit:contain;">` : serviceIconSvg(s.icon)}
          </div>
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.description)}</p>${s.features.length ? `
          <ul class="service__feats">
            ${s.features.map(f => `<li>${esc(f)}</li>`).join('')}
          </ul>` : ''}
          <a class="service__cta" href="${attr(s.cta_url || '#contact')}" data-cursor="hover">
            <span>${esc(s.cta_label || 'Get a quote')}</span>
            ${ARROW_SVG}
          </a>
        </article>
`).join('\n')}      </div>
    </div>
  </section>
` : '';

  const experience = sec.experience?.show ? `
  <!-- ============ EXPERIENCE TIMELINE ============ -->
  <section class="section experience-section">
    <div class="container">
${sectionHead(sec.experience)}

      <div class="timeline">
${c.experiences.map((e, i) => {
    const meta = [yearRange(e), e.company].filter(Boolean).join(' · ');
    return `        <div class="timeline-item reveal" data-delay="${100 * (i + 1)}">${meta ? `
          <span class="timeline-item__year">${esc(meta)}</span>` : ''}
          <h3>${esc(e.position)}</h3>
          <p>${esc(e.description)}</p>
        </div>`;
  }).join('\n')}
      </div>
    </div>
  </section>
` : '';

  const testimonials = sec.testimonials?.show ? `
  <!-- ============ TESTIMONIALS ============ -->
  <section id="testimonials" class="section testimonials">
    <div class="container">
${sectionHead(sec.testimonials)}

      <div class="testimonial-grid">
${c.testimonials.map((t, i) => {
    const role = [t.client_position, t.company].filter(Boolean).join(' · ');
    const avatar = t.avatar_url
      ? `<div class="avatar" style="background:${attr(t.avatar_bg || 'var(--surface-glass)')};overflow:hidden"><img src="${attr(t.avatar_url)}" alt="" style="${FILL_IMG}"></div>`
      : `<div class="avatar" style="background:${attr(t.avatar_bg)}">${esc(t.avatar_initials)}</div>`;
    return `        <figure class="testimonial reveal" data-delay="${100 * (i + 1)}">
          <div class="quote-mark" aria-hidden="true">"</div>
          <div class="testimonial__stars" aria-label="${t.rating} out of 5">${'★'.repeat(t.rating)}</div>
          <blockquote>
            ${esc(t.quote)}
          </blockquote>
          <figcaption>
            ${avatar}
            <div>
              <strong>${esc(t.client_name)}</strong>
              <span>${esc(role)}</span>
            </div>
          </figcaption>
        </figure>
`;
  }).join('\n')}      </div>
    </div>
  </section>
` : '';

  const contact = sec.contact?.show ? `
  <!-- ============ CONTACT ============ -->
  <section id="contact" class="section contact">
    <div class="container">
      <div class="contact__grid">
        <div class="contact__intro reveal">
${sectionTitle(sec.contact, '          ')}
          <p class="lead">
            ${esc(st.contact.lead_before)} <strong style="color:var(--text)">${esc(st.contact.lead_highlight)}</strong>${esc(st.contact.lead_after)}
          </p>

          <div class="contact__details">${p.email ? `
            <a href="mailto:${attr(p.email)}" class="contact__line" data-cursor="hover">
              <span>Email</span>
              <strong>${esc(p.email)}</strong>
            </a>` : ''}${p.phone_display ? `
            <a href="${attr(telHref(p.phone_intl || p.phone_display))}" class="contact__line" data-cursor="hover">
              <span>Phone</span>
              <strong>${esc(p.phone_display)}</strong>
            </a>` : ''}${p.working_mode ? `
            <div class="contact__line">
              <span>Working</span>
              <strong>${esc(p.working_mode)}</strong>
            </div>` : ''}
          </div>
${siteSocials.length ? `
          <div class="socials">
${siteSocials.map(s => `            <a href="${attr(s.url)}" class="social-link" target="_blank" rel="noopener noreferrer" aria-label="${attr(s.label || SOCIAL_PLATFORMS[s.platform]?.label || s.platform)}" data-cursor="hover">${socialIconSvg(s.platform)}</a>`).join('\n')}
          </div>
` : ''}
        </div>

        <form class="contact__form reveal" data-delay="200" id="contactForm" action="https://api.web3forms.com/submit" method="POST" novalidate>
          <input type="hidden" name="access_key" value="${attr(st.contact.form_access_key)}" />
          <input type="hidden" name="from_name" value="${attr(st.contact.form_from_name)}" />
          <input type="hidden" name="subject" value="${attr(st.contact.form_subject)}" />
          <input type="checkbox" name="botcheck" style="display:none" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <div class="field">
            <label for="name">Your Name</label>
            <input type="text" id="name" name="name" required placeholder="Jane Doe" autocomplete="name" />
          </div>
          <div class="field">
            <label for="email">Email Address</label>
            <input type="email" id="email" name="email" required placeholder="jane@company.com" autocomplete="email" />
          </div>
          <div class="field">
            <label for="subject">Subject</label>
            <input type="text" id="subject" name="subject" placeholder="Project inquiry" />
          </div>
          <div class="field">
            <label for="message">Message</label>
            <textarea id="message" name="message" rows="5" required placeholder="Tell me about your project, timeline, and budget..."></textarea>
          </div>
          <button type="submit" class="btn btn--primary btn--full btn-magnetic" data-cursor="hover">
            Send Message
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
          <p class="form-status" id="formStatus" aria-live="polite"></p>
        </form>
      </div>
    </div>
  </section>
` : '';

  const previewBadge = c.preview ? `
  <div style="position:fixed;left:16px;bottom:16px;z-index:2147483647;padding:8px 14px;border-radius:999px;background:#111827;color:#fff;font:600 12px/1.2 Inter,system-ui,sans-serif;letter-spacing:.04em;box-shadow:0 8px 24px rgba(0,0,0,.35);pointer-events:none">PREVIEW — includes drafts</div>
` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
${c.preview ? '  <meta name="robots" content="noindex, nofollow" />\n' : ''}
  <!-- ============ Primary SEO ============ -->
  <title>${esc(seo.title)}</title>
  <meta name="description" content="${attr(seo.description)}" />
  <meta name="author" content="${attr(p.full_name)}" />
  <meta name="keywords" content="${attr(seo.keywords)}" />
  <meta name="theme-color" content="${attr(seo.theme_color)}" />
  <link rel="canonical" href="${attr(canonical)}" />

  <!-- ============ Open Graph ============ -->
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:site_name" content="${attr(seo.og_site_name)}" />
  <meta property="og:url" content="${attr(canonical)}" />
  <meta property="og:title" content="${attr(seo.og_title)}" />
  <meta property="og:description" content="${attr(seo.og_description)}" />
  <meta property="og:image" content="${attr(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${attr(seo.og_image_alt)}" />

  <!-- ============ Twitter Card ============ -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${attr(seo.twitter_title)}" />
  <meta name="twitter:description" content="${attr(seo.twitter_description)}" />
  <meta name="twitter:image" content="${attr(ogImage)}" />

  <!-- ============ Structured data ============ -->
  <script type="application/ld+json">
${jsonLd(person)}
  </script>

  <!-- ============ Fonts ============ -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@1,500&display=swap"
    rel="stylesheet"
  />

  <link rel="stylesheet" href="styles.css" />
  <link rel="icon" type="image/svg+xml" href="${favicon}" />
</head>
<body>

  <!-- ============ INITIAL LOADER ============ -->
  <div class="loader" id="loader" aria-hidden="true">
    <div class="loader__inner">
      <div class="loader__brand">
        <span class="loader__mark">${esc(st.branding.logo_mark)}</span>
        <span class="loader__name">${esc(st.branding.logo_text)}<span class="loader__dot">.</span></span>
      </div>
      <div class="loader__bar"><div class="loader__bar-fill"></div></div>
      <div class="loader__tag">${esc(st.branding.loader_tagline)}</div>
    </div>
  </div>

  <!-- ============ SCROLL PROGRESS + CURSOR ============ -->
  <div class="scroll-progress" aria-hidden="true"><div class="scroll-progress__fill" id="scrollProgress"></div></div>
  <div class="cursor-ring" id="cursorRing" aria-hidden="true"></div>
  <div class="cursor" id="cursor" aria-hidden="true"></div>

  <!-- ============ NAVIGATION ============ -->
  <header class="nav" id="nav">
    <div class="container nav__inner">
      <a href="#home" class="nav__logo" aria-label="${attr(p.full_name)} home" data-cursor="hover">
        ${logo}
      </a>

      <nav class="nav__menu" id="navMenu" aria-label="Primary">
${navItems.map(s => `        <a href="#${s.key}" class="nav__link" data-cursor="hover">${esc(s.nav_label)}</a>`).join('\n')}
      </nav>

      <div class="nav__actions">
        <button id="themeToggle" class="icon-btn" aria-label="Toggle theme" title="Toggle theme" data-cursor="hover">
          <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>

        <a href="#contact" class="btn btn--primary btn--sm nav__cta btn-magnetic" data-cursor="hover">Let's Talk</a>

        <button id="menuToggle" class="icon-btn menu-toggle" aria-label="Open menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>

  <!-- ============ HERO ============ -->
  <section id="home" class="hero">
    <div class="hero__bg" aria-hidden="true">
      <div class="grid-overlay"></div>
    </div>

    <div class="container hero__inner">
      <div class="hero__content">
        <div class="hero__eyebrow">
          <span class="pulse"></span>
          ${esc(p.availability_status)}
        </div>

        <h1 class="hero__title">
${heroHeadline(st.hero.headline)}
        </h1>

        <p class="hero__tagline">
          I'm <strong style="color:var(--text); font-weight:500;">${esc(p.full_name)}</strong> — ${esc(p.short_intro)}
        </p>

        <div class="hero__cta">
          <a href="#work" class="btn btn--primary btn-magnetic" data-cursor="hover">
            ${esc(st.hero.primary_cta)}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
          <a href="#contact" class="btn btn--ghost btn-magnetic" data-cursor="hover">
            ${esc(st.hero.secondary_cta)}
          </a>${cvButton('btn btn--outline btn-magnetic', DOWNLOAD_SVG, st.hero.cv_cta)}
        </div>
${c.heroStats.length ? `
        <div class="hero__meta">
${c.heroStats.map(s => `          <div class="meta-item"><strong>${esc(s.value + s.suffix)}</strong><span>${esc(s.label)}</span></div>`).join('\n')}
        </div>` : ''}
      </div>

      <div class="hero__visual" aria-hidden="true">
        <div class="saturn-stage" id="saturnStage">
          <div class="saturn-stage__glow"></div>

          <div class="orbit-ring orbit-ring--1"></div>
          <div class="orbit-ring orbit-ring--2"></div>
          <div class="orbit-ring orbit-ring--3"></div>

          <div class="saturn">
            <div class="saturn__aura"></div>
            <div class="saturn__ring saturn__ring--back"></div>
            <div class="saturn__ring saturn__ring--back saturn__ring--inner"></div>
            <div class="saturn__ring saturn__ring--back saturn__ring--inner saturn__ring--inner-2"></div>
            <div class="saturn__sphere">
              <span class="saturn__highlight"></span>
              <span class="saturn__bands"></span>
              <span class="saturn__shadow"></span>
            </div>
            <div class="saturn__ring saturn__ring--front"></div>
            <div class="saturn__ring saturn__ring--front saturn__ring--inner"></div>
            <div class="saturn__ring saturn__ring--front saturn__ring--inner saturn__ring--inner-2"></div>
          </div>

          <div class="orbiter" data-orbit="0"><div class="orbiter__pulse"></div><div class="orbiter__icon tool-mark" style="background:linear-gradient(135deg,#001E36,#31A8FF);">Ps</div></div>
          <div class="orbiter" data-orbit="1"><div class="orbiter__pulse"></div><div class="orbiter__icon tool-mark" style="background:linear-gradient(135deg,#330000,#FF9A00);">Ai</div></div>
          <div class="orbiter" data-orbit="2"><div class="orbiter__pulse"></div><div class="orbiter__icon tool-mark" style="background:linear-gradient(135deg,#1ABCFE,#0ACF83 40%,#F24E1E 70%,#A259FF);">Fg</div></div>
          <div class="orbiter" data-orbit="3"><div class="orbiter__pulse"></div><div class="orbiter__icon tool-mark" style="background:linear-gradient(135deg,#00C4CC,#7D2AE8);">Cv</div></div>
          <div class="orbiter" data-orbit="4"><div class="orbiter__pulse"></div><div class="orbiter__icon tool-mark" style="background:linear-gradient(135deg,#1F0033,#D950BC);">Ae</div></div>
          <div class="orbiter" data-orbit="5"><div class="orbiter__pulse"></div><div class="orbiter__icon tool-mark" style="background:linear-gradient(135deg,#FF8C3C,#FF3D00);">Bl</div></div>
          <div class="orbiter" data-orbit="6"><div class="orbiter__pulse"></div><div class="orbiter__icon orbiter__icon--ux"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="12" height="12" rx="2"/><rect x="9" y="9" width="12" height="12" rx="2"/></svg></div></div>

          <span class="streak streak--1"></span>
          <span class="streak streak--2"></span>
          <span class="streak streak--3"></span>

          <span class="spark spark--1"></span>
          <span class="spark spark--2"></span>
          <span class="spark spark--3"></span>
          <span class="spark spark--4"></span>
          <span class="spark spark--5"></span>
          <span class="spark spark--6"></span>
        </div>
      </div>
    </div>

    <div class="scroll-indicator" aria-hidden="true">
      <span>Scroll</span>
      <div class="scroll-line"></div>
    </div>
  </section>
${marquee}${about}${skills}${stats}${work}${process}${services}${experience}${testimonials}${contact}
  <!-- ============ FOOTER ============ -->
  <footer class="footer">
    <div class="container footer__inner">
      <div class="footer__brand">
        <a href="#home" class="nav__logo" data-cursor="hover">
          ${logo.replace(/\n {8}/g, '\n          ')}
        </a>
        <p>${esc(st.footer.blurb)}</p>
      </div>

      <div class="footer__links">
        <h4>Navigate</h4>
${footerItems.map(s => `        <a href="#${s.key}" data-cursor="hover">${esc(s.nav_label || s.name)}</a>`).join('\n')}
      </div>

      <div class="footer__contact">
        <h4>Get In Touch</h4>${p.email ? `
        <a href="mailto:${attr(p.email)}" data-cursor="hover">${esc(p.email)}</a>` : ''}${p.phone_display ? `
        <a href="${attr(telHref(p.phone_intl || p.phone_display))}" data-cursor="hover">${esc(p.phone_display)}</a>` : ''}
        <span class="footer__remote">${esc(st.footer.availability)}</span>
      </div>
    </div>

    <div class="container footer__bottom">
      <span>© <span id="year"></span> ${esc(p.full_name)}. All rights reserved.</span>
      <span>${esc(st.footer.credit)}</span>
    </div>
  </footer>

  <a href="#home" class="back-to-top" id="backToTop" aria-label="Back to top" data-cursor="hover">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
  </a>

  <!-- ============ PROJECT LIGHTBOX ============ -->
  <div class="project-modal" id="projectModal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="modalTitle">
    <div class="project-modal__backdrop" data-modal-close></div>
    <div class="project-modal__panel" role="document">
      <button type="button" class="project-modal__close" data-modal-close aria-label="Close project view" data-cursor="hover">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="project-modal__media">
        <img id="modalImage" src="" alt="" />
      </div>
      <div class="project-modal__info">
        <span class="project-modal__eyebrow" id="modalEyebrow">Selected work</span>
        <h3 class="project-modal__title" id="modalTitle">Project Title</h3>
        <div class="project-modal__tags" id="modalTags"></div>
        <p class="project-modal__desc" id="modalDesc"></p>
        <div class="project-modal__tools" id="modalTools"></div>
        <a href="#contact" class="project-modal__cta" data-modal-close data-cursor="hover">
          Want something similar?
          ${ARROW_SVG}
        </a>
      </div>
    </div>
  </div>
${previewBadge}
  <script src="hero-scene.js" defer></script>
  <script src="script.js" defer></script>
</body>
</html>
`;
}
