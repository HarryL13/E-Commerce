// Changes: Help panel — standalone vs pipeline modes from workflowGuide.
import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  X,
  Image,
  Package,
  Search,
  ChevronRight,
  Sparkles,
  Layers,
  Grid3X3,
  Palette,
  Stamp,
  Route,
  ArrowRight,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { HELP_SECTIONS, PIPELINE_STEPS, WorkflowUxMode } from '../utils/workflowGuide';

const STORAGE_OPEN = 'ecs_help_open';
const STORAGE_HIDDEN = 'ecs_help_hidden';

const SECTION_ICONS: Record<string, React.ReactNode> = {
  standalone: <Layers className="w-4 h-4" />,
  pipeline: <Route className="w-4 h-4" />,
  studio: <Image className="w-4 h-4" />,
  sku: <Package className="w-4 h-4" />,
  optimizer: <Search className="w-4 h-4" />,
};

const TAB_FEATURES = [
  { icon: <Palette className="w-3.5 h-3.5" />, label: 'Background' },
  { icon: <Grid3X3 className="w-3.5 h-3.5" />, label: 'Multi-View' },
  { icon: <Sparkles className="w-3.5 h-3.5" />, label: 'Scene Gen' },
  { icon: <Stamp className="w-3.5 h-3.5" />, label: 'Logo Brand' },
];

type FloatingHelpTabProps = {
  workflowUxMode?: WorkflowUxMode;
};

export const FloatingHelpTab: React.FC<FloatingHelpTabProps> = ({
  workflowUxMode = 'standalone',
}) => {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_OPEN) === '1');
      setHidden(localStorage.getItem(STORAGE_HIDDEN) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_OPEN, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const closePanel = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_OPEN, '0');
    } catch {
      /* ignore */
    }
  };

  const dismissTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    setHidden(true);
    try {
      localStorage.setItem(STORAGE_HIDDEN, '1');
      localStorage.setItem(STORAGE_OPEN, '0');
    } catch {
      /* ignore */
    }
  };

  const restoreTab = () => {
    setHidden(false);
    setOpen(true);
    try {
      localStorage.setItem(STORAGE_HIDDEN, '0');
      localStorage.setItem(STORAGE_OPEN, '1');
    } catch {
      /* ignore */
    }
  };

  if (hidden) {
    return (
      <button
        type="button"
        onClick={restoreTab}
        className="help-restore-btn"
        title="打开使用指南"
        aria-label="打开使用指南"
      >
        <BookOpen className="w-4 h-4" />
      </button>
    );
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="help-backdrop"
            aria-label="关闭使用指南"
            onClick={closePanel}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.aside
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="help-panel"
            role="dialog"
            aria-label="使用指南"
          >
            <header className="help-panel-header">
              <div className="flex items-center gap-2 min-w-0">
                <div className="bg-indigo-600 p-1.5 rounded-lg shrink-0">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-900 truncate">使用指南</h2>
                  <p className="text-[11px] text-zinc-500 truncate">
                    当前：{workflowUxMode === 'pipeline' ? '完整流程' : '独立使用'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={closePanel} className="help-icon-btn" aria-label="关闭面板">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="help-panel-body">
              <div className="help-overview space-y-3">
                <p className="text-xs text-zinc-600 leading-relaxed">
                  顶部切换 <strong>独立使用</strong> 或 <strong>完整流程</strong>。Optimizer
                  始终可用于更新已有 Shopify 产品。
                </p>

                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-indigo-700 mb-2">完整流程</p>
                  <div className="flex flex-wrap items-center gap-1 text-[10px] text-zinc-600">
                    {PIPELINE_STEPS.map((step, i) => (
                      <React.Fragment key={step.id}>
                        <span className="font-medium">{step.label}</span>
                        {i < PIPELINE_STEPS.length - 1 ? (
                          <ArrowRight className="w-3 h-3 text-zinc-400" />
                        ) : null}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {TAB_FEATURES.map((f) => (
                    <span key={f.label} className="help-chip">
                      {f.icon}
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>

              {HELP_SECTIONS.map((section) => (
                <section key={section.id} className="help-section">
                  <div className="help-section-title">
                    <span className="text-indigo-600">{SECTION_ICONS[section.id]}</span>
                    {section.title}
                  </div>
                  {section.steps ? (
                    <ol className="help-steps">
                      {section.steps.map((step, i) => (
                        <li key={i}>
                          <span className="help-step-num">{i + 1}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {section.bullets ? (
                    <ul className="help-bullets">
                      {section.bullets.map((item) => (
                        <li key={item}>
                          <ChevronRight className="w-3 h-3 shrink-0 text-indigo-400 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <div className={`help-floating-tab ${open ? 'help-floating-tab-open' : ''}`}>
        <button
          type="button"
          onClick={toggleOpen}
          className="help-tab-trigger"
          aria-expanded={open}
          aria-label={open ? '收起使用指南' : '打开使用指南'}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          <span className="help-tab-label">使用指南</span>
        </button>
        <button
          type="button"
          onClick={dismissTab}
          className="help-tab-dismiss"
          aria-label="隐藏使用指南"
          title="隐藏"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </>
  );
};
