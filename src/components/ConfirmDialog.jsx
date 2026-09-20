import React, { useEffect, useState, useCallback } from 'react';

/**
 * Unified Warning / Confirmation Popup component matching the diagram block deletion style.
 *
 * @param {boolean} [isOpen=true] - Whether the popup is visible
 * @param {'fixed'|'absolute'} [position='fixed'] - Positioning mode ('fixed' for full screen, 'absolute' for parent container)
 * @param {string} title - Header of the warning popup
 * @param {string|React.ReactNode} [info] - Info about what will happen
 * @param {string|React.ReactNode} [desc] - Alias for info
 * @param {string} [confirmText='Potvrdit (Enter)'] - Label for confirm button
 * @param {string} [cancelText='Zrušit (Esc)'] - Label for cancel button
 * @param {function} onConfirm - Callback when confirmed
 * @param {function} onCancel - Callback when cancelled
 * @param {'danger'|'warning'|'primary'} [confirmVariant='danger'] - Color style of confirm button
 * @param {number} [zIndex=9999] - Z-index for overlay
 */
export function ConfirmDialog({
  isOpen = true,
  position = 'fixed',
  title,
  info,
  desc,
  confirmText = 'Potvrdit (Enter)',
  cancelText = 'Zrušit (Esc)',
  onConfirm,
  onCancel,
  confirmVariant = 'danger',
  zIndex = 9999
}) {
  const contentInfo = info || desc;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel?.();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onConfirm?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  let confirmBtnClass = 'bg-red-600 hover:bg-red-700 text-white';
  if (confirmVariant === 'warning') {
    confirmBtnClass = 'bg-amber-600 hover:bg-amber-700 text-white';
  } else if (confirmVariant === 'primary') {
    confirmBtnClass = 'bg-indigo-600 hover:bg-indigo-700 text-white';
  }

  const posClass = position === 'absolute' ? 'absolute rounded-lg' : 'fixed';

  return (
    <div
      className={`${posClass} inset-0 flex items-center justify-center bg-gray-900/30 dark:bg-black/50 backdrop-blur-sm p-4`}
      style={{ zIndex }}
      onClick={() => onCancel?.()}
    >
      <div
        className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg border border-gray-200 dark:border-gray-700 max-w-sm w-full animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold mb-2 text-gray-900 dark:text-gray-100">{title}</h3>
        {contentInfo && (
          <div className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
            {contentInfo}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 mt-4">
          <button
            type="button"
            onClick={() => onCancel?.()}
            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => onConfirm?.()}
            className={`px-3 py-1 ${confirmBtnClass} rounded text-sm transition-colors font-medium`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for displaying a confirmation popup imperatively or declaratively.
 */
export function useConfirmDialog() {
  const [config, setConfig] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfig({
        ...options,
        onConfirm: () => {
          options.onConfirm?.();
          setConfig(null);
          resolve(true);
        },
        onCancel: () => {
          options.onCancel?.();
          setConfig(null);
          resolve(false);
        }
      });
    });
  }, []);

  const close = useCallback(() => setConfig(null), []);

  const dialogElement = config ? <ConfirmDialog {...config} /> : null;

  return { confirm, close, config, setConfig, dialogElement };
}

export default ConfirmDialog;
