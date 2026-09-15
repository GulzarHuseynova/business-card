import type { HtmlExportEmployee } from '../../types/export-import.type';
import {
  normalizeComparableText,
  resolveHtmlEmployeeAssets,
} from './photo-export';
import { stripSocialLinksFromAdditionalInfo } from '../profile/profile-info';

const isExcludedImageContainer = (element: Element) => {
  const marker = `${element.id} ${element.className || ''}`.toLowerCase();
  return /(logo|qr|icon|social|company|background|cover|banner|hero)/i.test(marker);
};

const promoteInitialCandidate = (element: Element, root: Element) => {
  let current: Element | null = element;
  let fallback: Element = element;

  for (let level = 0; current && level < 4; level += 1) {
    if (isExcludedImageContainer(current)) break;

    const marker = `${current.id} ${current.className || ''} ${current.getAttribute('style') || ''}`.toLowerCase();
    if (/(avatar|profile[-_ ]?(photo|image|img)|employee[-_ ]?(photo|image|img)|user[-_ ]?(photo|image|img)|photo[-_ ]?circle|image[-_ ]?circle|rounded|border-radius)/i.test(marker)) {
      return current;
    }

    fallback = current;
    if (current === root) break;
    current = current.parentElement;
  }

  return fallback === root ? element : fallback;
};

const getAvatarCandidate = (root: Element, initial: string) => {
  const selectors = [
    '[class*="avatar" i]:not(img)',
    '[id*="avatar" i]:not(img)',
    '[class*="profile-photo" i]:not(img)',
    '[class*="profile-image" i]:not(img)',
    '[class*="profile-img" i]:not(img)',
    '[class*="employee-photo" i]:not(img)',
    '[class*="employee-image" i]:not(img)',
    '[class*="employee-img" i]:not(img)',
    '[class*="user-photo" i]:not(img)',
    '[class*="user-image" i]:not(img)',
    '[class*="user-img" i]:not(img)',
    '[class*="photo-circle" i]:not(img)',
    '[class*="image-circle" i]:not(img)',
    'img[class*="avatar" i]',
    'img[class*="photo" i]',
    'img[class*="profile" i]',
    'img[class*="image" i]',
    'img[id*="avatar" i]',
    'img[id*="photo" i]',
  ];

  for (const selector of selectors) {
    const candidate = Array.from(root.querySelectorAll(selector)).find((element) => !isExcludedImageContainer(element));
    if (candidate) return candidate;
  }

  const initialElement = Array.from(root.querySelectorAll('div, span, p, strong, b')).find((element) => {
    if (isExcludedImageContainer(element) || element.children.length > 0) return false;
    return normalizeComparableText(element.textContent) === normalizeComparableText(initial);
  });

  return initialElement ? promoteInitialCandidate(initialElement, root) : undefined;
};

const findEmployeeNameElement = (document: Document, employee: HtmlExportEmployee) => {
  const fullName = normalizeComparableText(`${employee.firstName || ''} ${employee.lastName || ''}`);
  const reversedName = normalizeComparableText(`${employee.lastName || ''} ${employee.firstName || ''}`);
  const email = normalizeComparableText(employee.email);
  const textElements = Array.from(document.querySelectorAll(
    'h1, h2, h3, h4, h5, [class*="name" i], [id*="name" i], strong, b, p, span, div',
  ));

  return textElements.find((element) => {
    if (element.children.length > 4) return false;
    const text = normalizeComparableText(element.textContent);
    return Boolean(
      (fullName && (text === fullName || text.includes(fullName))) ||
      (reversedName && (text === reversedName || text.includes(reversedName))) ||
      (email && text === email)
    );
  }) || null;
};

const findEmployeeRoot = (document: Document, employee: HtmlExportEmployee) => {
  const nameElement = findEmployeeNameElement(document, employee);
  if (!nameElement) return null;

  const preferred = nameElement.closest(
    '[data-user-id], [data-employee-id], [class*="business-card" i], [class*="public-card" i], [class*="profile-card" i], [class*="employee-card" i], [class~="card" i], article',
  );
  if (preferred) return preferred;

  let current: Element | null = nameElement.parentElement;
  let avatarRoot: Element | null = null;

  for (let level = 0; current && level < 10; level += 1, current = current.parentElement) {
    const hasAvatar = Boolean(getAvatarCandidate(
      current,
      employee.firstName?.[0] || employee.email?.[0] || 'E',
    ));

    if (hasAvatar) {
      avatarRoot = current;
      const hasBackground = Boolean(current.querySelector(
        '[class*="card-background" i], [id*="card-background" i], [class*="background" i], [id*="background" i], [class*="cover" i], [id*="cover" i], [class*="banner" i], [id*="banner" i], [class*="hero" i], [style*="background-image" i]',
      ));
      if (hasBackground) return current;
    }
  }

  return avatarRoot || nameElement.closest('main, section') || nameElement.parentElement;
};

