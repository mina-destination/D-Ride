import React from 'react';
import { useConfirm } from '../context/ConfirmContext';

export interface PopconfirmProps {
  title: string;
  description?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  okText?: string;
  cancelText?: string;
  okButtonProps?: { danger?: boolean };
  children: React.ReactNode;
}

export function Popconfirm({
  title,
  description = '',
  onConfirm,
  okText,
  cancelText,
  okButtonProps,
  children,
}: PopconfirmProps) {
  const confirm = useConfirm();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    confirm({
      title,
      description,
      confirmText: okText,
      cancelText: cancelText,
      danger: okButtonProps?.danger !== false,
      onConfirm: async () => {
        if (onConfirm) {
          await onConfirm();
        }
      },
    });
  };

  // Clone the child element and attach the click handler directly to ensure it triggers correctly.
  // This is much safer than a span wrapper because it avoids nested block-in-inline issues and
  // attaches the handler directly to the actual interactive element.
  if (React.isValidElement(children)) {
    const child = children as React.ReactElement<any>;
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        // Call the original onClick if it exists
        if (child.props && typeof child.props.onClick === 'function') {
          child.props.onClick(e);
        }
        handleClick(e);
      }
    });
  }

  // Fallback to span wrapper if child is not a valid React element
  return (
    <span
      onClick={handleClick}
      role="button"
      tabIndex={0}
      style={{ display: 'inline-block', cursor: 'pointer' }}
    >
      {children}
    </span>
  );
}

