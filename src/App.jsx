import { useEffect, useRef, useState } from 'react';
import { THEMES, THEME_ORDER } from './themes.js';
import { TRANSLATIONS } from './translations.js';
import { CATEGORIES, getCategory } from './categories.js';

const TASKS_KEY = 'lav_agenda_tasks';
const LANG_KEY = 'lav_agenda_lang';
const THEME_KEY = 'lav_agenda_theme';

function toISO(d) {
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function diffFromToday(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + 'T00:00:00');
  return Math.round((d - today) / 86400000);
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [newText, setNewText] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newCategory, setNewCategory] = useState('personal');
  const [lang, setLangState] = useState('en');
  const [theme, setThemeState] = useState('lavender');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [celebrateId, setCelebrateId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const celebrateTimer = useRef(null);

  useEffect(() => {
    let loadedTasks = [];
    let loadedLang = 'en';
    let loadedTheme = 'lavender';
    try {
      const raw = localStorage.getItem(TASKS_KEY);
      if (raw) loadedTasks = JSON.parse(raw);
      const l = localStorage.getItem(LANG_KEY);
      if (l) loadedLang = l;
      const t = localStorage.getItem(THEME_KEY);
      if (t && THEMES[t]) loadedTheme = t;
    } catch (e) {
      /* ignore */
    }
    setTasks(loadedTasks);
    setLangState(loadedLang);
    setThemeState(loadedTheme);
    setNewDate(toISO(new Date()));
    setLoaded(true);
  }, []);

  const save = (next) => {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(next));
    } catch (e) {
      /* ignore */
    }
  };

  const tr = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const dateLabel = (iso) => {
    const diff = diffFromToday(iso);
    if (diff === 0) return tr.today;
    if (diff === 1) return tr.tomorrow;
    if (diff === -1) return tr.yesterday;
    const loc = lang === 'es' ? 'es-ES' : 'en-US';
    return cap(new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso + 'T00:00:00')));
  };

  const addTask = () => {
    const text = (newText || '').trim();
    if (!text) return;
    const date = newDate || toISO(new Date());
    const category = newCategory || 'personal';
    const task = { id: Date.now() + '_' + Math.random().toString(36).slice(2, 7), text, date, category, done: false };
    const next = [...tasks, task];
    save(next);
    setTasks(next);
    setNewText('');
  };

  const toggleTask = (id) => {
    let becameDone = false;
    const next = tasks.map((t) => {
      if (t.id === id) {
        const done = !t.done;
        if (done) becameDone = true;
        return { ...t, done };
      }
      return t;
    });
    save(next);
    setTasks(next);
    if (becameDone) {
      setCelebrateId(id);
      clearTimeout(celebrateTimer.current);
      celebrateTimer.current = setTimeout(() => setCelebrateId(null), 720);
    }
  };

  const deleteTask = (id) => {
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, removing: true } : t)));
    setTimeout(() => {
      setTasks((cur) => {
        const next = cur.filter((t) => t.id !== id);
        save(next);
        return next;
      });
    }, 300);
  };

  const clearCompleted = () => {
    const doneIds = new Set(tasks.filter((t) => t.done).map((t) => t.id));
    if (doneIds.size === 0) return;
    setTasks((cur) => cur.map((t) => (doneIds.has(t.id) ? { ...t, removing: true } : t)));
    setTimeout(() => {
      setTasks((cur) => {
        const next = cur.filter((t) => !doneIds.has(t.id));
        save(next);
        return next;
      });
    }, 300);
  };

  const setLang = (next) => {
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch (e) {
      /* ignore */
    }
    setLangState(next);
  };

  const setTheme = (next) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      /* ignore */
    }
    setThemeState(next);
  };

  const activeTheme = THEMES[theme] ? theme : 'lavender';
  const themeVars = {
    ...THEMES[activeTheme].vars,
    position: 'relative',
    minHeight: '100vh',
    width: '100%',
    overflow: 'hidden',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: "'Nunito', sans-serif",
    transition: 'background 0.5s ease, color 0.5s ease',
  };

  const loc = lang === 'es' ? 'es-ES' : 'en-US';
  const todayLabel = cap(new Intl.DateTimeFormat(loc, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()));

  // Tasks are grouped by date, and groups are sorted chronologically (ISO
  // date strings sort lexically in date order) so the agenda always reads
  // oldest/most-overdue first, then today, then upcoming days.
  const map = {};
  tasks.forEach((t) => {
    (map[t.date] = map[t.date] || []).push(t);
  });
  const keys = Object.keys(map).sort();
  const groups = keys.map((k) => {
    const raw = map[k];
    const total = raw.length;
    const doneCount = raw.filter((t) => t.done).length;
    const hasPending = doneCount < total;
    const ordered = [...raw].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
    const diff = diffFromToday(k);
    return {
      key: k,
      label: dateLabel(k),
      progress: doneCount + ' / ' + total,
      tasks: ordered,
      isToday: diff === 0,
      isOverdue: diff < 0 && hasPending,
      isDueSoon: diff === 1 && hasPending,
    };
  });
  const showEmpty = loaded && groups.length === 0;
  const hasCompleted = tasks.some((t) => t.done);

  return (
    <div style={themeVars}>
      <div className="lav-blob1" />
      <div className="lav-blob2" />
      <div className="lav-blob3" />

      <div className="lav-content">
        <div className="lav-header-row">
          <div>
            <h1 className="lav-title">{tr.appTitle}</h1>
            <p className="lav-subtitle">{todayLabel}</p>
          </div>
          <button onClick={() => setSettingsOpen(true)} aria-label="settings" className="lav-settings-btn">
            <span className="lav-icon-bar" />
            <span className="lav-icon-bar-sm" />
            <span className="lav-icon-bar" />
          </button>
        </div>

        <div className="lav-add-bar">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTask();
            }}
            placeholder={tr.placeholder}
            className="lav-field lav-field-text"
          />
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="lav-field lav-field-aux" />
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="lav-field lav-field-aux">
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat[lang]}
              </option>
            ))}
          </select>
          <button onClick={addTask} className="lav-add-btn">
            {tr.add}
          </button>
        </div>

        {hasCompleted && (
          <div className="lav-clear-row">
            <button className="lav-clear-btn" onClick={clearCompleted}>
              {tr.clearCompleted}
            </button>
          </div>
        )}

        {showEmpty && (
          <div className="lav-empty-card">
            <div className="lav-empty-icon-wrap">
              <div className="lav-empty-icon" />
            </div>
            <p className="lav-empty-title">{tr.emptyTitle}</p>
            <p className="lav-empty-sub">{tr.emptySub}</p>
          </div>
        )}

        {groups.map((group) => {
          let groupClass = 'lav-group';
          if (group.isToday) groupClass += ' lav-group-today';
          else if (group.isOverdue) groupClass += ' lav-group-overdue';
          else if (group.isDueSoon) groupClass += ' lav-group-duesoon';

          return (
            <div key={group.key} className={groupClass}>
              <div className="lav-group-header">
                <h2 className="lav-group-title">{group.label}</h2>
                {group.isOverdue && <span className="lav-badge lav-badge-overdue">{tr.overdueBadge}</span>}
                {group.isDueSoon && <span className="lav-badge lav-badge-duesoon">{tr.dueSoonBadge}</span>}
                <span className="lav-divider" />
                <span className="lav-progress">{group.progress}</span>
              </div>
              <div className="lav-task-list">
                {group.tasks.map((task) => {
                  const removing = !!task.removing;
                  const celebrating = celebrateId === task.id && task.done;
                  const cat = getCategory(task.category);
                  return (
                    <div
                      key={task.id}
                      className={
                        'lav-task-row' +
                        (task.done ? ' lav-task-row-done' : '') +
                        (removing ? ' lav-task-row-removing' : '')
                      }
                    >
                      <div onClick={() => toggleTask(task.id)} className={'lav-check' + (task.done ? ' lav-check-done' : '')}>
                        {celebrating && <span className="lav-ring" />}
                        <span className={'lav-checkmark' + (task.done ? ' lav-checkmark-done' : '')}>✓</span>
                      </div>
                      <div className="lav-task-main">
                        <span className={'lav-task-text' + (task.done ? ' lav-task-text-done' : '')}>{task.text}</span>
                        <span className={'lav-category-pill ' + cat.className}>
                          <span className="lav-category-dot" />
                          {cat[lang]}
                        </span>
                      </div>
                      <button onClick={() => deleteTask(task.id)} aria-label="delete" className="lav-delete-btn">
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {settingsOpen && (
        <div onClick={() => setSettingsOpen(false)} className="lav-modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="lav-modal-panel">
            <div className="lav-modal-header">
              <h3 className="lav-modal-title">{tr.settings}</h3>
              <button onClick={() => setSettingsOpen(false)} aria-label="close" className="lav-modal-close">
                ×
              </button>
            </div>

            <p className="lav-section-label">{tr.language}</p>
            <div className="lav-seg-group">
              <button onClick={() => setLang('en')} className={'lav-seg-btn' + (lang !== 'es' ? ' lav-seg-btn-active' : '')}>
                English
              </button>
              <button onClick={() => setLang('es')} className={'lav-seg-btn' + (lang === 'es' ? ' lav-seg-btn-active' : '')}>
                Español
              </button>
            </div>

            <p className="lav-section-label">{tr.theme}</p>
            <div className="lav-theme-row">
              {THEME_ORDER.map((id) => {
                const isActive = activeTheme === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTheme(id)}
                    aria-label={tr.themes[id]}
                    className={'lav-theme-btn' + (isActive ? ' lav-theme-btn-active' : '')}
                  >
                    <span
                      className={
                        'lav-theme-dot lav-swatch-' +
                        id +
                        (isActive ? ' lav-theme-dot-active' : '') +
                        (id === 'white' ? ' lav-theme-dot-white' : '')
                      }
                    />
                  </button>
                );
              })}
            </div>
            <p className="lav-theme-label">{tr.themes[activeTheme]}</p>

            <p className="lav-made-with">{tr.madeWith}</p>
          </div>
        </div>
      )}
    </div>
  );
}