const makeAvatarCircular = (target: HTMLElement) => {
  target.style.setProperty('border-radius', '50%', 'important');
  target.style.setProperty('overflow', 'hidden', 'important');
  target.style.setProperty('clip-path', 'circle(50% at 50% 50%)', 'important');
  target.style.setProperty('aspect-ratio', '1 / 1', 'important');
  target.style.setProperty('visibility', 'visible', 'important');
  target.style.setProperty('opacity', '1', 'important');
};

const applyPhotoToAvatar = (document: Document, target: Element, photo: string, fullName: string) => {
  target.setAttribute('data-setclapp-employee-photo', 'true');

  if (target.tagName.toLowerCase() === 'img') {
    const imageTarget = target as HTMLImageElement;
    imageTarget.removeAttribute('srcset');
    imageTarget.removeAttribute('sizes');
    imageTarget.removeAttribute('onerror');
    imageTarget.loading = 'eager';
    imageTarget.src = photo;
    imageTarget.alt = fullName;
    imageTarget.style.setProperty('object-fit', 'cover', 'important');
    imageTarget.style.setProperty('object-position', 'center', 'important');
    imageTarget.style.setProperty('display', 'block', 'important');
    imageTarget.style.setProperty('width', '100%', 'important');
    imageTarget.style.setProperty('height', '100%', 'important');
    makeAvatarCircular(imageTarget);

    const parent = imageTarget.parentElement;
    if (parent && !isExcludedImageContainer(parent)) makeAvatarCircular(parent);
    return;
  }

  target.textContent = '';
  const htmlTarget = target as HTMLElement;
  htmlTarget.style.backgroundImage = 'none';
  htmlTarget.style.position = htmlTarget.style.position || 'relative';
  makeAvatarCircular(htmlTarget);

  const image = document.createElement('img');
  image.removeAttribute('srcset');
  image.removeAttribute('sizes');
  image.removeAttribute('onerror');
  image.loading = 'eager';
  image.src = photo;
  image.alt = fullName;
  image.setAttribute('data-setclapp-exported-photo', 'true');
  image.setAttribute(
    'style',
    'width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;display:block!important;visibility:visible!important;opacity:1!important;object-fit:cover!important;object-position:center!important;border-radius:50%!important;clip-path:circle(50% at 50% 50%)!important;position:absolute!important;inset:0!important;z-index:10!important;',
  );
  target.appendChild(image);
};

const clearAvatarForEmployeeWithoutPhoto = (
  document: Document,
  target: Element,
  employee: HtmlExportEmployee,
) => {
  const initial = (employee.firstName?.[0] || employee.email?.[0] || 'Ə').toUpperCase();
  const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email || 'Əməkdaş';

  if (target.tagName.toLowerCase() === 'img') {
    const image = target as HTMLImageElement;
    const parent = image.parentElement;

    if (parent && !isExcludedImageContainer(parent)) {
      image.remove();
      parent.querySelectorAll('img').forEach((nestedImage) => nestedImage.remove());
      parent.textContent = initial;
      parent.setAttribute('aria-label', fullName);
      parent.style.setProperty('display', 'grid', 'important');
      parent.style.setProperty('place-items', 'center', 'important');
      parent.style.setProperty('color', '#1e67ce', 'important');
      parent.style.setProperty('font-weight', '800', 'important');
      parent.style.setProperty('font-size', '2.2rem', 'important');
      makeAvatarCircular(parent);
      return;
    }

    const fallback = document.createElement('div');
    fallback.className = image.className || 'avatar';
    fallback.textContent = initial;
    fallback.setAttribute('aria-label', fullName);
    fallback.setAttribute('style', image.getAttribute('style') || '');
    fallback.style.setProperty('display', 'grid', 'important');
    fallback.style.setProperty('place-items', 'center', 'important');
    fallback.style.setProperty('color', '#1e67ce', 'important');
    fallback.style.setProperty('font-weight', '800', 'important');
    makeAvatarCircular(fallback);
    image.replaceWith(fallback);
    return;
  }

  target.querySelectorAll('img').forEach((image) => image.remove());
  target.textContent = initial;
  target.setAttribute('aria-label', fullName);
  const htmlTarget = target as HTMLElement;
  htmlTarget.style.setProperty('display', 'grid', 'important');
  htmlTarget.style.setProperty('place-items', 'center', 'important');
  htmlTarget.style.setProperty('color', '#1e67ce', 'important');
  htmlTarget.style.setProperty('font-weight', '800', 'important');
  htmlTarget.style.setProperty('font-size', '2.2rem', 'important');
  htmlTarget.style.setProperty('background-image', 'none', 'important');
  makeAvatarCircular(htmlTarget);
};


