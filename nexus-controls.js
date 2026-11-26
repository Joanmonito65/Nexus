/* NEXUS native-style controls. Values remain in the original form fields so
   existing workspace handlers and backup formats continue to work. */
(() => {
  const DATE_SELECTOR = 'input[type="date"],input[type="datetime-local"]';
  const COLOR_SELECTOR = 'input[type="color"]';
  const pad = value => String(value).padStart(2, '0');
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const localDateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const validDateKey = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };
  const displayDate = value => validDateKey(value) ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : '';
  const readTime = value => /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})$/.exec(value || '');
  const fire = (input, type) => input.dispatchEvent(new Event(type, { bubbles: true }));
  const labelFor = input => input.getAttribute('aria-label') || input.closest('label')?.querySelector('span')?.textContent?.trim() || input.id.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase()) || 'Choose a value';

  let activeDate = null;
  let activeColor = null;
  let paletteGroup = 'NEXUS';
  const recentColors = [];
  const palettes = {
    NEXUS: ['#A4B2FF', '#7B83FF', '#4C68ED', '#25388F', '#55C7D8', '#25886B', '#83C56E', '#E5B85C', '#ED8A5A', '#D65B78', '#B37BDF', '#F1F3F9'],
    Green: ['#0B3D2E', '#146A4C', '#25886B', '#41A67A', '#73C69A', '#B7E3C7', '#D8F2E2', '#1F655A', '#5CA697', '#A1C9B7', '#3B7D3A', '#9BCB62'],
    Blue: ['#142B57', '#1D4382', '#285DA8', '#347FC4', '#54A9DB', '#A5D5EF', '#D9F0FB', '#294B68', '#417A91', '#64B8C2', '#6677D9', '#A4B2FF'],
    Purple: ['#35204B', '#523178', '#7048A6', '#8B62C5', '#B28AE0', '#D9C0F4', '#F0E7FA', '#643B5B', '#9C5C87', '#D184AA', '#815ED1', '#B8A4F2'],
    Warm: ['#542B26', '#884534', '#B95F42', '#E07E53', '#F3A66B', '#F7D2A7', '#FCF0DE', '#76502F', '#A47A42', '#D0AC64', '#B85158', '#E58E8F'],
    Neutral: ['#111318', '#272A31', '#414650', '#626A76', '#858E9B', '#ABB2BC', '#D4D8DE', '#EEF0F3', '#FFFFFF', '#F1EDE5', '#D8CFBF', '#A39784']
  };

  const datePopover = () => {
    let popover = document.getElementById('nexusDatePickerPopover');
    if (popover) return popover;
    popover = document.createElement('section');
    popover.id = 'nexusDatePickerPopover';
    popover.className = 'nexus-date-popover hidden';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'NEXUS date picker');
    document.body.append(popover);
    popover.addEventListener('click', event => {
      const button = event.target.closest('[data-nexus-date-action]');
      if (!button || !activeDate) return;
      const action = button.dataset.nexusDateAction;
      if (action === 'previous' || action === 'next') {
        activeDate.view = new Date(activeDate.view.getFullYear(), activeDate.view.getMonth() + (action === 'next' ? 1 : -1), 1);
        paintDatePopover();
      } else if (action === 'day') {
        activeDate.selected = button.dataset.date;
        if (activeDate.input.type === 'date') commitDatePicker(true);
        else paintDatePopover();
      } else if (action === 'today') {
        activeDate.selected = localDateKey(new Date());
        if (activeDate.input.type === 'date') commitDatePicker(true);
        else paintDatePopover();
      } else if (action === 'clear') {
        activeDate.input.value = '';
        fire(activeDate.input, 'input');
        fire(activeDate.input, 'change');
        closeDatePicker();
      } else if (action === 'hour' || action === 'minute') {
        const [hour, minute] = activeDate.time.split(':').map(Number);
        const offset = Number(button.dataset.step) * (action === 'hour' ? 60 : 1);
        const total = (hour * 60 + minute + offset + 1440) % 1440;
        activeDate.time = `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
        paintDatePopover();
      } else if (action === 'apply') commitDatePicker(true);
      else if (action === 'cancel') closeDatePicker(true);
    });
    popover.addEventListener('change', event => {
      if (event.target.matches('[data-nexus-date-year]') && activeDate) {
        const year = Math.max(1, Math.min(9999, Number(event.target.value) || activeDate.view.getFullYear()));
        activeDate.view = new Date(year, activeDate.view.getMonth(), 1);
        paintDatePopover();
      }
    });
    return popover;
  };

  const positionPopover = (popover, anchor) => {
    if (!anchor?.isConnected) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 20);
    const height = popover.offsetHeight || 410;
    const left = Math.max(10, Math.min(rect.left, window.innerWidth - width - 10));
    const top = rect.bottom + height + 10 <= window.innerHeight ? rect.bottom + 8 : Math.max(10, rect.top - height - 8);
    popover.style.width = `${width}px`;
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  };

  const paintDatePopover = () => {
    if (!activeDate) return;
    const popover = datePopover();
    const view = activeDate.view;
    const year = view.getFullYear();
    const month = view.getMonth();
    const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(view);
    const firstDay = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const cells = Array.from({ length: firstDay }, () => '<span class="nexus-date-empty" aria-hidden="true"></span>');
    for (let day = 1; day <= count; day++) {
      const key = `${year}-${pad(month + 1)}-${pad(day)}`;
      const selected = key === activeDate.selected;
      const today = key === localDateKey(new Date());
      cells.push(`<button type="button" class="nexus-date-day${selected ? ' is-selected' : ''}${today ? ' is-today' : ''}" data-nexus-date-action="day" data-date="${key}" aria-pressed="${selected}">${day}</button>`);
    }
    while (cells.length % 7) cells.push('<span class="nexus-date-empty" aria-hidden="true"></span>');
    const timePart = activeDate.input.type === 'datetime-local' ? `<div class="nexus-date-time"><span>Time</span><div><button type="button" data-nexus-date-action="hour" data-step="-1" aria-label="Earlier hour">−</button><output>${activeDate.time}</output><button type="button" data-nexus-date-action="hour" data-step="1" aria-label="Later hour">+</button><i></i><button type="button" data-nexus-date-action="minute" data-step="-5" aria-label="Earlier five minutes">−</button><small>minutes</small><button type="button" data-nexus-date-action="minute" data-step="5" aria-label="Later five minutes">+</button></div></div>` : '';
    popover.innerHTML = `<header class="nexus-date-head"><button type="button" data-nexus-date-action="previous" aria-label="Previous month">‹</button><div><strong>${escapeHTML(monthName)}</strong><input data-nexus-date-year type="number" min="1" max="9999" value="${year}" aria-label="Year"></div><button type="button" data-nexus-date-action="next" aria-label="Next month">›</button></header><div class="nexus-date-weekdays">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<span>${day}</span>`).join('')}</div><div class="nexus-date-grid">${cells.join('')}</div>${timePart}<footer class="nexus-date-foot"><button type="button" class="button button-small" data-nexus-date-action="today">Today</button><span></span><button type="button" class="button button-small" data-nexus-date-action="clear">Clear</button>${activeDate.input.type === 'datetime-local' ? '<button type="button" class="button button-primary button-small" data-nexus-date-action="apply">Apply</button>' : ''}</footer>`;
    popover.classList.remove('hidden');
    positionPopover(popover, activeDate.trigger);
  };

  const closeDatePicker = (restoreFocus = false) => {
    const popover = document.getElementById('nexusDatePickerPopover');
    const trigger = activeDate?.trigger;
    activeDate = null;
    popover?.classList.add('hidden');
    if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
  };

  const commitDatePicker = (close = false) => {
    if (!activeDate) return;
    const { input, trigger, selected, time } = activeDate;
    input.value = input.type === 'datetime-local' ? `${selected}T${time}` : selected;
    const text = input.type === 'datetime-local' ? `${displayDate(selected)} · ${time}` : displayDate(selected);
    trigger.querySelector('.nexus-date-value').textContent = text || 'Choose date';
    fire(input, 'input');
    fire(input, 'change');
    if (close) closeDatePicker();
  };

  const openDatePicker = (input, trigger) => {
    const valueDate = input.type === 'datetime-local' ? input.value.slice(0, 10) : input.value;
    const selected = validDateKey(valueDate) ? valueDate : localDateKey(new Date());
    const timeMatch = readTime(input.value);
    activeDate = { input, trigger, selected, time: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '09:00', view: new Date(`${selected}T12:00:00`) };
    paintDatePopover();
  };

  const hexToHsl = hex => {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    let h = 0, s = 0, l = (max + min) / 2;
    if (delta) {
      s = delta / (1 - Math.abs(2 * l - 1));
      if (max === r) h = 60 * (((g - b) / delta) % 6);
      else if (max === g) h = 60 * ((b - r) / delta + 2);
      else h = 60 * ((r - g) / delta + 4);
    }
    return [Math.round((h + 360) % 360), Math.round(s * 100), Math.round(l * 100)];
  };
  const hslToHex = (h, s, l) => {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  const normalizeHex = value => /^#[\da-f]{6}$/i.test(value) ? value.toUpperCase() : null;

  const colorPopover = () => {
    let popover = document.getElementById('nexusColorPickerPopover');
    if (popover) return popover;
    popover = document.createElement('section');
    popover.id = 'nexusColorPickerPopover';
    popover.className = 'nexus-color-popover hidden';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'NEXUS color picker');
    document.body.append(popover);
    popover.addEventListener('click', event => {
      const button = event.target.closest('[data-nexus-color-action]');
      if (!button || !activeColor) return;
      const action = button.dataset.nexusColorAction;
      if (action === 'group') { paletteGroup = button.dataset.group; paintColorPopover(); }
      else if (action === 'swatch') setPickerColor(button.dataset.color);
      else if (action === 'apply') closeColorPicker(true);
      else if (action === 'cancel') closeColorPicker(false);
    });
    popover.addEventListener('input', event => {
      if (!activeColor) return;
      if (event.target.matches('[data-nexus-color-hex]')) {
        const hex = normalizeHex(event.target.value);
        if (hex) { activeColor.hsl = hexToHsl(hex); setPickerColor(hex, false); }
      } else if (event.target.matches('[data-nexus-color-slider]')) {
        activeColor.hsl[Number(event.target.dataset.nexusColorSlider)] = Number(event.target.value);
        setPickerColor(hslToHex(...activeColor.hsl), false);
      }
    });
    popover.addEventListener('change', event => {
      if (event.target.matches('[data-nexus-color-hex]')) {
        const hex = normalizeHex(event.target.value);
        if (hex) { activeColor.hsl = hexToHsl(hex); setPickerColor(hex); }
      }
    });
    return popover;
  };

  const setPickerColor = (value, updateHex = true) => {
    const hex = normalizeHex(value);
    if (!hex || !activeColor) return;
    activeColor.value = hex;
    activeColor.input.value = hex;
    activeColor.trigger.querySelector('.nexus-color-swatch').style.backgroundColor = hex;
    activeColor.trigger.querySelector('.nexus-color-hex').textContent = hex;
    if (updateHex) {
      const field = document.querySelector('[data-nexus-color-hex]');
      if (field) field.value = hex;
      activeColor.hsl = hexToHsl(hex);
      document.querySelectorAll('[data-nexus-color-slider]').forEach(slider => slider.value = activeColor.hsl[Number(slider.dataset.nexusColorSlider)]);
    }
    fire(activeColor.input, 'input');
  };

  const paintColorPopover = () => {
    if (!activeColor) return;
    const popover = colorPopover();
    const groups = Object.keys(palettes);
    const colors = [...new Set([...(palettes[paletteGroup] || palettes.NEXUS), ...recentColors])];
    const [h, s, l] = activeColor.hsl;
    popover.innerHTML = `<header class="nexus-color-head"><div><strong>Choose a color</strong><small>${escapeHTML(labelFor(activeColor.input))}</small></div><button type="button" data-nexus-color-action="cancel" aria-label="Close color picker">×</button></header><nav class="nexus-color-tabs" aria-label="Color palettes">${groups.map(group => `<button type="button" data-nexus-color-action="group" data-group="${group}" aria-pressed="${paletteGroup === group}">${group}</button>`).join('')}</nav><div class="nexus-color-swatches">${colors.map(color => `<button type="button" data-nexus-color-action="swatch" data-color="${color}" style="--swatch:${color}" aria-label="Use ${color}" title="${color}"${activeColor.value === color ? ' aria-pressed="true"' : ''}></button>`).join('')}</div><div class="nexus-color-tune"><label>Hue<input data-nexus-color-slider="0" type="range" min="0" max="360" value="${h}" style="--hue:${h}"></label><label>Saturation<input data-nexus-color-slider="1" type="range" min="0" max="100" value="${s}"></label><label>Lightness<input data-nexus-color-slider="2" type="range" min="5" max="95" value="${l}"></label></div><label class="nexus-color-hex-field">HEX<input data-nexus-color-hex type="text" value="${activeColor.value}" maxlength="7" spellcheck="false" autocapitalize="characters"></label><footer class="nexus-color-foot"><button type="button" class="button button-quiet button-small" data-nexus-color-action="cancel">Cancel</button><button type="button" class="button button-primary button-small" data-nexus-color-action="apply">Use color</button></footer>`;
    popover.classList.remove('hidden');
    positionPopover(popover, activeColor.trigger);
  };

  const closeColorPicker = commit => {
    const popover = document.getElementById('nexusColorPickerPopover');
    const current = activeColor;
    if (!current) return;
    if (commit) {
      fire(current.input, 'change');
      recentColors.unshift(current.value);
      recentColors.splice(8);
    } else {
      current.input.value = current.start;
      current.trigger.querySelector('.nexus-color-swatch').style.backgroundColor = current.start;
      current.trigger.querySelector('.nexus-color-hex').textContent = current.start;
      fire(current.input, 'input');
    }
    activeColor = null;
    popover?.classList.add('hidden');
  };

  const openColorPicker = (input, trigger) => {
    const value = normalizeHex(input.value) || '#4C68ED';
    activeColor = { input, trigger, value, start: value, hsl: hexToHsl(value) };
    paletteGroup = 'NEXUS';
    paintColorPopover();
  };

  const enhanceInputs = root => {
    root.querySelectorAll(`${DATE_SELECTOR}:not([data-nexus-date-enhanced])`).forEach(input => {
      input.dataset.nexusDateEnhanced = 'true';
      const wrapper = document.createElement('span');
      wrapper.className = 'nexus-date-control';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.append(input);
      input.classList.add('nexus-date-native');
      input.setAttribute('aria-hidden', 'true');
      input.tabIndex = -1;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'nexus-date-trigger';
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-label', `${labelFor(input)}: ${input.value ? input.value.replace('T', ' ') : 'choose date'}`);
      trigger.innerHTML = `<span class="nexus-date-icon" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><rect x="3" y="5" width="14" height="12" rx="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 3.5v3M13.5 3.5v3M3 8.5h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span><span class="nexus-date-value">${escapeHTML(input.value ? (input.type === 'datetime-local' ? `${displayDate(input.value.slice(0, 10))} · ${readTime(input.value)?.[1]}:${readTime(input.value)?.[2]}` : displayDate(input.value)) : 'Choose date')}</span><span class="nexus-date-chevron" aria-hidden="true">⌄</span>`;
      wrapper.append(trigger);
      trigger.disabled = input.disabled;
      trigger.addEventListener('click', () => openDatePicker(input, trigger));
    });
    root.querySelectorAll(`${COLOR_SELECTOR}:not([data-nexus-color-enhanced])`).forEach(input => {
      input.dataset.nexusColorEnhanced = 'true';
      const wrapper = document.createElement('span');
      wrapper.className = 'nexus-color-control';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.append(input);
      input.classList.add('nexus-color-native');
      input.setAttribute('aria-hidden', 'true');
      input.tabIndex = -1;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'nexus-color-trigger';
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-label', `${labelFor(input)} color ${input.value}`);
      trigger.innerHTML = `<span class="nexus-color-swatch" style="background:${escapeHTML(input.value)}"></span><span class="nexus-color-hex">${escapeHTML(input.value.toUpperCase())}</span><span aria-hidden="true">⌄</span>`;
      wrapper.append(trigger);
      trigger.disabled = input.disabled;
      trigger.addEventListener('click', () => openColorPicker(input, trigger));
      input.addEventListener('input', () => {
        if (!trigger.isConnected) return;
        trigger.querySelector('.nexus-color-swatch').style.backgroundColor = input.value;
        trigger.querySelector('.nexus-color-hex').textContent = input.value.toUpperCase();
      });
    });
  };

  const updateCustomThemePreview = form => {
    const preview = form?.querySelector('#customThemePreview');
    if (!preview) return;
    const values = Object.fromEntries([...form.querySelectorAll('[data-theme-key]')].map(input => [input.dataset.themeKey, input.value]));
    const variables = { background: 'bg', surface: 'surface', panel: 'panel', sidebar: 'sidebar', header: 'header', text: 'text', textSecondary: 'text-secondary', textMuted: 'muted', border: 'border', primary: 'accent', secondary: 'secondary', accentSoft: 'accent-soft', green: 'green', greenSoft: 'green-soft', amber: 'amber', amberSoft: 'amber-soft', red: 'red', redSoft: 'red-soft', purple: 'purple' };
    Object.entries(variables).forEach(([key, variable]) => { if (values[key]) preview.style.setProperty(`--preview-${variable}`, values[key]); });
    const radius = form.querySelector('#customThemeRadius')?.value;
    if (radius) preview.style.setProperty('--preview-radius', `${radius}px`);
    preview.classList.toggle('no-shadow', !form.querySelector('#customThemeShadow')?.checked);
    const name = form.querySelector('#customThemeName')?.value.trim();
    const nameNode = preview.querySelector('[data-preview-theme-name]');
    if (nameNode) nameNode.textContent = name || 'Your custom theme';
  };

  document.addEventListener('input', event => {
    if (event.target.closest?.('#customThemeForm')) updateCustomThemePreview(event.target.closest('#customThemeForm'));
  });
  document.addEventListener('change', event => {
    if (event.target.closest?.('#customThemeForm')) updateCustomThemePreview(event.target.closest('#customThemeForm'));
  });
  document.addEventListener('pointerdown', event => {
    const date = document.getElementById('nexusDatePickerPopover');
    if (activeDate && !date?.contains(event.target) && !activeDate.trigger.contains(event.target)) closeDatePicker();
  });
  document.addEventListener('click', event => {
    const color = document.getElementById('nexusColorPickerPopover');
    if (activeColor && !color?.contains(event.target) && !activeColor.trigger.contains(event.target)) closeColorPicker(true);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeDate) { event.preventDefault(); closeDatePicker(true); }
    else if (event.key === 'Escape' && activeColor) { event.preventDefault(); closeColorPicker(false); }
  });
  window.addEventListener('resize', () => {
    if (activeDate) positionPopover(datePopover(), activeDate.trigger);
    if (activeColor) positionPopover(colorPopover(), activeColor.trigger);
  });
  document.addEventListener('scroll', () => {
    if (activeDate) positionPopover(datePopover(), activeDate.trigger);
    if (activeColor) positionPopover(colorPopover(), activeColor.trigger);
  }, true);

  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) enhanceInputs(node.matches?.(DATE_SELECTOR + ',' + COLOR_SELECTOR) ? node.parentElement : node);
    }
    const form = document.getElementById('customThemeForm');
    if (form && !form.dataset.nexusPreviewBound) {
      form.dataset.nexusPreviewBound = 'true';
      updateCustomThemePreview(form);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceInputs(document);
})();
