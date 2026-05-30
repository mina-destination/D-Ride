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
  children: React.ReactElement;
}

export function Popconfirm({
  title,
  description = '',
  onConfirm,
  okText = 'Yes',
  cancelText = 'No',
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

  const child = children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;

  return React.cloneElement(child, {
    onClick: (e: React.MouseEvent) => {
      // Execute original child onClick if any
      if (child.props.onClick) {
        child.props.onClick(e);
      }
      handleClick(e);
    },
  });
}