const isExcludedBackgroundContainer = (element: Element) => {
  const marker = `${element.id} ${element.className || ''}`.toLowerCase();
  return /(logo|qr|icon|social|avatar|profile[-_ ]?(photo|image|img)|employee[-_ ]?(photo|image|img)|user[-_ ]?(photo|image|img))/i.test(marker);
};

const getBackgroundCandidate = (root: Element) => {
  const selectors = [
    '[data-setclapp-card-background]',
    '[class*="card-background" i]',
    '[id*="card-background" i]',
    '[class*="background" i]',
    '[id*="background" i]',
    '[class*="cover" i]',
    '[id*="cover" i]',
    '[class*="banner" i]',
    '[id*="banner" i]',
    '[class*="hero" i]',
    '[class*="card-header" i]',
    '[class*="profile-header" i]',
    '[class*="top-section" i]',
    '[style*="background-image" i]',
  ];

  for (const selector of selectors) {
    const candidate = Array.from(root.querySelectorAll(selector)).find((element) => (
      !isExcludedBackgroundContainer(element) &&
      !element.hasAttribute('data-setclapp-employee-photo') &&
      !element.hasAttribute('data-setclapp-exported-photo')
    ));
    if (candidate) return candidate;
  }

  const directChildren = Array.from(root.children).filter((element) => !isExcludedBackgroundContainer(element));
  return directChildren.find((element) => {
    const marker = `${element.id} ${element.className || ''} ${element.getAttribute('style') || ''}`.toLowerCase();
    return /(height\s*:\s*(1[2-9]\d|[2-9]\d\d)px|min-height|linear-gradient|radial-gradient)/i.test(marker);
  });
};

const makeBackgroundVisible = (target: HTMLElement, background: string) => {
  target.setAttribute('data-setclapp-card-background', 'true');
  target.style.setProperty('visibility', 'visible', 'important');
  target.style.setProperty('opacity', '1', 'important');
  target.style.setProperty('background-image', `url("${background.replace(/"/g, '\\"')}")`, 'important');
  target.style.setProperty('background-size', 'cover', 'important');
  target.style.setProperty('background-position', 'center', 'important');
  target.style.setProperty('background-repeat', 'no-repeat', 'important');
};

const applyBackgroundToCard = (target: Element, background: string, fullName: string) => {
  if (target.tagName.toLowerCase() === 'img') {
    const image = target as HTMLImageElement;
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    image.removeAttribute('onerror');
    image.loading = 'eager';
    image.src = background;
    image.alt = `${fullName} kart fonu`;
    image.setAttribute('data-setclapp-card-background', 'true');
    image.style.setProperty('display', 'block', 'important');
    image.style.setProperty('width', '100%', 'important');
    image.style.setProperty('height', '100%', 'important');
    image.style.setProperty('object-fit', 'cover', 'important');
    image.style.setProperty('object-position', 'center', 'important');
    image.style.setProperty('visibility', 'visible', 'important');
    image.style.setProperty('opacity', '1', 'important');
    return;
  }

  makeBackgroundVisible(target as HTMLElement, background);
};

const clearBrokenBackground = (target: Element) => {
  if (target.tagName.toLowerCase() === 'img') {
    const image = target as HTMLImageElement;
    const source = String(image.getAttribute('src') || '').trim();
    if (!source || source === '#' || /^(null|undefined)$/i.test(source)) image.removeAttribute('src');
    return;
  }

  const htmlTarget = target as HTMLElement;
  const backgroundImage = htmlTarget.style.backgroundImage.trim();
  if (/url\(["']?(?:null|undefined|)["']?\)/i.test(backgroundImage)) {
    htmlTarget.style.removeProperty('background-image');
  }
};

const removeOfflineBlockingPolicies = (document: Document) => {
  document.querySelectorAll('meta[http-equiv]').forEach((meta) => {
    const httpEquiv = String(meta.getAttribute('http-equiv') || '').toLowerCase();
    if (httpEquiv === 'content-security-policy') meta.remove();
  });
};

type ExportAssetRow = {
  employee: HtmlExportEmployee;
  photo: string;
  background: string;
};

const appendStandaloneAssetRuntime = (document: Document, assetRows: ExportAssetRow[]) => {
  const rows = assetRows
    .filter((row) => Boolean(row.photo || row.background))
    .map(({ employee, photo, background }) => ({
      id: employee.id || '',
      firstName: employee.firstName || '',
      lastName: employee.lastName || '',
      email: employee.email || '',
      photo,
      background,
    }));

  if (rows.length === 0) return;

  const serializedRows = JSON.stringify(rows).replace(/</g, '\\u003c');
  const script = document.createElement('script');
  script.setAttribute('data-setclapp-export-assets', 'true');
  script.textContent = `(() => {
    const rows = ${serializedRows};
    const normalize = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .toLocaleLowerCase('az')
      .replace(/[ə]/g, 'e')
      .replace(/[ı]/g, 'i')
      .replace(/[ş]/g, 's')
      .replace(/[ç]/g, 'c')
      .replace(/[ö]/g, 'o')
      .replace(/[ü]/g, 'u')
      .replace(/[ğ]/g, 'g')
      .replace(/\\s+/g, ' ')
      .trim();
    const excludedPhoto = (element) => /(logo|qr|icon|social|company|background|cover|banner|hero)/i.test(String((element && element.id) || '') + ' ' + String((element && element.className) || ''));
    const excludedBackground = (element) => /(logo|qr|icon|social|avatar|profile[-_ ]?(photo|image|img)|employee[-_ ]?(photo|image|img)|user[-_ ]?(photo|image|img))/i.test(String((element && element.id) || '') + ' ' + String((element && element.className) || ''));
    const findName = (row) => {
      const fullName = normalize(row.firstName + ' ' + row.lastName);
      const reversed = normalize(row.lastName + ' ' + row.firstName);
      const email = normalize(row.email);
      return Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,[class*="name" i],[id*="name" i],strong,b,p,span,div')).find((element) => {
        if (element.children.length > 4) return false;
        const text = normalize(element.textContent);
        return Boolean((fullName && (text === fullName || text.includes(fullName))) || (reversed && (text === reversed || text.includes(reversed))) || (email && text === email));
      }) || null;
    };
    const findRoot = (row) => {
      const name = findName(row);
      if (!name) return document.querySelector('[data-user-id="' + CSS.escape(row.id) + '"],[data-employee-id="' + CSS.escape(row.id) + '"]');
      const preferred = name.closest('[data-user-id],[data-employee-id],[class*="business-card" i],[class*="public-card" i],[class*="profile-card" i],[class*="employee-card" i],[class~="card" i],article');
      if (preferred) return preferred;
      let current = name.parentElement;
      let avatarRoot = null;
      for (let depth = 0; current && depth < 10; depth += 1, current = current.parentElement) {
        const hasAvatar = current.querySelector('[class*="avatar" i],[id*="avatar" i],[class*="profile-photo" i],[class*="profile-image" i],[class*="employee-photo" i],[class*="employee-image" i],img[class*="photo" i]');
        if (!hasAvatar) continue;
        avatarRoot = current;
        const hasBackground = current.querySelector('[class*="card-background" i],[id*="card-background" i],[class*="background" i],[id*="background" i],[class*="cover" i],[id*="cover" i],[class*="banner" i],[id*="banner" i],[class*="hero" i],[style*="background-image" i]');
        if (hasBackground) return current;
      }
      return avatarRoot || name.closest('main,section') || name.parentElement;
    };
    const findAvatar = (root, row) => {
      const selectors = ['[class*="avatar" i]:not(img)','[id*="avatar" i]:not(img)','[class*="profile-photo" i]:not(img)','[class*="profile-image" i]:not(img)','[class*="profile-img" i]:not(img)','[class*="employee-photo" i]:not(img)','[class*="employee-image" i]:not(img)','[class*="employee-img" i]:not(img)','[class*="user-photo" i]:not(img)','[class*="user-image" i]:not(img)','[class*="photo-circle" i]:not(img)','[class*="image-circle" i]:not(img)','img[class*="avatar" i]','img[class*="photo" i]','img[class*="profile" i]','img[id*="avatar" i]','img[id*="photo" i]'];
      for (const selector of selectors) {
        const candidate = Array.from(root.querySelectorAll(selector)).find((element) => !excludedPhoto(element));
        if (candidate) return candidate;
      }
      const initial = normalize((row.firstName || row.email || 'Ə').slice(0, 1));
      return Array.from(root.querySelectorAll('div,span,p,strong,b')).find((element) => element.children.length === 0 && !excludedPhoto(element) && normalize(element.textContent) === initial) || null;
    };
    const findBackground = (root) => {
      const selectors = ['[data-setclapp-card-background]','[class*="card-background" i]','[id*="card-background" i]','[class*="background" i]','[id*="background" i]','[class*="cover" i]','[id*="cover" i]','[class*="banner" i]','[id*="banner" i]','[class*="hero" i]','[class*="card-header" i]','[class*="profile-header" i]','[class*="top-section" i]','[style*="background-image" i]'];
      for (const selector of selectors) {
        const candidate = Array.from(root.querySelectorAll(selector)).find((element) => !excludedBackground(element));
        if (candidate) return candidate;
      }
      return Array.from(root.children).find((element) => !excludedBackground(element) && /(height\\s*:\\s*(1[2-9]\\d|[2-9]\\d\\d)px|min-height|linear-gradient|radial-gradient)/i.test(String(element.getAttribute('style') || '') + ' ' + String(element.className || ''))) || null;
    };
    const circular = (target) => {
      target.style.setProperty('border-radius', '50%', 'important');
      target.style.setProperty('overflow', 'hidden', 'important');
      target.style.setProperty('aspect-ratio', '1 / 1', 'important');
      target.style.setProperty('visibility', 'visible', 'important');
      target.style.setProperty('opacity', '1', 'important');
    };
    const applyPhoto = (target, row) => {
      if (!target || !row.photo) return;
      const fullName = (row.firstName + ' ' + row.lastName).trim() || row.email || 'Əməkdaş';
      if (target.tagName.toLowerCase() === 'img') {
        target.removeAttribute('srcset'); target.removeAttribute('sizes'); target.removeAttribute('onerror');
        target.loading = 'eager'; target.src = row.photo; target.alt = fullName;
        target.style.setProperty('display', 'block', 'important'); target.style.setProperty('width', '100%', 'important'); target.style.setProperty('height', '100%', 'important'); target.style.setProperty('object-fit', 'cover', 'important'); target.style.setProperty('object-position', 'center', 'important');
        circular(target); if (target.parentElement && !excludedPhoto(target.parentElement)) circular(target.parentElement);
        return;
      }
      target.textContent = ''; target.style.setProperty('position', target.style.position || 'relative', 'important'); circular(target);
      let image = target.querySelector('img[data-setclapp-exported-photo]');
      if (!image) { image = document.createElement('img'); image.setAttribute('data-setclapp-exported-photo', 'true'); target.appendChild(image); }
      image.removeAttribute('srcset'); image.removeAttribute('sizes'); image.removeAttribute('onerror'); image.loading = 'eager'; image.src = row.photo; image.alt = fullName;
      image.setAttribute('style', 'width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;display:block!important;visibility:visible!important;opacity:1!important;object-fit:cover!important;object-position:center!important;border-radius:50%!important;position:absolute!important;inset:0!important;z-index:10!important;');
    };
    const applyBackground = (target, row) => {
      if (!target || !row.background) return;
      const fullName = (row.firstName + ' ' + row.lastName).trim() || row.email || 'Əməkdaş';
      target.setAttribute('data-setclapp-card-background', 'true');
      if (target.tagName.toLowerCase() === 'img') {
        target.removeAttribute('srcset'); target.removeAttribute('sizes'); target.removeAttribute('onerror'); target.loading = 'eager'; target.src = row.background; target.alt = fullName + ' kart fonu';
        target.style.setProperty('display', 'block', 'important'); target.style.setProperty('width', '100%', 'important'); target.style.setProperty('height', '100%', 'important'); target.style.setProperty('object-fit', 'cover', 'important'); target.style.setProperty('object-position', 'center', 'important'); target.style.setProperty('visibility', 'visible', 'important'); target.style.setProperty('opacity', '1', 'important');
        return;
      }
      target.style.setProperty('background-image', 'url("' + row.background.replace(/"/g, '\\\\"') + '")', 'important'); target.style.setProperty('background-size', 'cover', 'important'); target.style.setProperty('background-position', 'center', 'important'); target.style.setProperty('background-repeat', 'no-repeat', 'important'); target.style.setProperty('visibility', 'visible', 'important'); target.style.setProperty('opacity', '1', 'important');
    };
    const run = () => rows.forEach((row) => { const root = findRoot(row); if (!root) return; applyPhoto(findAvatar(root, row), row); applyBackground(findBackground(root), row); });
    let timer = 0;
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(run, 0); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true }); else schedule();
    [50,150,400,900,1600,2500].forEach((delay) => window.setTimeout(run, delay));
    const observer = new MutationObserver(schedule); observer.observe(document.documentElement, { childList: true, subtree: true }); window.setTimeout(() => observer.disconnect(), 3500);
  })();`;
  document.body.appendChild(script);
};

const additionalInfoHeadingValues = new Set([
  'elave melumat',
  'additional info',
  'additional information',
]);

const isAdditionalInfoHeading = (value: unknown) => (
  additionalInfoHeadingValues.has(normalizeComparableText(value))
);

const getAdditionalInfoHeadings = (root: Element) => {
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  const headings = new Set<Element>();
  let node = walker.nextNode();

  while (node) {
    if (isAdditionalInfoHeading(node.textContent)) {
      const parent = (node as Text).parentElement;
      if (parent) headings.add(parent);
    }
    node = walker.nextNode();
  }

  return Array.from(headings);
};

const getAdditionalInfoContainer = (heading: Element, root: Element) => {
  let current = heading.parentElement;
  let candidate: Element | null = heading.parentElement;

  for (let depth = 0; current && current !== root.parentElement && depth < 7; depth += 1) {
    const marker = `${current.id} ${current.className || ''}`.toLowerCase();
    const textWithoutHeading = normalizeComparableText(current.textContent)
      .replace(normalizeComparableText(heading.textContent), '')
      .trim();

    if (/(additional|extra|info|detail|melumat)/i.test(marker)) return current;
    if (textWithoutHeading || current.children.length > 1) candidate = current;
    if (current === root) break;

    current = current.parentElement;
  }

  return candidate;
};

const cleanAdditionalInfoSection = (
  heading: Element,
  root: Element,
  expectedValue?: string,
) => {
  const container = getAdditionalInfoContainer(heading, root);
  if (!container) return;

  if (expectedValue !== undefined && !expectedValue) {
    container.remove();
    return;
  }

  const textNodes: Text[] = [];
  const walker = container.ownerDocument.createTreeWalker(container, 4);
  let node = walker.nextNode();

  while (node) {
    const textNode = node as Text;
    if (!heading.contains(textNode)) textNodes.push(textNode);
    node = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    textNode.textContent = stripSocialLinksFromAdditionalInfo(textNode.textContent);
  });

  Array.from(container.querySelectorAll('*')).reverse().forEach((element) => {
    if (element === heading || element.contains(heading)) return;
    if (!normalizeComparableText(element.textContent) && element.children.length === 0) element.remove();
  });

  const remainingText = normalizeComparableText(container.textContent)
    .replace(normalizeComparableText(heading.textContent), '')
    .replace(/^[;,:|\-\s]+|[;,:|\-\s]+$/g, '')
    .trim();

  if (expectedValue !== undefined) {
    const cleanedExpected = stripSocialLinksFromAdditionalInfo(expectedValue);

    if (!cleanedExpected) {
      container.remove();
      return;
    }

    const contentElement = Array.from(container.querySelectorAll('p,div,span,strong,b'))
      .find((element) => (
        element !== heading &&
        !element.contains(heading) &&
        element.children.length === 0
      ));

    if (contentElement) {
      contentElement.textContent = cleanedExpected;
    } else {
      const content = container.ownerDocument.createElement('div');
      content.textContent = cleanedExpected;
      container.appendChild(content);
    }
    return;
  }

  if (!remainingText) container.remove();
};

const removeDuplicateSocialAdditionalInfo = (
  document: Document,
  employees: HtmlExportEmployee[],
) => {
  const matchedHeadings = new Set<Element>();

  employees.forEach((employee) => {
    const root = findEmployeeRoot(document, employee);
    if (!root) return;

    const hasAdditionalInfo = Object.prototype.hasOwnProperty.call(employee, 'additionalInfo');
    const expectedValue = hasAdditionalInfo
      ? stripSocialLinksFromAdditionalInfo(
          employee.additionalInfo,
          [
            employee.linkedin,
            employee.facebook,
            employee.instagram,
            ...(employee.socialAccounts || []).map((social) => social.profileUrl),
          ],
        )
      : undefined;

    getAdditionalInfoHeadings(root).forEach((heading) => {
      matchedHeadings.add(heading);
      cleanAdditionalInfoSection(heading, root, expectedValue);
    });
  });

  getAdditionalInfoHeadings(document.body).forEach((heading) => {
    if (matchedHeadings.has(heading) || !heading.isConnected) return;
    cleanAdditionalInfoSection(heading, document.body);
  });
};

const sanitizeStandaloneHtmlFrames = (document: Document) => {
  Array.from(document.querySelectorAll('iframe')).forEach((frame) => {
    const source = String(frame.getAttribute('src') || '').trim();

    // Boş iframe src="" standalone file:// HTML-də cari faylı yenidən açmağa
    // çalışır və Chrome "Unsafe attempt to load URL file:///..." xətası yazır.
    if (!source || source === '#' || source === '.' || source === './') {
      frame.setAttribute('src', 'about:blank');
    }

    const sandboxTokens = String(frame.getAttribute('sandbox') || '')
      .split(/\s+/)
      .filter(Boolean);
    if (sandboxTokens.includes('allow-scripts') && sandboxTokens.includes('allow-same-origin')) {
      frame.setAttribute('sandbox', sandboxTokens.filter((token) => token !== 'allow-same-origin').join(' '));
    }
  });
};

const appendStandaloneHtmlCleanupRuntime = (document: Document) => {
  const script = document.createElement('script');
  script.setAttribute('data-setclapp-export-cleanup', 'true');
  script.textContent = `(() => {
    const normalize = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .toLocaleLowerCase('az')
      .replace(/[ə]/g, 'e')
      .replace(/[ı]/g, 'i')
      .replace(/[ş]/g, 's')
      .replace(/[ç]/g, 'c')
      .replace(/[ö]/g, 'o')
      .replace(/[ü]/g, 'u')
      .replace(/[ğ]/g, 'g')
      .replace(/\\s+/g, ' ')
      .trim();
    const social = /(linkedin|facebook|instagram|youtube|tiktok|twitter|x\\.com|telegram|(?:https?:\\/\\/)?(?:www\\.)?(?:linkedin|facebook|instagram|youtube|tiktok|twitter|x)\\.com\\/)/i;
    const isHeading = (element) => {
      if (!element) return false;
      const text = normalize(element.textContent);
      return text === 'elave melumat' || text === 'additional info' || text === 'additional information';
    };
    const cleanSegments = (value) => String(value || '')
      .split(/[;\\r\\n]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !social.test(part))
      .join('; ');
    const cleanAdditionalInfo = () => {
      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,p,span,div')).filter(isHeading);
      headings.forEach((heading) => {
        let container = heading.parentElement;
        for (let depth = 0; container && container !== document.body && depth < 7; depth += 1) {
          if (social.test(container.textContent || '')) break;
          container = container.parentElement;
        }
        if (!container || container === document.body || !social.test(container.textContent || '')) return;

        const leaves = Array.from(container.querySelectorAll('*')).filter((element) => (
          element !== heading && !element.contains(heading) && element.children.length === 0
        ));
        leaves.forEach((element) => {
          const original = String(element.textContent || '').trim();
          if (!original || !social.test(original)) return;
          const cleaned = cleanSegments(original);
          if (cleaned) element.textContent = cleaned;
          else element.remove();
        });

        const remaining = normalize(container.textContent)
          .replace(normalize(heading.textContent), '')
          .replace(/^[;,:|\\-\\s]+|[;,:|\\-\\s]+$/g, '')
          .trim();
        if (!remaining || social.test(remaining)) container.remove();
      });
    };
    const sanitizeFrames = () => document.querySelectorAll('iframe').forEach((frame) => {
      const source = String(frame.getAttribute('src') || '').trim();
      if (!source || source === '#' || source === '.' || source === './') frame.setAttribute('src', 'about:blank');
      const sandboxTokens = String(frame.getAttribute('sandbox') || '').split(/\\s+/).filter(Boolean);
      if (sandboxTokens.includes('allow-scripts') && sandboxTokens.includes('allow-same-origin')) {
        frame.setAttribute('sandbox', sandboxTokens.filter((token) => token !== 'allow-same-origin').join(' '));
      }
    });
    let cleanupTimer = 0;
    const run = () => {
      window.clearTimeout(cleanupTimer);
      cleanupTimer = window.setTimeout(() => {
        sanitizeFrames();
        cleanAdditionalInfo();
      }, 0);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
    window.setTimeout(run, 100);
    window.setTimeout(run, 500);
    const observer = new MutationObserver(run);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    window.setTimeout(() => observer.disconnect(), 2500);
  })();`;
  document.body.appendChild(script);
};

export const patchExportedHtml = async (blob: Blob, employees: HtmlExportEmployee[]) => {
  const cleanEmployees = employees.filter((employee) => Boolean(
    employee.id || employee.photoUrl || employee.photo || employee.photoData || employee.cardBackgroundUrl
  ));
  if (typeof DOMParser === 'undefined') return blob;

  const html = await blob.text();
  if (!/<html[\s>]/i.test(html)) return blob;

  const document = new DOMParser().parseFromString(html, 'text/html');
  removeOfflineBlockingPolicies(document);
  removeDuplicateSocialAdditionalInfo(document, employees);
  sanitizeStandaloneHtmlFrames(document);

  // Hər işçinin şəkli və fonu Swagger-dəki dəqiq-ID endpointlərindən ayrıca
  // götürülür və data URL kimi HTML-in içinə yazılır. Bu, offline açılışda
  // auth, CORS və nisbi /api/uploads URL problemlərini aradan qaldırır.
  const assetRows: ExportAssetRow[] = await Promise.all(cleanEmployees.map(async (employee) => ({
    employee,
    ...await resolveHtmlEmployeeAssets(employee),
  })));

  const usedPhotoTargets = new Set<Element>();
  const usedBackgroundTargets = new Set<Element>();

  assetRows.forEach(({ employee, photo, background }) => {
    const initial = employee.firstName?.[0] || employee.email?.[0] || 'E';
    const root = findEmployeeRoot(document, employee);
    if (!root) return;

    const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email || 'Əməkdaş';
    const avatarTarget = getAvatarCandidate(root, initial);

    if (avatarTarget && !usedPhotoTargets.has(avatarTarget)) {
      usedPhotoTargets.add(avatarTarget);

      if (photo) applyPhotoToAvatar(document, avatarTarget, photo, fullName);
      else clearAvatarForEmployeeWithoutPhoto(document, avatarTarget, employee);
    }

    const backgroundTarget = getBackgroundCandidate(root);
    if (backgroundTarget && !usedBackgroundTargets.has(backgroundTarget)) {
      usedBackgroundTargets.add(backgroundTarget);

      if (background) applyBackgroundToCard(backgroundTarget, background, fullName);
      else clearBrokenBackground(backgroundTarget);
    }
  });

  // Backend HTML-də kart elementləri JavaScript ilə sonradan qurularsa, aşağıdakı
  // runtime həmin data URL-ləri renderdən sonra yenidən doğru işçiyə tətbiq edir.
  appendStandaloneAssetRuntime(document, assetRows);
  appendStandaloneHtmlCleanupRuntime(document);

  const output = `<!doctype html>\n${document.documentElement.outerHTML}`;
  return new Blob([output], { type: 'text/html;charset=utf-8' });
};
